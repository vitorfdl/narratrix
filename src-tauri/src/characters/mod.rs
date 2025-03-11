use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use time::OffsetDateTime;

use crate::AppState;

/// Character type enumeration
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum CharacterType {
    Agent,
    Character,
}

impl ToString for CharacterType {
    fn to_string(&self) -> String {
        match self {
            CharacterType::Agent => "agent".to_string(),
            CharacterType::Character => "character".to_string(),
        }
    }
}

impl TryFrom<String> for CharacterType {
    type Error = String;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "agent" => Ok(CharacterType::Agent),
            "character" => Ok(CharacterType::Character),
            _ => Err(format!("Invalid character type: {}", s)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub character_type: String,
    pub avatar_path: Option<String>,
    pub expressions: Option<String>,
    pub personality: Option<String>,
    pub system_override: Option<String>,
    pub created_at: Option<OffsetDateTime>,
    pub updated_at: Option<OffsetDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct NewCharacter {
    pub profile_id: String,
    pub name: String,
    pub character_type: String,
    pub avatar_path: Option<String>,
    pub expressions: Option<String>,
    pub personality: Option<String>,
    pub system_override: Option<String>,
}

/// Create a new character
/// 
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `character` - The character data to create
/// 
/// # Returns
/// * `Result<Character, String>` - The created character or an error message
#[tauri::command]
pub async fn create_character(
    state: State<'_, AppState>,
    character: NewCharacter,
) -> Result<Character, String> {
    // Validate the character type
    match character.character_type.clone().try_into() as Result<CharacterType, String> {
        Ok(_) => {},
        Err(e) => return Err(e),
    }

    let pool = &state.pool;
    let id = Uuid::new_v4().to_string();
    let now = OffsetDateTime::now_utc();

    match sqlx::query(
        "INSERT INTO characters (id, profile_id, name, type, avatar_path, expressions, personality, system_override, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&character.profile_id)
    .bind(&character.name)
    .bind(&character.character_type)
    .bind(&character.avatar_path)
    .bind(&character.expressions)
    .bind(&character.personality)
    .bind(&character.system_override)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    {
        Ok(_) => Ok(Character {
            id,
            profile_id: character.profile_id,
            name: character.name,
            character_type: character.character_type,
            avatar_path: character.avatar_path,
            expressions: character.expressions,
            personality: character.personality,
            system_override: character.system_override,
            created_at: Some(now),
            updated_at: Some(now),
        }),
        Err(e) => Err(format!("Failed to create character: {}", e)),
    }
}

/// Get all characters for a profile
/// 
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `profile_id` - The profile ID to get characters for
/// 
/// # Returns
/// * `Result<Vec<Character>, String>` - The list of characters or an error message
#[tauri::command]
pub async fn get_characters_by_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<Character>, String> {
    let pool = &state.pool;
    
    match sqlx::query_as!(
        Character,
        r#"SELECT id, profile_id, name, type as "character_type", 
           avatar_path, expressions, personality, system_override, created_at, updated_at 
           FROM characters WHERE profile_id = ?"#,
        profile_id
    )
    .fetch_all(pool)
    .await
    {
        Ok(characters) => Ok(characters),
        Err(e) => Err(format!("Failed to get characters: {}", e)),
    }
}

/// Get characters by type for a profile
/// 
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `profile_id` - The profile ID to get characters for
/// * `character_type` - The character type to filter by
/// 
/// # Returns
/// * `Result<Vec<Character>, String>` - The list of characters or an error message
#[tauri::command]
pub async fn get_characters_by_type(
    state: State<'_, AppState>,
    profile_id: String,
    character_type: String,
) -> Result<Vec<Character>, String> {
    // Validate the character type
    match character_type.clone().try_into() as Result<CharacterType, String> {
        Ok(_) => {},
        Err(e) => return Err(e),
    }

    let pool = &state.pool;
    
    match sqlx::query_as!(
        Character,
        r#"SELECT id, profile_id, name, type as "character_type", 
           avatar_path, expressions, personality, system_override, created_at, updated_at 
           FROM characters WHERE profile_id = ? AND type = ?"#,
        profile_id,
        character_type
    )
    .fetch_all(pool)
    .await
    {
        Ok(characters) => Ok(characters),
        Err(e) => Err(format!("Failed to get characters: {}", e)),
    }
}

/// Get a character by ID
/// 
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The character ID to look up
/// 
/// # Returns
/// * `Result<Option<Character>, String>` - The character if found, None if not found, or an error message
#[tauri::command]
pub async fn get_character_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Character>, String> {
    let pool = &state.pool;
    
    match sqlx::query_as!(
        Character,
        r#"SELECT id, profile_id, name, type as "character_type", 
           avatar_path, expressions, personality, system_override, created_at, updated_at 
           FROM characters WHERE id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await
    {
        Ok(character) => Ok(character),
        Err(e) => Err(format!("Failed to get character: {}", e)),
    }
}

/// Update a character
/// 
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The character ID to update
/// * `character` - The updated character data
/// 
/// # Returns
/// * `Result<Character, String>` - The updated character or an error message
#[tauri::command]
pub async fn update_character(
    state: State<'_, AppState>,
    id: String,
    character: NewCharacter,
) -> Result<Character, String> {
    // Validate the character type
    match character.character_type.clone().try_into() as Result<CharacterType, String> {
        Ok(_) => {},
        Err(e) => return Err(e),
    }

    let pool = &state.pool;
    let now = OffsetDateTime::now_utc();
    
    match sqlx::query(
        "UPDATE characters 
         SET name = ?, type = ?, avatar_path = ?, expressions = ?, personality = ?, system_override = ?, updated_at = ? 
         WHERE id = ? AND profile_id = ?"
    )
    .bind(&character.name)
    .bind(&character.character_type)
    .bind(&character.avatar_path)
    .bind(&character.expressions)
    .bind(&character.personality)
    .bind(&character.system_override)
    .bind(now)
    .bind(&id)
    .bind(&character.profile_id)
    .execute(pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err("Character not found or you don't have permission to update it".to_string());
            }
            
            match get_character_by_id(state, id).await {
                Ok(Some(updated_character)) => Ok(updated_character),
                Ok(None) => Err("Character updated but could not be retrieved".to_string()),
                Err(e) => Err(e),
            }
        },
        Err(e) => Err(format!("Failed to update character: {}", e)),
    }
}

/// Delete a character
/// 
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The character ID to delete
/// * `profile_id` - The profile ID that owns the character (for security check)
/// 
/// # Returns
/// * `Result<(), String>` - Success or an error message
#[tauri::command]
pub async fn delete_character(
    state: State<'_, AppState>,
    id: String,
    profile_id: String,
) -> Result<(), String> {
    let pool = &state.pool;
    
    match sqlx::query("DELETE FROM characters WHERE id = ? AND profile_id = ?")
        .bind(&id)
        .bind(&profile_id)
        .execute(pool)
        .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err("Character not found or you don't have permission to delete it".to_string());
            }
            Ok(())
        },
        Err(e) => Err(format!("Failed to delete character: {}", e)),
    }
}
