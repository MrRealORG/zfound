use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use serde::{Deserialize, Serialize};
use base64::Engine;

use crate::scanner::{scan_directory, ImageEntry};
use crate::hasher::{compute_dhash_64, hamming_distance, similarity_percentage, cosine_similarity};
use crate::model::{detect_models, find_models_dir, ModelInfo};
use crate::ai_bridge::AiWorkerBridge;

#[derive(Serialize, Deserialize, Clone)]
pub struct PersistentIndexItem {
    pub entry: ImageEntry,
    pub hash: u64,
    #[serde(default)]
    pub vector: Option<Vec<f32>>,
}

#[derive(Serialize, Deserialize)]
pub struct PersistentIndexFile {
    pub version: String,
    pub folder: String,
    pub updated_at: u64,
    #[serde(default)]
    pub model_name: String,
    #[serde(default)]
    pub dimension: usize,
    pub items: Vec<PersistentIndexItem>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub default_folder: Option<String>,
}

pub struct AppState {
    pub scanned: Mutex<Vec<ImageEntry>>,
    pub indexed_items: Mutex<Vec<PersistentIndexItem>>,
    pub active_folder: Mutex<String>,
    pub logs: Mutex<Vec<String>>,
    pub ai_bridge: Arc<AiWorkerBridge>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            scanned: Mutex::new(Vec::new()),
            indexed_items: Mutex::new(Vec::new()),
            active_folder: Mutex::new(String::new()),
            logs: Mutex::new(Vec::new()),
            ai_bridge: Arc::new(AiWorkerBridge::default()),
        }
    }
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

fn get_config_path() -> PathBuf {
    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".zfound_config.json")
}

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub branding: String,
    pub version: String,
    pub models_available: Vec<ModelInfo>,
    pub active_model: Option<String>,
    pub dimension: usize,
    pub scanned_count: usize,
    pub indexed_count: usize,
    pub default_folder: Option<String>,
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
    let model_name = state.ai_bridge.model_name.lock().unwrap().clone();
    let dim = *state.ai_bridge.dimension.lock().unwrap();
    let scanned_c = state.scanned.lock().unwrap().len();
    let indexed_c = state.indexed_items.lock().unwrap().len();

    let def_folder = if let Ok(cfg_data) = fs::read_to_string(get_config_path()) {
        serde_json::from_str::<AppConfig>(&cfg_data).ok().and_then(|c| c.default_folder)
    } else {
        None
    };

    AppInfo {
        name: "ZFound".to_string(),
        branding: "ZFound × Zeeno Soft".to_string(),
        version: "0.1.0".to_string(),
        models_available: models,
        active_model: Some(model_name),
        dimension: dim,
        scanned_count: scanned_c,
        indexed_count: indexed_c,
        default_folder: def_folder,
    }
}

#[tauri::command]
pub fn choose_folder() -> Option<String> {
    let folder = rfd::FileDialog::new().pick_folder()?;
    Some(folder.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub fn choose_image_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("Images", &["jpg", "jpeg", "png", "webp", "bmp"])
        .pick_file()?;
    Some(file.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub fn get_default_folder() -> Option<String> {
    let path = get_config_path();
    if let Ok(data) = fs::read_to_string(path) {
        if let Ok(cfg) = serde_json::from_str::<AppConfig>(&data) {
            return cfg.default_folder;
        }
    }
    None
}

#[tauri::command]
pub fn set_default_folder(folder: String) -> Result<(), String> {
    let cfg = AppConfig {
        default_folder: Some(folder),
    };
    if let Ok(data) = serde_json::to_string_pretty(&cfg) {
        fs::write(get_config_path(), data).map_err(|e| e.to_string())?;
    }
    Ok(())
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
                let has_vectors = index_file.items.iter().any(|i| i.vector.is_some());
                *state.indexed_items.lock().unwrap() = index_file.items;
                log_event(
                    &state,
                    &format!(
                        "Loaded {} indexed items from .zfound_index.json (AI vectors: {})",
                        count, has_vectors
                    ),
                );
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
    log_event(&state, &format!("Initializing AI Vision worker for {} images...", scanned.len()));

    let _ = state.ai_bridge.ensure_started();

    let paths: Vec<String> = scanned.iter().map(|e| e.path.clone()).collect();
    log_event(&state, "Extracting 512-D neural embeddings via CLIP...");

    let batch_embeddings = match state.ai_bridge.embed_batch(&paths) {
        Ok(res) => res,
        Err(e) => {
            log_event(&state, &format!("AI worker batch warning: {}. Using perceptual hash.", e));
            Vec::new()
        }
    };

    let mut persistent_items = Vec::new();

    for (i, entry) in scanned.into_iter().enumerate() {
        let hash = compute_dhash_64(&entry.path).unwrap_or(0);
        let vector = batch_embeddings.get(i).and_then(|(_, v)| v.clone());
        persistent_items.push(PersistentIndexItem {
            entry,
            hash,
            vector,
        });
    }

    let count = persistent_items.len();
    *state.indexed_items.lock().unwrap() = persistent_items.clone();
    log_event(&state, &format!("Successfully indexed {} images with 512-D AI vectors", count));

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
            model_name: state.ai_bridge.model_name.lock().unwrap().clone(),
            dimension: *state.ai_bridge.dimension.lock().unwrap(),
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
    log_event(&state, &format!("Running AI neural similarity query for: {}", query_path));

    let query_hash = compute_dhash_64(&query_path).unwrap_or(0);
    
    // Extract query embedding from CLIP
    let query_vector = match state.ai_bridge.embed_single(&query_path) {
        Ok(v) => Some(v),
        Err(e) => {
            log_event(&state, &format!("AI query embedding fallback: {}", e));
            None
        }
    };

    let indexed = state.indexed_items.lock().unwrap().clone();
    if indexed.is_empty() {
        return Err("No images indexed yet. Please scan and index first.".to_string());
    }

    let mut results = Vec::new();

    for item in indexed {
        let is_exact = query_hash != 0 && item.hash != 0 && (query_hash == item.hash);
        let dist = hamming_distance(query_hash, item.hash);

        let score = if is_exact {
            100.0f32
        } else if let (Some(q_vec), Some(item_vec)) = (&query_vector, &item.vector) {
            // High-precision cosine similarity in 512-D space
            let cos_sim = cosine_similarity(q_vec, item_vec);
            (cos_sim * 100.0).clamp(0.0, 100.0)
        } else {
            // Fallback to dHash percentage if embeddings not yet indexed
            similarity_percentage(dist, 64)
        };

        if score >= min_score {
            results.push(SearchResult {
                path: item.entry.path,
                name: item.entry.name,
                size: item.entry.size,
                score: (score * 10.0).round() / 10.0,
                is_exact,
                hamming_dist: dist,
            });
        }
    }

    // Sort descending by exact match and score
    results.sort_by(|a, b| {
        b.is_exact
            .cmp(&a.is_exact)
            .then_with(|| b.score.partial_cmp(&a.score).unwrap())
    });

    results.truncate(top_k);
    log_event(&state, &format!("Query returned {} ranked AI matches", results.len()));
    Ok(results)
}

fn get_thumb_cache_dir() -> PathBuf {
    let tmp = std::env::temp_dir();
    let cache = tmp.join("zfound_thumbs");
    let _ = fs::create_dir_all(&cache);
    cache
}

fn path_to_thumb_filename(path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut s = DefaultHasher::new();
    path.hash(&mut s);
    format!("{:x}.jpg", s.finish())
}

#[tauri::command]
pub fn get_thumbnail(path: String, max_size: Option<u32>) -> Result<String, String> {
    let size = max_size.unwrap_or(240);
    let cache_dir = get_thumb_cache_dir();
    let thumb_file = cache_dir.join(path_to_thumb_filename(&format!("{}_{}", path, size)));

    if thumb_file.exists() {
        if let Ok(bytes) = fs::read(&thumb_file) {
            let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
            return Ok(format!("data:image/jpeg;base64,{}", b64));
        }
    }

    // Generate downscaled thumbnail
    let img = image::open(Path::new(&path)).map_err(|e| e.to_string())?;
    let thumb = img.thumbnail(size, size);

    let mut buf = std::io::Cursor::new(Vec::new());
    thumb
        .write_to(&mut buf, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    let bytes = buf.into_inner();
    let _ = fs::write(&thumb_file, &bytes);

    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
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
