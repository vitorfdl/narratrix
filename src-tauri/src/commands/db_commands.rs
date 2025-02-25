use tauri::{AppHandle, command};
use tauri_plugin_sql::Sql;

/// Struct representing a profile record.
#[derive(serde::Serialize)]
pub struct Profile {
    pub id: i32,
    pub name: String,
}

/// Tauri command to create a new profile.
/// 
/// # Parameters:
/// - `app`: The Tauri app handle for obtaining the SQL connection.
/// - `name`: The unique name of the profile.
/// 
/// # Returns:
/// On success, returns the profile ID of the newly created record.
#[tauri::command]
pub async fn create_profile(
    app: AppHandle,
    name: String,
) -> Result<i32, String> {
    let db = app.sql("narratrix").ok_or("Failed to get database connection")?;
    let result = db.execute(
        "INSERT INTO profiles (name) VALUES (?1)",
        [name],
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i32)
}

/// Tauri command to retrieve all profiles.
/// 
/// # Parameters:
/// - `app`: The Tauri app handle for obtaining the SQL connection.
/// 
/// # Returns:
/// Returns a vector of Profile records.
#[tauri::command]
pub async fn get_profiles(
    app: AppHandle,
) -> Result<Vec<Profile>, String> {
    let db = app.sql("narratrix").ok_or("Failed to get database connection")?;
    let profiles: Vec<Profile> = db.select(
        "SELECT id, name FROM profiles",
        [],
        |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        },
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(profiles)
}