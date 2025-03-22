#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Arc;
use std::{env, time::Duration};

use tauri::{Emitter, Manager};
mod database;
mod inference;
mod utils;

#[derive(Clone, serde::Serialize)]
struct Payload {
    args: Vec<String>,
    cwd: String,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("{}, {argv:?}, {cwd}", app.package_info().name);
            app.emit("single-instance", Payload { args: argv, cwd })
                .unwrap();
        }))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:narratrix_main.db", database::get_migrations())
                .build(),
        )
        .setup(|app| {
            // Initialize the inference queue state
            let inference_state = Arc::new(inference::InferenceState::new(app.handle().clone()));
            app.manage(inference_state.clone());

            // Set up periodic cleanup of empty inference queues
            std::thread::spawn(move || {
                loop {
                    // Sleep for a while before checking
                    std::thread::sleep(Duration::from_secs(10));

                    // Clean up empty queues
                    if let Ok(mut manager) = inference_state.queue_manager.lock() {
                        manager.clean_empty_queues();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            utils::hash_password,
            utils::verify_password,
            utils::encrypt_api_key,
            utils::decrypt_api_key,
            inference::queue_inference_request,
            inference::cancel_inference_request,
            inference::clean_inference_queues,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
