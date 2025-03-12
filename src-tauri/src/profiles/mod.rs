use crate::{utils::merge_settings, AppState};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use tauri::State;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing)]
    pub password: String,
    pub avatar_path: Option<String>,
    /// User settings as a JSON object containing app configuration
    pub settings: JsonValue,
    pub created_at: Option<OffsetDateTime>,
    pub updated_at: Option<OffsetDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct NewProfile {
    pub name: String,
    pub password: String,
    pub avatar_path: Option<String>,
    /// Optional user settings - if not provided, default settings will be used
    #[serde(default)]
    pub settings: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub name: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct ProfileResponse {
    pub id: String,
    pub name: String,
    pub avatar_path: Option<String>,
    /// User settings as a JSON object containing app
    pub settings: JsonValue,
    pub created_at: Option<OffsetDateTime>,
    pub updated_at: Option<OffsetDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub password: Option<String>,
    pub avatar_path: Option<String>,
    /// Optional partial settings to update - will be merged with existing settings
    pub settings: Option<JsonValue>,
}

// Helper function to convert Profile to ProfileResponse (without password)
impl From<Profile> for ProfileResponse {
    fn from(profile: Profile) -> Self {
        Self {
            id: profile.id,
            name: profile.name,
            avatar_path: profile.avatar_path,
            settings: profile.settings,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProfileSummary {
    pub id: String,
    pub name: String,
    pub avatar_path: Option<String>,
    pub has_password: bool,
    pub created_at: Option<OffsetDateTime>,
}

// Helper function to verify a password against its hash
fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| format!("Failed to parse password hash: {}", e))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Create a new profile
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `profile` - The profile data to create
///
/// # Returns
/// * `Result<ProfileResponse, String>` - The created profile or an error message
#[tauri::command]
pub async fn create_profile(
    state: State<'_, AppState>,
    profile: NewProfile,
) -> Result<ProfileResponse, String> {
    let pool = &state.pool;
    let id = Uuid::new_v4().to_string();
    let timestamps = crate::utils::Timestamps::new();

    // Hash the password using Argon2
    let hashed_password = hash_password(&profile.password)?;

    // Use provided settings or default empty JSON object
    let settings = profile.settings.unwrap_or_else(|| json!({}));

    match sqlx::query(
        "INSERT INTO profiles (id, name, password, avatar_path, settings, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&profile.name)
    .bind(&hashed_password)
    .bind(&profile.avatar_path)
    .bind(&settings.to_string())
    .bind(timestamps.created_at)
    .bind(timestamps.updated_at)
    .execute(pool)
    .await
    {
        Ok(_) => Ok(ProfileResponse {
            id,
            name: profile.name,
            avatar_path: profile.avatar_path,
            settings,
            created_at: Some(timestamps.created_at),
            updated_at: Some(timestamps.updated_at),
        }),
        Err(e) => Err(format!("Failed to create profile: {}", e)),
    }
}

/// Login a user with username and password
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `login` - The login credentials
///
/// # Returns
/// * `Result<ProfileResponse, String>` - The profile if login successful or an error message
#[tauri::command]
pub async fn login_profile(
    state: State<'_, AppState>,
    login: LoginRequest,
) -> Result<ProfileResponse, String> {
    let pool = &state.pool;

    // Get the profile by name to retrieve the stored password hash
    match sqlx::query_as!(
        Profile,
        r#"SELECT 
            id as "id!: String", 
            name as "name!: String", 
            password as "password!: String", 
            avatar_path, 
            settings as "settings!: JsonValue",
            created_at, 
            updated_at 
        FROM profiles WHERE name = ?"#,
        login.name
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some(profile)) => {
            // Verify the password
            match verify_password(&login.password, &profile.password) {
                Ok(true) => Ok(ProfileResponse::from(profile)),
                Ok(false) => Err("Invalid credentials".to_string()),
                Err(e) => Err(e),
            }
        }
        Ok(None) => Err("Profile not found".to_string()),
        Err(e) => Err(format!("Login failed: {}", e)),
    }
}

/// Get all profiles
///
/// # Arguments
/// * `state` - The application state containing the database pool
///
/// # Returns
/// * `Result<Vec<ProfileSummary>, String>` - The list of profiles or an error message
#[tauri::command]
pub async fn get_profiles(state: State<'_, AppState>) -> Result<Vec<ProfileSummary>, String> {
    let pool = &state.pool;

    match sqlx::query_as!(
        ProfileSummary,
        r#"SELECT 
            id as "id!: String", 
            name as "name!: String", 
            avatar_path,
            created_at,
            (password IS NOT NULL AND trim(password) != '') as "has_password!: bool"
        FROM profiles"#
    )
    .fetch_all(pool)
    .await
    {
        Ok(profiles) => Ok(profiles),
        Err(e) => Err(format!("Failed to get profiles: {}", e)),
    }
}

/// Get a profile by ID
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The profile ID to look up
///
/// # Returns
/// * `Result<Option<ProfileResponse>, String>` - The profile if found, None if not found, or an error message
#[tauri::command]
pub async fn get_profile_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<ProfileResponse>, String> {
    let pool = &state.pool;

    match sqlx::query_as!(
        Profile,
        r#"SELECT 
            id as "id!: String", 
            name as "name!: String", 
            password as "password!: String", 
            avatar_path, 
            settings as "settings!: JsonValue",
            created_at, 
            updated_at 
        FROM profiles WHERE id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some(profile)) => Ok(Some(ProfileResponse::from(profile))),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to get profile: {}", e)),
    }
}

/// Update a profile with partial data
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The profile ID to update
/// * `update` - The fields to update (all are optional)
///
/// # Returns
/// * `Result<ProfileResponse, String>` - The updated profile or an error message
#[tauri::command]
pub async fn update_profile(
    state: State<'_, AppState>,
    id: String,
    update: UpdateProfileRequest,
) -> Result<ProfileResponse, String> {
    let pool = &state.pool;

    // Start a transaction for consistency and atomicity
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Get current profile
    let current_profile = sqlx::query_as!(
        Profile,
        r#"SELECT 
            id as "id!: String", 
            name as "name!: String", 
            password as "password!: String", 
            avatar_path, 
            settings as "settings!: JsonValue",
            created_at, 
            updated_at 
        FROM profiles WHERE id = ?"#,
        id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("Failed to fetch profile: {}", e))?
    .ok_or_else(|| "Profile not found".to_string())?;

    // Build the query using SQLx's query builder
    let mut query_builder = sqlx::QueryBuilder::new("UPDATE profiles SET ");
    let mut separated = query_builder.separated(", ");
    let mut has_updates = false;

    // Add fields conditionally
    if let Some(name) = &update.name {
        separated.push("name = ");
        separated.push_bind(name);
        has_updates = true;
    }

    if let Some(password) = &update.password {
        let hashed_password = hash_password(password)?;
        separated.push("password = ");
        separated.push_bind(hashed_password);
        has_updates = true;
    }

    if let Some(avatar_path) = &update.avatar_path {
        separated.push("avatar_path = ");
        separated.push_bind(avatar_path);
        has_updates = true;
    }

    // Handle settings update by merging with existing settings
    if let Some(new_settings) = &update.settings {
        let merged_settings = merge_settings(&current_profile.settings, new_settings);
        separated.push("settings = ");
        separated.push_bind(merged_settings.to_string());
        has_updates = true;
    }

    // If no fields were provided to update, return the current profile
    if !has_updates {
        tx.rollback()
            .await
            .map_err(|e| format!("Failed to rollback transaction: {}", e))?;
        return Ok(ProfileResponse::from(current_profile));
    }

    // Always update the updated_at timestamp
    let timestamps = crate::utils::Timestamps::for_update(
        current_profile.created_at.unwrap_or_else(crate::utils::now),
    );
    separated.push("updated_at = ");
    separated.push_bind(timestamps.updated_at);

    // Complete the query
    query_builder.push(" WHERE id = ");
    query_builder.push_bind(&id);

    // Execute the update
    query_builder
        .build()
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to update profile: {}", e))?;

    // Get the updated profile
    let updated_profile = sqlx::query_as!(
        Profile,
        r#"SELECT 
            id as "id!: String", 
            name as "name!: String", 
            password as "password!: String", 
            avatar_path, 
            settings as "settings!: JsonValue",
            created_at, 
            updated_at 
        FROM profiles WHERE id = ?"#,
        id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("Database error: {}", e))?
    .ok_or_else(|| "Profile updated but could not be retrieved".to_string())?;

    // Commit the transaction
    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(ProfileResponse::from(updated_profile))
}

/// Delete a profile
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The profile ID to delete
///
/// # Returns
/// * `Result<(), String>` - Success or an error message
#[tauri::command]
pub async fn delete_profile(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let pool = &state.pool;

    match sqlx::query("DELETE FROM profiles WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
    {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to delete profile: {}", e)),
    }
}
