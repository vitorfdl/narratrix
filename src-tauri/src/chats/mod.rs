use serde::{Deserialize, Serialize};
use tauri::State;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::AppState;

/// Message type enumeration
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    System,
    User,
    Assistant,
    Character,
}

impl ToString for MessageType {
    fn to_string(&self) -> String {
        match self {
            MessageType::System => "system".to_string(),
            MessageType::User => "user".to_string(),
            MessageType::Assistant => "assistant".to_string(),
            MessageType::Character => "character".to_string(),
        }
    }
}

impl TryFrom<String> for MessageType {
    type Error = String;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "system" => Ok(MessageType::System),
            "user" => Ok(MessageType::User),
            "assistant" => Ok(MessageType::Assistant),
            "character" => Ok(MessageType::Character),
            _ => Err(format!("Invalid message type: {}", s)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Chat {
    pub id: String,
    pub profile_id: String,
    pub title: String,
    pub created_at: Option<OffsetDateTime>,
    pub updated_at: Option<OffsetDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct NewChat {
    pub profile_id: String,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub character_id: Option<String>,
    pub message_type: String,
    pub content: String,
    pub metadata: Option<String>,
    pub created_at: Option<OffsetDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct NewMessage {
    pub chat_id: String,
    pub character_id: Option<String>,
    pub message_type: String,
    pub content: String,
    pub metadata: Option<String>,
}

/// Create a new chat
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `chat` - The chat data to create
///
/// # Returns
/// * `Result<Chat, String>` - The created chat or an error message
#[tauri::command]
pub async fn create_chat(state: State<'_, AppState>, chat: NewChat) -> Result<Chat, String> {
    let pool = &state.pool;
    let id = Uuid::new_v4().to_string();
    let now = OffsetDateTime::now_utc();

    match sqlx::query(
        "INSERT INTO chats (id, profile_id, title, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&chat.profile_id)
    .bind(&chat.title)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    {
        Ok(_) => Ok(Chat {
            id,
            profile_id: chat.profile_id,
            title: chat.title,
            created_at: Some(now),
            updated_at: Some(now),
        }),
        Err(e) => Err(format!("Failed to create chat: {}", e)),
    }
}

/// Get all chats for a profile
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `profile_id` - The profile ID to get chats for
///
/// # Returns
/// * `Result<Vec<Chat>, String>` - The list of chats or an error message
#[tauri::command]
pub async fn get_chats_by_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<Chat>, String> {
    let pool = &state.pool;

    match sqlx::query_as!(
        Chat,
        r#"SELECT id as "id!", profile_id as "profile_id!", title as "title!", created_at, updated_at 
         FROM chats WHERE profile_id = ? ORDER BY updated_at DESC"#,
        profile_id
    )
    .fetch_all(pool)
    .await
    {
        Ok(chats) => Ok(chats),
        Err(e) => Err(format!("Failed to get chats: {}", e)),
    }
}

/// Get a chat by ID
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The chat ID to look up
///
/// # Returns
/// * `Result<Option<Chat>, String>` - The chat if found, None if not found, or an error message
#[tauri::command]
pub async fn get_chat_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Chat>, String> {
    let pool = &state.pool;

    match sqlx::query_as!(
        Chat,
        r#"SELECT id as "id!", profile_id as "profile_id!", title as "title!", created_at, updated_at 
         FROM chats WHERE id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await
    {
        Ok(chat) => Ok(chat),
        Err(e) => Err(format!("Failed to get chat: {}", e)),
    }
}

/// Update a chat
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The chat ID to update
/// * `title` - The new title for the chat
/// * `profile_id` - The profile ID that owns the chat (for security check)
///
/// # Returns
/// * `Result<Chat, String>` - The updated chat or an error message
#[tauri::command]
pub async fn update_chat(
    state: State<'_, AppState>,
    id: String,
    title: String,
    profile_id: String,
) -> Result<Chat, String> {
    let pool = &state.pool;
    let now = OffsetDateTime::now_utc();

    match sqlx::query(
        "UPDATE chats SET title = ?, updated_at = ? 
         WHERE id = ? AND profile_id = ?",
    )
    .bind(&title)
    .bind(now)
    .bind(&id)
    .bind(&profile_id)
    .execute(pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err("Chat not found or you don't have permission to update it".to_string());
            }

            match get_chat_by_id(state, id).await {
                Ok(Some(updated_chat)) => Ok(updated_chat),
                Ok(None) => Err("Chat updated but could not be retrieved".to_string()),
                Err(e) => Err(e),
            }
        }
        Err(e) => Err(format!("Failed to update chat: {}", e)),
    }
}

/// Delete a chat
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The chat ID to delete
/// * `profile_id` - The profile ID that owns the chat (for security check)
///
/// # Returns
/// * `Result<(), String>` - Success or an error message
#[tauri::command]
pub async fn delete_chat(
    state: State<'_, AppState>,
    id: String,
    profile_id: String,
) -> Result<(), String> {
    let pool = &state.pool;

    // First delete all messages in the chat (cascade doesn't work with SQLite in SQLx)
    match sqlx::query("DELETE FROM messages WHERE chat_id = ?")
        .bind(&id)
        .execute(pool)
        .await
    {
        Ok(_) => {}
        Err(e) => return Err(format!("Failed to delete chat messages: {}", e)),
    }

    // Then delete the chat
    match sqlx::query("DELETE FROM chats WHERE id = ? AND profile_id = ?")
        .bind(&id)
        .bind(&profile_id)
        .execute(pool)
        .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err("Chat not found or you don't have permission to delete it".to_string());
            }
            Ok(())
        }
        Err(e) => Err(format!("Failed to delete chat: {}", e)),
    }
}

/// Add a message to a chat
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `message` - The message data to add
///
/// # Returns
/// * `Result<Message, String>` - The created message or an error message
#[tauri::command]
pub async fn add_message(
    state: State<'_, AppState>,
    message: NewMessage,
) -> Result<Message, String> {
    // Validate the message type
    match message.message_type.clone().try_into() as Result<MessageType, String> {
        Ok(_) => {}
        Err(e) => return Err(e),
    }

    let pool = &state.pool;
    let id = Uuid::new_v4().to_string();
    let now = OffsetDateTime::now_utc();

    // First update the chat's updated_at timestamp
    match sqlx::query("UPDATE chats SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&message.chat_id)
        .execute(pool)
        .await
    {
        Ok(_) => {}
        Err(e) => return Err(format!("Failed to update chat timestamp: {}", e)),
    }

    // Then insert the message
    match sqlx::query(
        "INSERT INTO messages (id, chat_id, character_id, type, content, metadata, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&message.chat_id)
    .bind(&message.character_id)
    .bind(&message.message_type)
    .bind(&message.content)
    .bind(&message.metadata)
    .bind(now)
    .execute(pool)
    .await
    {
        Ok(_) => Ok(Message {
            id,
            chat_id: message.chat_id,
            character_id: message.character_id,
            message_type: message.message_type,
            content: message.content,
            metadata: message.metadata,
            created_at: Some(now),
        }),
        Err(e) => Err(format!("Failed to add message: {}", e)),
    }
}

/// Get messages for a chat
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `chat_id` - The chat ID to get messages for
/// * `limit` - Optional limit on number of messages to retrieve
/// * `offset` - Optional offset for pagination
///
/// # Returns
/// * `Result<Vec<Message>, String>` - The list of messages or an error message
#[tauri::command]
pub async fn get_messages(
    state: State<'_, AppState>,
    chat_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Message>, String> {
    let pool = &state.pool;

    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    match sqlx::query_as!(
        Message,
        r#"SELECT id as "id!", chat_id as "chat_id!", character_id, type as "message_type!", message as "content!", expression as metadata, created_at 
           FROM messages 
           WHERE chat_id = ? 
           ORDER BY created_at ASC 
           LIMIT ? OFFSET ?"#,
        chat_id,
        limit,
        offset
    )
    .fetch_all(pool)
    .await
    {
        Ok(messages) => Ok(messages),
        Err(e) => Err(format!("Failed to get messages: {}", e)),
    }
}

/// Delete a message
///
/// # Arguments
/// * `state` - The application state containing the database pool
/// * `id` - The message ID to delete
/// * `chat_id` - The chat ID that the message belongs to (for security check)
///
/// # Returns
/// * `Result<(), String>` - Success or an error message
#[tauri::command]
pub async fn delete_message(
    state: State<'_, AppState>,
    id: String,
    chat_id: String,
) -> Result<(), String> {
    let pool = &state.pool;

    match sqlx::query("DELETE FROM messages WHERE id = ? AND chat_id = ?")
        .bind(&id)
        .bind(&chat_id)
        .execute(pool)
        .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err("Message not found or doesn't belong to the specified chat".to_string());
            }
            Ok(())
        }
        Err(e) => Err(format!("Failed to delete message: {}", e)),
    }
}
