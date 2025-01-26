#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

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
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
