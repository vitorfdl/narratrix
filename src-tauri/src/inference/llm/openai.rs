use crate::inference::{InferenceRequest, ModelSpecs};
use anyhow::{anyhow, Context, Result};
use async_openai::{
    error::OpenAIError,
    types::{
        ChatCompletionRequestAssistantMessage, ChatCompletionRequestAssistantMessageContent,
        ChatCompletionRequestMessage, ChatCompletionRequestSystemMessage,
        ChatCompletionRequestSystemMessageContent, ChatCompletionRequestUserMessage,
        ChatCompletionRequestUserMessageContent,
    },
    Client,
};
use futures::StreamExt;
use futures_core::Stream;
use serde_json::{json, Value};
use std::{collections::HashMap, pin::Pin};

// Type aliases for BYOT responses
type OpenAIValue = Value;
type OpenAIStream = Pin<Box<dyn Stream<Item = Result<OpenAIValue, OpenAIError>> + Send>>;

// Initialize OpenAI client with credentials from model specs
pub fn initialize_openai_client(
    specs: &ModelSpecs,
) -> Result<(Client<async_openai::config::OpenAIConfig>, String)> {
    // Extract config from the model specs
    let config = &specs.config;
    let engine = &specs.engine;

    // Get model with fallback
    let model = config["model"].as_str().unwrap_or("").to_string();

    // Get API key and base URL with fallbacks
    let encrypted_api_key = config["api_key"].as_str().unwrap_or("").to_string();
    let api_key = if !encrypted_api_key.is_empty() {
        match crate::utils::decrypt_api_key(&encrypted_api_key) {
            Ok(decrypted) => decrypted,
            Err(_) => encrypted_api_key.to_string(),
        }
    } else {
        "".to_string()
    };

    let base_url = config["base_url"]
        .as_str()
        .unwrap_or("https://api.openai.com/v1")
        .to_string();

    // Create a client builder
    let mut builder = async_openai::config::OpenAIConfig::new();

    if engine == "anthropic" {
        let mut headers_map = HashMap::new();
        headers_map.insert("anthropic-version".to_string(), "2023-06-01".to_string());
        builder = builder.with_headers(headers_map);
    }

    // Set API key if provided
    if !api_key.is_empty() {
        builder = builder.with_api_key(api_key);
    }

    // Set base URL if different from default
    if base_url != "https://api.openai.com/v1" {
        builder = builder.with_api_base(base_url);
    }

    // Create the client
    let client = Client::with_config(builder);

    Ok((client, model))
}

// Convert messages from our format to async-openai format
pub fn openai_prepare_messages(
    request: &InferenceRequest,
) -> Result<Vec<ChatCompletionRequestMessage>> {
    let mut messages = Vec::new();

    // Add system prompt if provided
    if let Some(system_prompt) = &request.system_prompt {
        let system_message = ChatCompletionRequestSystemMessage {
            content: ChatCompletionRequestSystemMessageContent::Text(system_prompt.clone()),
            name: None,
        };
        messages.push(ChatCompletionRequestMessage::System(system_message));
    }

    // Add messages from request
    for msg in &request.message_list {
        // Convert role string to appropriate message type
        let message = match msg.role.as_str() {
            "user" => {
                let user_message = ChatCompletionRequestUserMessage {
                    content: ChatCompletionRequestUserMessageContent::Text(msg.text.clone()),
                    name: None,
                };
                ChatCompletionRequestMessage::User(user_message)
            }
            "assistant" => {
                let assistant_message = ChatCompletionRequestAssistantMessage {
                    content: Some(ChatCompletionRequestAssistantMessageContent::Text(
                        msg.text.clone(),
                    )),
                    name: None,
                    function_call: None,
                    tool_calls: None,
                    refusal: None,
                    audio: None,
                };
                ChatCompletionRequestMessage::Assistant(assistant_message)
            }
            "system" => {
                let system_message = ChatCompletionRequestSystemMessage {
                    content: ChatCompletionRequestSystemMessageContent::Text(msg.text.clone()),
                    name: None,
                };
                ChatCompletionRequestMessage::System(system_message)
            }
            _ => return Err(anyhow!("Invalid role: {}", msg.role)),
        };

        messages.push(message);
    }

    Ok(messages)
}

// Creates a JSON request payload using the BYOT approach
fn create_chat_completion_payload(
    model: &str,
    messages: Vec<ChatCompletionRequestMessage>,
    request: &InferenceRequest,
) -> Result<serde_json::Value> {
    // Serialize messages to JSON
    let messages_json = serde_json::to_value(messages)
        .map_err(|e| anyhow!("Failed to serialize messages: {}", e))?;

    // Start with basic parameters
    let mut payload = json!({
        "model": model,
        "messages": messages_json
    });

    // Apply all parameters from the request.parameters
    if let Some(obj) = request.parameters.as_object() {
        for (key, value) in obj {
            // Rename max_completion_tokens to max_tokens if needed
            if key == "max_completion_tokens" {
                payload["max_tokens"] = value.clone();
            } else {
                payload[key] = value.clone();
            }
        }
    }

    // Pretty print payload for debugging if needed
    let pretty_params = serde_json::to_string_pretty(&payload)
        .map_err(|e| anyhow!("Failed to pretty print payload: {}", e))?;
    println!("Chat completion payload:\n{}", pretty_params);

    Ok(payload)
}

/// OpenAI-compatible client for inference
///
/// This function handles non-streaming inference requests.
pub async fn converse(request: &InferenceRequest, specs: &ModelSpecs) -> Result<String> {
    // Initialize client
    let (client, model) = initialize_openai_client(specs)?;

    // Prepare messages
    let messages = openai_prepare_messages(request)?;

    // Create JSON payload
    let payload = create_chat_completion_payload(&model, messages, request)?;

    // Send the request using BYOT approach
    let response: OpenAIValue = client
        .chat()
        .create_byot(payload)
        .await
        .context("Failed to create chat completion")?;

    // Extract and return the response text
    match response["choices"][0]["message"]["content"].as_str() {
        Some(content) => Ok(content.to_string()),
        None => Err(anyhow!("No content in response")),
    }
}

/// OpenAI-compatible client for streaming inference
///
/// This function handles streaming inference requests.
/// It invokes a callback function for each chunk received.
pub async fn converse_stream(
    request: &InferenceRequest,
    specs: &ModelSpecs,
    callback: impl Fn(serde_json::Value) -> Result<()> + Send + 'static,
) -> Result<()> {
    // Initialize client
    let (client, model) = initialize_openai_client(specs)?;

    // Prepare messages
    let messages = openai_prepare_messages(request)?;

    // Create JSON payload
    let mut payload = create_chat_completion_payload(&model, messages, request)?;

    // Set stream to true for streaming
    payload["stream"] = json!(true);

    // Send the streaming request using BYOT approach
    let mut stream: OpenAIStream = client
        .chat()
        .create_stream_byot(payload)
        .await
        .context("Failed to create streaming chat completion")?;

    // Process each chunk as it arrives
    loop {
        match tokio::time::timeout(std::time::Duration::from_secs(120), stream.next()).await {
            Ok(Some(Ok(chunk))) => {
                // Extract reasoning content if present
                if let Some(reasoning) = chunk["choices"][0]["delta"]["reasoning"].as_str() {
                    if !reasoning.is_empty() {
                        let payload = json!({
                            "type": "reasoning",
                            "value": reasoning
                        });
                        callback(payload)?;
                    }
                }

                // Extract text content if present
                let text_opt = chunk
                    .get("choices")
                    .and_then(|choices| choices.get(0))
                    .and_then(|choice| choice.get("text"))
                    .and_then(|text| text.as_str());

                let text_fallback = chunk.get("content").and_then(|v| v.as_str());

                if let Some(text) = text_opt.or(text_fallback) {
                    if !text.is_empty() {
                        let payload = json!({
                            "type": "text",
                            "value": text
                        });
                        if let Err(e) = callback(payload) {
                            println!("[Streaming Error] Callback failed: {e}");
                            return Err(anyhow!("Callback failed: {e}"));
                        }
                    }
                    // If text is empty, just skip without warning
                } else {
                    // Only log if neither field is present
                    println!("[Streaming Warning] Unexpected chunk structure: {}", chunk);
                }

                // Add a small delay between tokens if specified
                let delay_ms = request
                    .parameters
                    .get("stream_delay_ms")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(10); // Default 10ms delay

                if delay_ms > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                }
            }
            Ok(Some(Err(e))) => {
                return Err(anyhow!("Error: {}", e));
            }
            Ok(None) => break, // Stream has ended
            Err(_) => return Err(anyhow!("Stream timeout after 120 seconds")),
        }
    }

    Ok(())
}

// Creates a JSON payload for completion requests
fn create_completion_payload(
    model: &str,
    prompt: &str,
    request: &InferenceRequest,
) -> Result<serde_json::Value> {
    // Start with basic parameters
    let mut payload = json!({
        "model": model,
        "prompt": prompt
    });

    // Apply all parameters from the request.parameters
    if let Some(obj) = request.parameters.as_object() {
        for (key, value) in obj {
            payload[key] = value.clone();
        }
    }

    // Pretty print payload for debugging if needed
    // let pretty_params = serde_json::to_string_pretty(&payload)
    //     .map_err(|e| anyhow!("Failed to pretty print payload: {}", e))?;
    // println!("Completion payload:\n{}", pretty_params);

    Ok(payload)
}

/// OpenAI-compatible client for completions
///
/// This function handles non-streaming completion requests.
pub async fn complete(request: &InferenceRequest, specs: &ModelSpecs) -> Result<String> {
    // Initialize client
    let (client, model) = initialize_openai_client(specs)?;

    let prompt = request
        .message_list
        .last()
        .map(|msg| msg.text.clone())
        .ok_or_else(|| anyhow!("No prompt found in request"))?;

    // Create JSON payload
    let payload = create_completion_payload(&model, &prompt, request)?;
    println!(
        "Completion payload:\n{}",
        serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
    );
    // Send the request using BYOT approach
    let response: OpenAIValue = client
        .completions()
        .create_byot(payload)
        .await
        .context("Failed to create completion")?;

    // Extract and return the response text
    match response["content"].as_str() {
        Some(content) => Ok(content.to_string()),
        None => Err(anyhow!("No text in response")),
    }
}

/// OpenAI-compatible client for streaming completions
///
/// This function handles streaming completion requests.
/// It invokes a callback function for each chunk received.
pub async fn complete_stream(
    request: &InferenceRequest,
    specs: &ModelSpecs,
    callback: impl Fn(serde_json::Value) -> Result<()> + Send + 'static,
) -> Result<()> {
    println!(
        "Starting OpenAI streaming completion with parameters: {}",
        serde_json::to_string_pretty(&request.parameters).unwrap_or_else(|_| "{}".to_string())
    );

    // Initialize client
    let (client, model) = initialize_openai_client(specs)?;

    // Extract prompt from the request (Completions only use the last message)
    let prompt = request
        .message_list
        .last()
        .map(|msg| msg.text.clone())
        .ok_or_else(|| anyhow!("No prompt found in request"))?;

    // Create JSON payload
    let mut payload = create_completion_payload(&model, &prompt, request)?;

    // Set stream to true for streaming
    payload["stream"] = json!(true);

    // Send the streaming request using BYOT approach
    let mut stream: OpenAIStream = client
        .completions()
        .create_stream_byot(payload)
        .await
        .context("Failed to create streaming completion")?;

    // Process each chunk as it arrives
    loop {
        match tokio::time::timeout(std::time::Duration::from_secs(120), stream.next()).await {
            Ok(Some(Ok(chunk))) => {
                // Try OpenAI format first
                let text_opt = chunk
                    .get("choices")
                    .and_then(|choices| choices.get(0))
                    .and_then(|choice| choice.get("text"))
                    .and_then(|text| text.as_str());

                // Fallback: try local format with 'content' field
                let text_fallback = chunk.get("content").and_then(|v| v.as_str());

                if let Some(text) = text_opt.or(text_fallback) {
                    if !text.is_empty() {
                        let payload = json!({
                            "type": "text",
                            "value": text
                        });
                        if let Err(e) = callback(payload) {
                            println!("[Streaming Error] Callback failed: {e}");
                            return Err(anyhow!("Callback failed: {e}"));
                        }
                    }
                    // If text is empty, just skip without warning
                } else {
                    // Only log if neither field is present
                    println!("[Streaming Warning] Unexpected chunk structure: {}", chunk);
                }

                // Add a small delay between tokens if specified
                let delay_ms = request
                    .parameters
                    .get("stream_delay_ms")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(15); // Default 10ms delay

                if delay_ms > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                }
            }
            Ok(Some(Err(e))) => {
                println!("[Streaming Error] Error in stream chunk: {e}");
                return Err(anyhow!("Error in stream chunk: {e}"));
            }
            Ok(None) => break, // Stream has ended
            Err(_) => {
                println!("[Streaming Error] Stream timeout after 120 seconds");
                return Err(anyhow!("Stream timeout after 120 seconds"));
            }
        }
    }

    Ok(())
}
