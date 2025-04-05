use anyhow::{anyhow, Context, Result};
use async_openai::{
    types::{
        ChatCompletionRequestAssistantMessage, ChatCompletionRequestAssistantMessageContent,
        ChatCompletionRequestMessage, ChatCompletionRequestSystemMessage,
        ChatCompletionRequestSystemMessageContent, ChatCompletionRequestUserMessage,
        ChatCompletionRequestUserMessageContent, CreateChatCompletionRequest,
        CreateChatCompletionRequestArgs, Role,
    },
    Client,
};
use futures::StreamExt;
use serde_json::Value;

use crate::inference::{InferenceRequest, ModelSpecs};

// Initialize OpenAI client with credentials from model specs
fn initialize_openai_client(
    specs: &ModelSpecs,
) -> Result<(Client<async_openai::config::OpenAIConfig>, String)> {
    // Extract config from the model specs
    let config = &specs.config;

    // Get model with fallback
    let model = config["model"]
        .as_str()
        .unwrap_or("gpt-3.5-turbo")
        .to_string();

    // Get API key and base URL with fallbacks
    let api_key = config["api_key"].as_str().unwrap_or("").to_string();
    let base_url = config["base_url"]
        .as_str()
        .unwrap_or("https://api.openai.com/v1")
        .to_string();

    // Create a client builder
    let mut builder = async_openai::config::OpenAIConfig::new();

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
fn prepare_messages(request: &InferenceRequest) -> Result<Vec<ChatCompletionRequestMessage>> {
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

// Creates a chat completion request with all parameters from the request
fn create_chat_completion_request(
    model: &str,
    messages: Vec<ChatCompletionRequestMessage>,
    request: &InferenceRequest,
) -> Result<CreateChatCompletionRequest> {
    use serde_json::Value;

    // Start with a basic request builder
    let mut builder = CreateChatCompletionRequestArgs::default();
    builder.model(model);
    builder.messages(messages);

    // Create a mutable copy of the parameters to handle custom parameters
    let mut custom_params = serde_json::Map::new();

    // Apply all parameters from the request.parameters
    if let Some(obj) = request.parameters.as_object() {
        for (key, value) in obj {
            match key.as_str() {
                "max_tokens" => {
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
                "stop" => {
                    // Handle both single string and array of strings
                    if let Some(stop_str) = value.as_str() {
                        builder.stop(vec![stop_str.to_string()]);
                    } else if let Some(stop_array) = value.as_array() {
                        let stops: Vec<String> = stop_array
                            .iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect();
                        if !stops.is_empty() {
                            builder.stop(stops);
                        }
                    }
                }
                // Handle non-standard OpenAI parameters and advanced sampling options
                // These will be added directly to the request JSON
                "top_k"
                | "min_p"
                | "top_a"
                | "repetition_penalty"
                | "smoothing_factor"
                | "smoothing_curve"
                | "dry_multiplier"
                | "dry_base"
                | "dry_allowed_length"
                | "dry_penalty_last_n"
                | "dry_sequence_breakers"
                | "xtc_threshold"
                | "xtc_probability"
                | "sampling_order" => {
                    // Store these parameters in our custom_params map
                    custom_params.insert(key.clone(), value.clone());
                    println!("Adding custom parameter: {} = {}", key, value);
                }
                // For any other parameters, we'll add them directly to the request JSON
                _ => {
                    custom_params.insert(key.clone(), value.clone());
                }
            }
        }
    }

    // Build the request
    let mut request = builder
        .build()
        .map_err(|e| anyhow!("Failed to build chat completion request: {}", e))?;

    // Add custom parameters to the request
    if !custom_params.is_empty() {
        // Get the inner Value from the request
        let request_value = serde_json::to_value(&request)
            .map_err(|e| anyhow!("Failed to serialize request: {}", e))?;

        if let Some(mut obj) = request_value.as_object().cloned() {
            // Add all custom parameters to the request object
            for (key, value) in custom_params {
                obj.insert(key, value);
            }

            // Deserialize back into the request
            request = serde_json::from_value(Value::Object(obj))
                .map_err(|e| anyhow!("Failed to deserialize modified request: {}", e))?;
        }
    }

    Ok(request)
}

/// OpenAI-compatible client for inference
///
/// This function handles non-streaming inference requests.
pub async fn converse(request: &InferenceRequest, specs: &ModelSpecs) -> Result<String> {
    println!("Starting OpenAI chat completion using async-openai");

    // Initialize client
    let (client, model) = initialize_openai_client(specs)?;

    // Prepare messages
    let messages = prepare_messages(request)?;

    // Create chat completion request
    let chat_request = create_chat_completion_request(&model, messages, request)?;

    // Send the request
    println!("Sending request to OpenAI API");
    let response = client
        .chat()
        .create(chat_request)
        .await
        .context("Failed to create chat completion")?;

    // Extract and return the response text
    match response.choices.first() {
        Some(choice) => match &choice.message.content {
            Some(content) => Ok(content.clone()),
            None => Err(anyhow!("No content in response")),
        },
        None => Err(anyhow!("No choices in response")),
    }
}

/// OpenAI-compatible client for streaming inference
///
/// This function handles streaming inference requests.
/// It invokes a callback function for each token received.
pub async fn converse_stream(
    request: &InferenceRequest,
    specs: &ModelSpecs,
    callback: impl Fn(String) -> Result<()> + Send + 'static,
) -> Result<()> {
    println!(
        "Starting OpenAI streaming chat completion with parameters: {}",
        serde_json::to_string_pretty(&request.parameters).unwrap_or_else(|_| "{}".to_string())
    );

    // Initialize client
    let (client, model) = initialize_openai_client(specs)?;

    // Prepare messages
    let messages = prepare_messages(request)?;

    // Create chat completion request
    let mut chat_request = create_chat_completion_request(&model, messages, request)?;

    // Set stream to true for streaming
    chat_request.stream = Some(true);

    // Send the streaming request
    println!("Sending streaming request to OpenAI API");
    let mut stream = client
        .chat()
        .create_stream(chat_request)
        .await
        .context("Failed to create streaming chat completion")?;

    // Process each chunk as it arrives using the async_openai API
    loop {
        match tokio::time::timeout(std::time::Duration::from_secs(120), stream.next()).await {
            Ok(Some(Ok(response))) => {
                // Extract content from the first choice
                if let Some(choice) = response.choices.first() {
                    if let Some(content) = &choice.delta.content {
                        if !content.is_empty() {
                            callback(content.clone())?;

                            // Add a small delay between tokens if specified
                            let delay_ms = request
                                .parameters
                                .get("stream_delay_ms")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(10); // Default 10ms delay

                            if delay_ms > 0 {
                                tokio::time::sleep(std::time::Duration::from_millis(delay_ms))
                                    .await;
                            }
                        }
                    }
                }
            }
            Ok(Some(Err(e))) => {
                println!("Stream error occurred: {:?}", e);
                return Err(anyhow!("Stream error: {}", e));
            }
            Ok(None) => break, // Stream has ended
            Err(_) => return Err(anyhow!("Stream timeout after 120 seconds")),
        }
    }

    Ok(())
}
