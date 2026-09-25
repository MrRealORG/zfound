use image::imageops::FilterType;
use std::path::Path;

pub fn compute_dhash_64(image_path: &str) -> Option<u64> {
    let img = image::open(Path::new(image_path)).ok()?;
    let gray = img.resize_exact(9, 8, FilterType::Nearest).to_luma8();

    let mut hash: u64 = 0;
    for y in 0..8 {
        for x in 0..8 {
            let left = gray.get_pixel(x, y)[0];
            let right = gray.get_pixel(x + 1, y)[0];
            if left > right {
                hash |= 1 << (y * 8 + x);
            }
        }
    }
    Some(hash)
}

pub fn hamming_distance(h1: u64, h2: u64) -> u32 {
    (h1 ^ h2).count_ones()
}

pub fn similarity_percentage(distance: u32, total_bits: u32) -> f32 {
    if distance == 0 {
        100.0
    } else {
        let sim = 1.0 - (distance as f32 / total_bits as f32);
        (sim * 100.0).max(0.0)
    }
}

pub fn cosine_similarity(v1: &[f32], v2: &[f32]) -> f32 {
    if v1.len() != v2.len() || v1.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    for i in 0..v1.len() {
        dot += v1[i] * v2[i];
    }
    dot.clamp(0.0, 1.0)
}
