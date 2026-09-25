use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct WorkerReq<'a> {
    cmd: &'a str,
    id: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    paths: Option<&'a [String]>,
}

#[derive(Deserialize)]
struct WorkerResp {
    status: String,
    #[serde(default)]
    vector: Option<Vec<f32>>,
    #[serde(default)]
    items: Option<Vec<BatchItemResp>>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Deserialize)]
struct BatchItemResp {
    path: String,
    vector: Option<Vec<f32>>,
}

pub struct AiWorkerBridge {
    child: Mutex<Option<(Child, ChildStdin, BufReader<ChildStdout>)>>,
    req_id: Mutex<u64>,
    pub model_name: Mutex<String>,
    pub dimension: Mutex<usize>,
    pub is_ready: Mutex<bool>,
}

impl Default for AiWorkerBridge {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            req_id: Mutex::new(1),
            model_name: Mutex::new("clip-vit-base-patch32".to_string()),
            dimension: Mutex::new(512),
            is_ready: Mutex::new(false),
        }
    }
}

fn find_worker_script() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("core/ai_worker.py"),
        PathBuf::from("../core/ai_worker.py"),
        PathBuf::from("e:/XFind_Pro/zfound/core/ai_worker.py"),
    ];
    for c in &candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }
    // Try relative to current executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p1 = parent.join("core").join("ai_worker.py");
            if p1.exists() {
                return Some(p1);
            }
            let p2 = parent.join("..").join("core").join("ai_worker.py");
            if p2.exists() {
                return Some(p2);
            }
        }
    }
    None
}

impl AiWorkerBridge {
    pub fn ensure_started(&self) -> Result<(), String> {
        let mut guard = self.child.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Ok(());
        }

        let script = find_worker_script().ok_or_else(|| "Could not locate core/ai_worker.py".to_string())?;

        let mut cmd = Command::new("python");
        cmd.arg(&script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn Python AI worker: {}", e))?;
        let stdin = child.stdin.take().ok_or_else(|| "Failed to open worker stdin".to_string())?;
        let stdout = child.stdout.take().ok_or_else(|| "Failed to open worker stdout".to_string())?;
        let mut reader = BufReader::new(stdout);

        // Read startup JSON line
        let mut first_line = String::new();
        reader.read_line(&mut first_line).map_err(|e| format!("Failed to read worker init: {}", e))?;

        if let Ok(init) = serde_json::from_str::<serde_json::Value>(&first_line) {
            if init.get("status").and_then(|v| v.as_str()) == Some("ready") {
                *self.is_ready.lock().unwrap() = true;
                if let Some(m) = init.get("model").and_then(|v| v.as_str()) {
                    *self.model_name.lock().unwrap() = m.to_string();
                }
                if let Some(d) = init.get("dimension").and_then(|v| v.as_u64()) {
                    *self.dimension.lock().unwrap() = d as usize;
                }
            }
        }

        *guard = Some((child, stdin, reader));
        Ok(())
    }

    pub fn embed_single(&self, path: &str) -> Result<Vec<f32>, String> {
        self.ensure_started()?;
        let mut guard = self.child.lock().map_err(|e| e.to_string())?;
        let (_, stdin, reader) = guard.as_mut().ok_or_else(|| "Worker not running".to_string())?;

        let id = {
            let mut id_guard = self.req_id.lock().unwrap();
            *id_guard += 1;
            *id_guard
        };

        let req = WorkerReq {
            cmd: "embed_single",
            id,
            path: Some(path),
            paths: None,
        };

        let req_json = serde_json::to_string(&req).map_err(|e| e.to_string())?;
        writeln!(stdin, "{}", req_json).map_err(|e| format!("Failed to write to worker: {}", e))?;
        stdin.flush().map_err(|e| format!("Failed to flush worker stdin: {}", e))?;

        let mut resp_line = String::new();
        reader.read_line(&mut resp_line).map_err(|e| format!("Failed to read worker response: {}", e))?;

        let resp: WorkerResp = serde_json::from_str(&resp_line).map_err(|e| format!("Worker parse error: {}", e))?;
        if resp.status == "ok" {
            resp.vector.ok_or_else(|| "Worker returned empty vector".to_string())
        } else {
            Err(resp.error.unwrap_or_else(|| "Worker error".to_string()))
        }
    }

    pub fn embed_batch(&self, paths: &[String]) -> Result<Vec<(String, Option<Vec<f32>>)>, String> {
        self.ensure_started()?;
        let mut guard = self.child.lock().map_err(|e| e.to_string())?;
        let (_, stdin, reader) = guard.as_mut().ok_or_else(|| "Worker not running".to_string())?;

        let id = {
            let mut id_guard = self.req_id.lock().unwrap();
            *id_guard += 1;
            *id_guard
        };

        let req = WorkerReq {
            cmd: "embed_batch",
            id,
            path: None,
            paths: Some(paths),
        };

        let req_json = serde_json::to_string(&req).map_err(|e| e.to_string())?;
        writeln!(stdin, "{}", req_json).map_err(|e| format!("Failed to write to worker: {}", e))?;
        stdin.flush().map_err(|e| format!("Failed to flush worker stdin: {}", e))?;

        let mut resp_line = String::new();
        reader.read_line(&mut resp_line).map_err(|e| format!("Failed to read worker response: {}", e))?;

        let resp: WorkerResp = serde_json::from_str(&resp_line).map_err(|e| format!("Worker parse error: {}", e))?;
        if resp.status == "ok" {
            let items = resp.items.unwrap_or_default();
            let mut results = Vec::new();
            for item in items {
                results.push((item.path, item.vector));
            }
            Ok(results)
        } else {
            Err(resp.error.unwrap_or_else(|| "Worker error".to_string()))
        }
    }
}
