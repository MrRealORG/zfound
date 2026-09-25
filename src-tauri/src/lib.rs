mod ai_bridge;
mod commands;
mod hasher;
mod model;
mod scanner;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::choose_folder,
            commands::choose_image_file,
            commands::get_default_folder,
            commands::set_default_folder,
            commands::scan_folder,
            commands::index_images,
            commands::search_similar,
            commands::get_thumbnail,
            commands::open_image,
            commands::reveal_in_explorer,
            commands::get_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running ZFound application");
}
