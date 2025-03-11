#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::Path;
use std::{env, fs};

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{migrate::MigrateDatabase, SqlitePool};
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Emitter, Manager};
// mod characters;
mod chats;
mod models;
mod profiles;
mod utils;

#[derive(Clone, serde::Serialize)]
struct Payload {
    args: Vec<String>,
    cwd: String,
}

// State to hold the database pool
#[allow(dead_code)]
pub struct AppState {
    pub pool: Pool<Sqlite>,
    pub app_handle: AppHandle,
}

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, sqlx::Error> {
    // Get app data directory
    let app_dir = app
        .path()
        .app_config_dir()
        .expect("Failed to get app data directory");

    // Ensure directory exists
    fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
    println!("App data directory: {}", app_dir.display());

    // Main database path
    let main_db_path = app_dir.join("narratrix_main.db");
    let main_db_url = format!("sqlite:{}", main_db_path.to_str().unwrap());

    // Set the DATABASE_URL environment variable to point to this SQLite file
    env::set_var(
        "DATABASE_URL",
        format!("sqlite://{}", main_db_path.display()),
    );

    // If Database exist, delete, just for testing purposes
    if Path::new(&main_db_path).exists() {
        fs::remove_file(&main_db_path).expect("Failed to delete database");
    }

    // Create database if it doesn't exist
    if !Path::new(&main_db_path).exists() {
        sqlx::Sqlite::create_database(&main_db_url).await?;
    }

    // Connect with options for better concurrency
    let options = SqliteConnectOptions::new()
        .filename(&main_db_path)
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Run migrations regardless of whether the database is new
    // SQLx will track which migrations have been run
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("{}, {argv:?}, {cwd}", app.package_info().name);
            app.emit("single-instance", Payload { args: argv, cwd })
                .unwrap();
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // Initialize database
            let handle = app.handle();
            let pool = tauri::async_runtime::block_on(async { init_db(&handle).await })?;

            // Store the connection pool in app state
            app.manage(AppState {
                pool,
                app_handle: handle.clone(),
            });

            Ok(())
        })
        // Register commands from the profiles module
        .invoke_handler(tauri::generate_handler![
            // Profile commands
            profiles::create_profile,
            profiles::get_profiles,
            profiles::get_profile_by_id,
            profiles::update_profile,
            profiles::delete_profile,
            profiles::login_profile,
            // Model commands
            models::create_model,
            models::get_models_by_profile,
            models::get_models_by_type,
            models::get_model_by_id,
            models::update_model,
            models::delete_model,
            // Model manifest commands
            models::manifest::get_all_model_manifests,
            models::manifest::get_model_manifest_by_id,
            // Character commands
            // characters::create_character,
            // characters::get_characters_by_profile,
            // characters::get_characters_by_type,
            // characters::get_character_by_id,
            // characters::update_character,
            // characters::delete_character,
            // Chat commands
            chats::create_chat,
            chats::get_chats_by_profile,
            chats::get_chat_by_id,
            chats::update_chat,
            chats::delete_chat,
            // Message commands
            chats::add_message,
            chats::get_messages,
            chats::delete_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
