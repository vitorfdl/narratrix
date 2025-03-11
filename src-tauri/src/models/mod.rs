use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::State;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::AppState;

pub mod manifest;
use manifest::{ManifestManager, ModelManifest};

/// Model type enumeration
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ModelType {
    Text,
    Audio,
    Image,
}

impl ToString for ModelType {
    fn to_string(&self) -> String {
        match self {
            ModelType::Text => "text".to_string(),
            ModelType::Audio => "audio".to_string(),
            ModelType::Image => "image".to_string(),
        }
    }
}

impl TryFrom<String> for ModelType {
    type Error = String;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "text" => Ok(ModelType::Text),
            "audio" => Ok(ModelType::Audio),
            "image" => Ok(ModelType::Image),
            _ => Err(format!("Invalid model type: {}", s)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub model_type: String,
    pub model_origin: String,
    pub config: String,
    pub created_at: Option<OffsetDateTime>,
    pub updated_at: Option<OffsetDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct NewModel {
    pub profile_id: String,
    pub name: String,
    pub model_type: String,
    pub model_origin: String,
    pub config: String,
}

/// Validate a JSON string to ensure it's valid JSON
fn validate_json(json_str: &str) -> Result<(), String> {
    match serde_json::from_str::<JsonValue>(json_str) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Invalid JSON in config field: {}", e)),
    }
}

/// Create a new model
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `model` - The model data to create
///
/// # Returns
/// * `Result<Model, String>` - The created model or an error message
#[tauri::command]
pub async fn create_model(state: State<'_, AppState>, model: NewModel) -> Result<Model, String> {
    // Validate the model type
    match model.model_type.clone().try_into() as Result<ModelType, String> {
        Ok(_) => {}
        Err(e) => return Err(e),
    }

    // Validate the JSON config
    validate_json(&model.config)?;

    // Validate the model origin and config against the manifest
    let manifest_manager = ManifestManager::new(&state.app_handle)?;
    manifest_manager.validate_config(&model.model_origin, &model.config)?;

    let pool = &state.pool;
    let id = Uuid::new_v4().to_string();
    let now = OffsetDateTime::now_utc();

    match sqlx::query(
        "INSERT INTO models (id, profile_id, name, type, model_origin, config, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&model.profile_id)
    .bind(&model.name)
    .bind(&model.model_type)
    .bind(&model.model_origin)
    .bind(&model.config)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    {
        Ok(_) => Ok(Model {
            id,
            profile_id: model.profile_id,
            name: model.name,
            model_type: model.model_type,
            model_origin: model.model_origin,
            config: model.config,
            created_at: Some(now),
            updated_at: Some(now),
        }),
        Err(e) => Err(format!("Failed to create model: {}", e)),
    }
}

/// Get all models for a profile
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `profile_id` - The profile ID to get models for
///
/// # Returns
/// * `Result<Vec<Model>, String>` - The list of models or an error message
#[tauri::command]
pub async fn get_models_by_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<Model>, String> {
    let pool = &state.pool;

    match sqlx::query_as!(
        Model,
        r#"SELECT id as "id!", profile_id as "profile_id!", name as "name!", 
           type as "model_type!", model_origin as "model_origin!", config as "config!", 
           created_at, updated_at 
           FROM models WHERE profile_id = ?"#,
        profile_id
    )
    .fetch_all(pool)
    .await
    {
        Ok(models) => Ok(models),
        Err(e) => Err(format!("Failed to get models: {}", e)),
    }
}

/// Get models by type for a profile
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `profile_id` - The profile ID to get models for
/// * `model_type` - The model type to filter by
///
/// # Returns
/// * `Result<Vec<Model>, String>` - The list of models or an error message
#[tauri::command]
pub async fn get_models_by_type(
    state: State<'_, AppState>,
    profile_id: String,
    model_type: String,
) -> Result<Vec<Model>, String> {
    // Validate the model type
    match model_type.clone().try_into() as Result<ModelType, String> {
        Ok(_) => {}
        Err(e) => return Err(e),
    }

    let pool = &state.pool;

    match sqlx::query_as!(
        Model,
        r#"SELECT id as "id!", profile_id as "profile_id!", name as "name!", 
           type as "model_type!", model_origin as "model_origin!", config as "config!", 
           created_at, updated_at 
           FROM models WHERE profile_id = ? AND type = ?"#,
        profile_id,
        model_type
    )
    .fetch_all(pool)
    .await
    {
        Ok(models) => Ok(models),
        Err(e) => Err(format!("Failed to get models: {}", e)),
    }
}

/// Get a model by ID
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The model ID to look up
///
/// # Returns
/// * `Result<Option<Model>, String>` - The model if found, None if not found, or an error message
#[tauri::command]
pub async fn get_model_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Model>, String> {
    let pool = &state.pool;

    match sqlx::query_as!(
        Model,
        r#"SELECT id as "id!", profile_id as "profile_id!", name as "name!", 
           type as "model_type!", model_origin as "model_origin!", config as "config!", 
           created_at, updated_at 
           FROM models WHERE id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await
    {
        Ok(model) => Ok(model),
        Err(e) => Err(format!("Failed to get model: {}", e)),
    }
}

/// Update a model
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The model ID to update
/// * `model` - The updated model data
///
/// # Returns
/// * `Result<Model, String>` - The updated model or an error message
#[tauri::command]
pub async fn update_model(
    state: State<'_, AppState>,
    id: String,
    model: NewModel,
) -> Result<Model, String> {
    // Validate the model type
    match model.model_type.clone().try_into() as Result<ModelType, String> {
        Ok(_) => {}
        Err(e) => return Err(e),
    }

    // Validate the JSON config
    validate_json(&model.config)?;

    // Validate the model origin and config against the manifest
    let manifest_manager = ManifestManager::new(&state.app_handle)?;
    manifest_manager.validate_config(&model.model_origin, &model.config)?;

    let pool = &state.pool;
    let now = OffsetDateTime::now_utc();

    match sqlx::query(
        "UPDATE models SET name = ?, type = ?, model_origin = ?, config = ?, updated_at = ? 
         WHERE id = ? AND profile_id = ?",
    )
    .bind(&model.name)
    .bind(&model.model_type)
    .bind(&model.model_origin)
    .bind(&model.config)
    .bind(now)
    .bind(&id)
    .bind(&model.profile_id)
    .execute(pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err("Model not found or you don't have permission to update it".to_string());
            }

            match get_model_by_id(state, id).await {
                Ok(Some(updated_model)) => Ok(updated_model),
                Ok(None) => Err("Model updated but could not be retrieved".to_string()),
                Err(e) => Err(e),
            }
        }
        Err(e) => Err(format!("Failed to update model: {}", e)),
    }
}

/// Delete a model
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The model ID to delete
/// * `profile_id` - The profile ID that owns the model (for security check)
///
/// # Returns
/// * `Result<(), String>` - Success or an error message
#[tauri::command]
pub async fn delete_model(
    state: State<'_, AppState>,
    id: String,
    profile_id: String,
) -> Result<(), String> {
    let pool = &state.pool;

    match sqlx::query("DELETE FROM models WHERE id = ? AND profile_id = ?")
        .bind(&id)
        .bind(&profile_id)
        .execute(pool)
        .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err("Model not found or you don't have permission to delete it".to_string());
            }
            Ok(())
        }
        Err(e) => Err(format!("Failed to delete model: {}", e)),
    }
}
