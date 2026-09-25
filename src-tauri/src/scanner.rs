use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::SystemTime;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageEntry {
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size: u64,
    pub modified: u64,
}

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff", "tif", "ico",
];

pub fn scan_directory(dir_path: &str, recursive: bool) -> Result<Vec<ImageEntry>, String> {
    let root = Path::new(dir_path);
    if !root.is_dir() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    let max_depth = if recursive { usize::MAX } else { 1 };
    let mut results = Vec::new();

    for entry in WalkDir::new(root)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) {
                let ext_lower = ext.to_lowercase();
                if SUPPORTED_EXTENSIONS.contains(&ext_lower.as_str()) {
                    let path_str = entry.path().to_string_lossy().replace('\\', "/");
                    let file_name = entry.file_name().to_string_lossy().to_string();
                    let metadata = entry.metadata().ok();
                    let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                    let modified = metadata
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    results.push(ImageEntry {
                        path: path_str,
                        name: file_name,
                        ext: ext_lower,
                        size,
                        modified,
                    });
                }
            }
        }
    }

    Ok(results)
}
