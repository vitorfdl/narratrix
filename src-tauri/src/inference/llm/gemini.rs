use crate::inference::llm::gemini_types::{
    GeminiChatCompletionResponseStream, GeminiCreateChatCompletionResponse,
};
use crate::inference::{InferenceRequest, ModelSpecs};
use anyhow::{anyhow, Context, Result};
use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestAssistantMessage, ChatCompletionRequestAssistantMessageContent,
        ChatCompletionRequestMessage, ChatCompletionRequestSystemMessage,
        ChatCompletionRequestSystemMessageContent, ChatCompletionRequestUserMessage,
        ChatCompletionRequestUserMessageContent, CreateChatCompletionRequest,
        CreateChatCompletionRequestArgs,
    },
    Client,
};
use futures::StreamExt;
use std::collections::HashMap;

// Default Gemini API base URL
const GEMINI_DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/openai";

// Initialize Gemini client with credentials from model specs
fn initialize_gemini_client(specs: &ModelSpecs) -> Result<(Client<OpenAIConfig>, String)> {
    let config = &specs.config;

    // Get model from specs or use a default
    let model = config["model"]
        .as_str()
        .unwrap_or("gemini-1.5-flash") // Default Gemini model
        .to_string();

    // Get API key (required for Gemini)
    let encrypted_api_key = config["api_key"]
        .as_str()
        .ok_or_else(|| anyhow!("Gemini API key ('api_key') is required in model configuration"))?
        .to_string();
    let api_key = if !encrypted_api_key.is_empty() {
        match crate::utils::decrypt_api_key(&encrypted_api_key) {
            Ok(decrypted) => decrypted,
            Err(_) => encrypted_api_key.to_string(),
        }
    } else {
        "".to_string()
    };

    // Get base URL or use the default Gemini URL
    let base_url = config["base_url"]
        .as_str()
        .unwrap_or(GEMINI_DEFAULT_BASE_URL)
        .trim_end_matches('/') // Ensure no trailing slash
        .to_string();

    // Create a client builder
    let mut builder = OpenAIConfig::new()
        .with_api_key(api_key)
        .with_api_base(base_url);

    // Add any custom headers if specified in config
    if let Some(headers_val) = config.get("headers") {
        if let Some(headers_map) = headers_val.as_object() {
            let headers: HashMap<String, String> = headers_map
                .iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect();
            if !headers.is_empty() {
                builder = builder.with_headers(headers);
            }
        }
    }

    // Create the client
    let client = Client::with_config(builder);

    Ok((client, model))
}

// Convert messages from our format to async-openai format (reused from OpenAI)
// This function might need adjustments if Gemini's BYOT endpoint expects
// a slightly different message structure, but typically it aims for compatibility.
fn gemini_prepare_messages(
    request: &InferenceRequest,
) -> Result<Vec<ChatCompletionRequestMessage>> {
    let mut messages = Vec::new();

    // Add system prompt if provided
    if let Some(system_prompt) = &request.system_prompt {
        // Gemini API might handle system prompts differently or not at all in the same way.
        // Often, it's included as the first user message or handled via specific API params.
        // For BYOT, we assume compatibility for now.
        let system_message = ChatCompletionRequestSystemMessage {
            content: ChatCompletionRequestSystemMessageContent::Text(system_prompt.clone()),
            name: None,
        };
        messages.push(ChatCompletionRequestMessage::System(system_message));
    }

    // Add messages from request
    for msg in &request.message_list {
        let message = match msg.role.as_str() {
            "user" => {
                let user_message = ChatCompletionRequestUserMessage {
                    content: ChatCompletionRequestUserMessageContent::Text(msg.text.clone()),
                    name: None,
                };
                ChatCompletionRequestMessage::User(user_message)
            }
            "assistant" | "model" => {
                // Gemini often uses "model" role
                let assistant_message = ChatCompletionRequestAssistantMessage {
                    content: Some(ChatCompletionRequestAssistantMessageContent::Text(
                        msg.text.clone(),
                    )),
                    name: None,
                    function_call: None, // Gemini specific tool/function calling might differ
                    tool_calls: None,    // Adjust if needed based on Gemini's BYOT implementation
                    refusal: None,
                    audio: None,
                };
                ChatCompletionRequestMessage::Assistant(assistant_message)
            }
            "system" => {
                // Handle system messages if they appear later in the list
                let system_message = ChatCompletionRequestSystemMessage {
                    content: ChatCompletionRequestSystemMessageContent::Text(msg.text.clone()),
                    name: None,
                };
                ChatCompletionRequestMessage::System(system_message)
            }
            _ => {
                return Err(anyhow!(
                    "Invalid or unsupported role for Gemini: {}",
                    msg.role
                ))
            }
        };
        messages.push(message);
    }

    Ok(messages)
}

// Creates a chat completion request suitable for Gemini BYOT endpoint
fn create_gemini_chat_completion_request(
    model: &str,
    messages: Vec<ChatCompletionRequestMessage>,
    request: &InferenceRequest,
) -> Result<CreateChatCompletionRequest> {
    let mut builder = CreateChatCompletionRequestArgs::default();
    builder.model(model);
    builder.messages(messages);

    // Apply common parameters from the request.parameters
    if let Some(obj) = request.parameters.as_object() {
        for (key, value) in obj {
            match key.as_str() {
                // Standard OpenAI compatible params
                "max_tokens" => {
                    // Gemini uses maxOutputTokens, but BYOT might map this
                    if let Some(max_tokens) = value.as_i64() {
                        builder.max_tokens(max_tokens as u32);
                    }
                }
                "temperature" => {
                    if let Some(temperature) = value.as_f64() {
                        builder.temperature(temperature as f32);
                    }
                }
                "top_p" => {
                    if let Some(top_p) = value.as_f64() {
                        builder.top_p(top_p as f32);
                    }
                }
                "stop" | "stop_sequences" => {
                    // Gemini uses stopSequences
                    let stops: Option<Vec<String>> = if let Some(stop_str) = value.as_str() {
                        Some(vec![stop_str.to_string()])
                    } else if let Some(stop_array) = value.as_array() {
                        let collected: Vec<String> = stop_array
                            .iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect();
                        if !collected.is_empty() {
                            Some(collected)
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    if let Some(stops) = stops {
                        builder.stop(stops); // Use stop method, BYOT should handle mapping
                    }
                }
                // Other potential parameters - BYOT might pass them through
                // Check Gemini documentation for supported generationConfig fields
                "frequency_penalty" | "presence_penalty" | "seed" => {
                    // These might not be directly supported or named differently in Gemini.
                    // The BYOT layer *might* handle them, or they might be ignored.
                    // For now, we pass them using the builder if available.
                    match key.as_str() {
                        "frequency_penalty" => {
                            if let Some(penalty) = value.as_f64() {
                                builder.frequency_penalty(penalty as f32);
                            }
                        }
                        "presence_penalty" => {
                            if let Some(penalty) = value.as_f64() {
                                builder.presence_penalty(penalty as f32);
                            }
                        }
                        "seed" => {
                            if let Some(seed) = value.as_i64() {
                                builder.seed(seed);
                            }
                        }
                        _ => {} // Should not happen based on outer match
                    }
                    println!("Passing potentially mapped parameter: {} = {}", key, value);
                }
                // Any other parameters are assumed to be passed via the 'extra' field implicitly
                // if the BYOT implementation supports it, or ignored.
                _ => {
                    println!(
                        "Passing parameter {} directly (potential custom/Gemini param): {}",
                        key, value
                    );
                    // The async-openai builder might have an `extra` field or handle unknown keys.
                    // If not, these might be ignored unless the BYOT server specifically looks for them.
                    // builder.extra(key.clone(), value.clone()); // If an 'extra' method exists
                }
            }
        }
    }

    // Build the request
    builder
        .build()
        .map_err(|e| anyhow!("Failed to build Gemini chat completion request: {}", e))

    // Note: The advanced custom parameter handling from the OpenAI version (serializing/deserializing JSON)
    // might not be necessary or work correctly with the BYOT client methods.
    // We rely on the builder and the BYOT layer's parameter mapping for now.
}

/// Gemini BYOT client for non-streaming inference
pub async fn converse(request: &InferenceRequest, specs: &ModelSpecs) -> Result<String> {
    // Initialize client
    let (client, model) = initialize_gemini_client(specs)?;

    // Prepare messages
    let messages = gemini_prepare_messages(request)?;

    // Create chat completion request
    let chat_request = create_gemini_chat_completion_request(&model, messages, request)?;

    println!(
        "Sending Gemini chat request (non-streaming) to model: {}",
        model
    );

    // Send the request using create_byot
    let response: GeminiCreateChatCompletionResponse = client
        .chat()
        .create_byot(chat_request)
        .await
        .context("Failed to connect with Gemini, verify your API Key, Model and Base URL")?;

    // Extract and return the response text
    match response.choices.first() {
        Some(choice) => match &choice.message.content {
            Some(content) => Ok(content.clone()),
            None => Err(anyhow!("No content in Gemini response message")),
        },
        None => Err(anyhow!("No choices in Gemini response")),
    }
}

/// Gemini BYOT client for streaming inference
pub async fn converse_stream(
    request: &InferenceRequest,
    specs: &ModelSpecs,
    callback: impl Fn(serde_json::Value) -> Result<()> + Send + 'static,
) -> Result<()> {
    println!(
        "Starting Gemini streaming chat completion with parameters: {}",
        serde_json::to_string(&request.parameters).unwrap_or_else(|_| "{}".to_string())
    );

    // Initialize client
    let (client, model) = initialize_gemini_client(specs)?;

    // Prepare messages
    let messages = gemini_prepare_messages(request)?;

    // Create chat completion request
    let mut chat_request = create_gemini_chat_completion_request(&model, messages, request)?;

    // Explicitly set stream to true for streaming request
    chat_request.stream = Some(true);

    println!(
        "Sending Gemini chat request (streaming) to model: {}",
        model
    );

    // Send the streaming request using create_stream_byot
    let mut stream: GeminiChatCompletionResponseStream = client
        .chat()
        .create_stream_byot(chat_request)
        .await
        .context("Failed to connect with Gemini, verify your API Key, Model and Base URL")?;

    // Process each chunk as it arrives
    loop {
        // Set a timeout for receiving the next chunk
        match tokio::time::timeout(std::time::Duration::from_secs(120), stream.next()).await {
            Ok(Some(Ok(response_chunk))) => {
                // Process content delta from the first choice
                if let Some(choice) = response_chunk.choices.first() {
                    // Check for content delta
                    if let Some(content_delta) = &choice.delta.content {
                        if !content_delta.is_empty() {
                            let payload = serde_json::json!({
                                "type": "text",
                                "value": content_delta.clone()
                            });
                            // Invoke the callback with the text chunk
                            if let Err(e) = callback(payload) {
                                eprintln!("Callback error processing Gemini stream chunk: {}", e);
                                // Decide whether to break or continue based on error type/severity
                                return Err(e)
                                    .context("Callback failed during Gemini stream processing");
                            }
                        }
                    }
                    // Note: Gemini might have other delta types (e.g., tool calls, finish reason)
                    // Add handling here if needed based on GeminiCreateChatCompletionStreamResponse structure
                    // and the specifics of the BYOT implementation.
                    // Example: Check choice.finish_reason
                }

                // Optional: Add a small delay between processing chunks if needed
                let delay_ms = request
                    .parameters
                    .get("stream_delay_ms")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(5); // Default 5ms delay for Gemini

                if delay_ms > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                }
            }
            Ok(Some(Err(e))) => {
                // Handle stream-level errors (e.g., network issues, API errors)
                eprintln!("Gemini stream error occurred: {:?}", e);
                return Err(anyhow!("Gemini stream error: {}", e));
            }
            Ok(None) => {
                // Stream finished successfully
                println!("Gemini stream finished.");
                break;
            }
            Err(_) => {
                // Timeout occurred
                eprintln!("Gemini stream timeout after 120 seconds.");
                return Err(anyhow!("Gemini stream timeout after 120 seconds"));
            }
        }
    }

    Ok(())
}
