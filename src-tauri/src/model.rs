use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub path: String,
    pub model_type: String,
    pub dimension: usize,
    pub status: String,
}

pub fn detect_models(search_dir: &Path) -> Vec<ModelInfo> {
    let mut found = Vec::new();
    if let Ok(entries) = fs::read_dir(search_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.path().is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                let config_path = entry.path().join("config.json");
                let has_weights = entry.path().join("pytorch_model.bin").exists()
                    || entry.path().join("model.safetensors").exists();

                if config_path.exists() && has_weights {
                    let is_siglip = name.to_lowercase().contains("siglip");
                    let dim = if is_siglip { 768 } else { 512 };
                    let m_type = if is_siglip { "siglip" } else { "clip" };

                    found.push(ModelInfo {
                        name,
                        path: entry.path().to_string_lossy().replace('\\', "/"),
                        model_type: m_type.to_string(),
                        dimension: dim,
                        status: "detected".to_string(),
                    });
                }
            }
        }
    }
    found
}

pub fn find_models_dir() -> PathBuf {
    // Check multiple candidate locations
    let candidates = [
        PathBuf::from("../../models"),
        PathBuf::from("../models"),
        PathBuf::from("models"),
        PathBuf::from("E:/XFind_Pro/models"),
    ];

    for c in &candidates {
        if c.is_dir() {
            return c.clone();
        }
    }
    PathBuf::from("../../models")
}
