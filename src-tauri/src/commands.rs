use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::SystemTime;
use serde::{Deserialize, Serialize};
use base64::Engine;
use image::imageops::FilterType;

use crate::scanner::{scan_directory, ImageEntry};
use crate::hasher::{compute_dhash_64, hamming_distance, similarity_percentage};
use crate::model::{detect_models, find_models_dir, ModelInfo};

#[derive(Serialize, Deserialize, Clone)]
pub struct PersistentIndexItem {
    pub entry: ImageEntry,
    pub hash: u64,
}

#[derive(Serialize, Deserialize)]
pub struct PersistentIndexFile {
    pub version: String,
    pub folder: String,
    pub updated_at: u64,
    pub items: Vec<PersistentIndexItem>,
}

#[derive(Default)]
pub struct AppState {
    pub scanned: Mutex<Vec<ImageEntry>>,
    pub indexed_hashes: Mutex<Vec<(ImageEntry, u64)>>,
    pub active_folder: Mutex<String>,
    pub logs: Mutex<Vec<String>>,
}

fn log_event(state: &AppState, message: &str) {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let hours = (now / 3600) % 24;
    let mins = (now / 60) % 60;
    let secs = now % 60;
    let formatted = format!("[{:02}:{:02}:{:02}] {}", hours, mins, secs, message);
    
    if let Ok(mut logs) = state.logs.lock() {
        logs.push(formatted);
        if logs.len() > 200 {
            logs.remove(0);
        }
    }
}

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub branding: String,
    pub version: String,
    pub models_available: Vec<ModelInfo>,
    pub active_model: Option<String>,
    pub scanned_count: usize,
    pub indexed_count: usize,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub score: f32,
    pub is_exact: bool,
    pub hamming_dist: u32,
}

#[tauri::command]
pub fn get_app_info(state: tauri::State<AppState>) -> AppInfo {
    let models_dir = find_models_dir();
    let models = detect_models(&models_dir);
    let active_m = models.first().map(|m| m.name.clone());
    let scanned_c = state.scanned.lock().unwrap().len();
    let indexed_c = state.indexed_hashes.lock().unwrap().len();

    AppInfo {
        name: "ZFound".to_string(),
        branding: "ZFound × Zeeno Soft".to_string(),
        version: "0.1.0".to_string(),
        models_available: models,
        active_model: active_m,
        scanned_count: scanned_c,
        indexed_count: indexed_c,
    }
}

#[tauri::command]
pub fn get_logs(state: tauri::State<AppState>) -> Vec<String> {
    state.logs.lock().unwrap().clone()
}

#[tauri::command]
pub fn scan_folder(state: tauri::State<AppState>, path: String, recursive: bool) -> Result<Vec<ImageEntry>, String> {
    log_event(&state, &format!("Scanning directory: {} (recursive: {})", path, recursive));
    let entries = scan_directory(&path, recursive)?;
    log_event(&state, &format!("Discovered {} images", entries.len()));

    *state.active_folder.lock().unwrap() = path.clone();
    *state.scanned.lock().unwrap() = entries.clone();

    // Check if .zfound_index.json exists in this folder
    let index_file_path = Path::new(&path).join(".zfound_index.json");
    if index_file_path.exists() {
        if let Ok(content) = fs::read_to_string(&index_file_path) {
            if let Ok(index_file) = serde_json::from_str::<PersistentIndexFile>(&content) {
                let count = index_file.items.len();
                let mut hashes = Vec::new();
                for item in index_file.items {
                    hashes.push((item.entry, item.hash));
                }
                *state.indexed_hashes.lock().unwrap() = hashes;
                log_event(&state, &format!("Loaded {} indexed items from .zfound_index.json", count));
            }
        }
    }

    Ok(entries)
}

#[tauri::command]
pub fn index_images(state: tauri::State<AppState>) -> Result<usize, String> {
    let scanned = state.scanned.lock().unwrap().clone();
    if scanned.is_empty() {
        return Err("No scanned images to index".to_string());
    }

    let folder = state.active_folder.lock().unwrap().clone();
    log_event(&state, &format!("Indexing {} images with perceptual dHash...", scanned.len()));

    let mut indexed = Vec::new();
    let mut persistent_items = Vec::new();

    for entry in scanned {
        if let Some(hash) = compute_dhash_64(&entry.path) {
            indexed.push((entry.clone(), hash));
            persistent_items.push(PersistentIndexItem { entry, hash });
        }
    }

    let count = indexed.len();
    *state.indexed_hashes.lock().unwrap() = indexed;
    log_event(&state, &format!("Successfully indexed {} images", count));

    // Save persistent index in the active folder
    if !folder.is_empty() {
        let index_file_path = Path::new(&folder).join(".zfound_index.json");
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let data = PersistentIndexFile {
            version: "0.1.0".to_string(),
            folder: folder.clone(),
            updated_at: now,
            items: persistent_items,
        };

        if let Ok(json_str) = serde_json::to_string_pretty(&data) {
            if fs::write(&index_file_path, json_str).is_ok() {
                log_event(&state, &format!("Saved .zfound_index.json to {}", folder));
            }
        }
    }

    Ok(count)
}

#[tauri::command]
pub fn search_similar(
    state: tauri::State<AppState>,
    query_path: String,
    top_k: usize,
    min_score: f32,
) -> Result<Vec<SearchResult>, String> {
    log_event(&state, &format!("Running similarity query for: {}", query_path));

    let query_hash = compute_dhash_64(&query_path)
        .ok_or_else(|| "Failed to compute visual hash for query image".to_string())?;

    let indexed = state.indexed_hashes.lock().unwrap().clone();
    if indexed.is_empty() {
        return Err("No images indexed yet. Please scan and index first.".to_string());
    }

    let mut results = Vec::new();
    for (entry, hash) in indexed {
        let dist = hamming_distance(query_hash, hash);
        let score = similarity_percentage(dist, 64);
        let is_exact = dist == 0;

        if score >= min_score {
            results.push(SearchResult {
                path: entry.path,
                name: entry.name,
                size: entry.size,
                score: (score * 10.0).round() / 10.0,
                is_exact,
                hamming_dist: dist,
            });
        }
    }

    // Sort descending by exact match and similarity score
    results.sort_by(|a, b| {
        b.is_exact
            .cmp(&a.is_exact)
            .then_with(|| b.score.partial_cmp(&a.score).unwrap())
    });

    results.truncate(top_k);
    log_event(&state, &format!("Query returned {} matches", results.len()));
    Ok(results)
}

#[tauri::command]
pub fn get_thumbnail(path: String, max_size: Option<u32>) -> Result<String, String> {
    let size = max_size.unwrap_or(240);
    let img = image::open(Path::new(&path)).map_err(|e| e.to_string())?;
    let thumb = img.resize(size, size, FilterType::Triangle);

    let mut buf = std::io::Cursor::new(Vec::new());
    thumb
        .write_to(&mut buf, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
pub fn open_image(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args([format!("/select,{}", path.replace('/', "\\"))])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
