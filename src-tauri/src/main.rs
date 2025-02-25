#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Declare module dependencies
mod database;
mod commands;

use database::init_db;
use commands::db_commands;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

// Application state
struct AppState {
    counter: Mutex<i32>,
}

#[derive(Serialize, Deserialize)]
struct Response {
    message: String,
    count: i32,
}

// Commands
#[tauri::command]
fn greet(name: &str, state: State<AppState>) -> Response {
    let mut counter = state.counter.lock().unwrap();
    *counter += 1;
    
    Response {
        message: format!("Hello, {}!", name),
        count: *counter,
    }
}

fn main() {
    let app_state = AppState {
        counter: Mutex::new(0),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            // Initialize the database plugin and apply migrations.
            init_db(app)
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            db_commands::create_profile,
            db_commands::get_profiles
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
