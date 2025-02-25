use std::fs;
use std::path::PathBuf;
use tauri::{App, Manager};
use tauri_plugin_sql::{Sql, Migration, MigrationKind};

/// Initializes the SQL plugin for the Narratrix application.
/// This function resolves the configuration directory, creates it if necessary,
/// defines the SQLite database path, and registers database migrations.
pub fn init_db(app: &App) -> tauri::Result<()> {
    // Resolve the config directory.
    let config_dir: PathBuf = app.path_resolver()
        .app_config_dir()
        .expect("Failed to resolve config directory");
    // Ensure the directory exists.
    fs::create_dir_all(&config_dir)
        .expect("Failed to create config directory");
    
    // Define the database path.
    let db_path = config_dir.join("narratrix.db");
    let db_url = format!("sqlite://{}", db_path.to_string_lossy());

    // Define migrations for schema initialization.
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: r#"
                CREATE TABLE IF NOT EXISTS profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE
                );
                CREATE TABLE IF NOT EXISTS chats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    profile_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS scripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    profile_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    content TEXT NOT NULL,
                    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
                );
            "#,
            kind: MigrationKind::Up,
        },
    ];

    // Initialize the SQL plugin with the database and migrations.
    app.handle().plugin(
        Sql::default()
            .database("narratrix", &db_url)
            .migrations(migrations)
    )?;
    Ok(())
}