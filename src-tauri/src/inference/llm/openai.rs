use anyhow::{anyhow, Context, Result};
use openai::chat::{ChatCompletion, ChatCompletionMessage, ChatCompletionMessageRole};
use openai::Credentials;

use crate::inference::{InferenceRequest, ModelSpecs};

// Helper function to initialize OpenAI credentials and model
async fn initialize_openai_client(specs: &ModelSpecs) -> Result<(Credentials, String)> {
    // Extract config from the model specs
    let config = &specs.config;

    // Get model (optional, can be provided in the request)
    let model = config["model"]
        .as_str()
        .unwrap_or("gpt-3.5-turbo")
        .to_string();

    // Get API key and base URL with fallbacks to empty strings
    // This allows the library to use environment variables or default configuration
    let api_key = config["api_key"].as_str().unwrap_or("").to_string();
    let base_url = config["base_url"]
        .as_str()
        .unwrap_or("https://api.openai.com/v1")
        .to_string();

    // Initialize credentials - the library will use environment variables if these are empty
    let credentials = Credentials::new(api_key, base_url);

    Ok((credentials, model))
}

// Convert a Narratrix inference request to OpenAI chat messages
fn prepare_messages(request: &InferenceRequest) -> Result<Vec<ChatCompletionMessage>> {
    let mut messages = Vec::new();

    // Add system prompt if provided
    if let Some(system_prompt) = &request.system_prompt {
        messages.push(ChatCompletionMessage {
            role: ChatCompletionMessageRole::System,
            content: Some(system_prompt.clone()),
            name: None,
            function_call: None,
            tool_calls: None,
            tool_call_id: None,
        });
    }

    // Add messages from request
    for msg in &request.message_list {
        // Convert role string to ChatCompletionMessageRole
        let role = match msg.role.as_str() {
            "user" => ChatCompletionMessageRole::User,
            "assistant" => ChatCompletionMessageRole::Assistant,
            "system" => ChatCompletionMessageRole::System,
            _ => return Err(anyhow!("Invalid role: {}", msg.role)),
        };

        messages.push(ChatCompletionMessage {
            role,
            content: Some(msg.text.clone()),
            name: None,
            function_call: None,
            tool_calls: None,
            tool_call_id: None,
        });
    }

    Ok(messages)
}

// Configure inference parameters for the OpenAI request
fn configure_parameters(
    request: &InferenceRequest,
    builder: openai::chat::ChatCompletionBuilder,
) -> openai::chat::ChatCompletionBuilder {
    let mut configured_builder = builder;

    // Add parameters only if they exist in the request
    if let Some(max_tokens) = request
        .parameters
        .get("max_tokens")
        .and_then(|v| v.as_i64())
    {
        configured_builder = configured_builder.max_tokens(max_tokens as u32);
    }

    if let Some(temperature) = request
        .parameters
        .get("temperature")
        .and_then(|v| v.as_f64())
    {
        configured_builder = configured_builder.temperature(temperature as f32);
    }

    if let Some(top_p) = request.parameters.get("top_p").and_then(|v| v.as_f64()) {
        configured_builder = configured_builder.top_p(top_p as f32);
    }

    // Add other OpenAI parameters as needed
    if let Some(frequency_penalty) = request
        .parameters
        .get("frequency_penalty")
        .and_then(|v| v.as_f64())
    {
        configured_builder = configured_builder.frequency_penalty(frequency_penalty as f32);
    }

    if let Some(presence_penalty) = request
        .parameters
        .get("presence_penalty")
        .and_then(|v| v.as_f64())
    {
        configured_builder = configured_builder.presence_penalty(presence_penalty as f32);
    }

    configured_builder
}

/// OpenAI-compatible client for inference
///
/// This function handles non-streaming inference requests.
pub async fn converse(request: &InferenceRequest, specs: &ModelSpecs) -> Result<String> {
    println!("Starting OpenAI-compatible chat completion");

    // Initialize client
    let (credentials, model) = initialize_openai_client(specs).await?;

    // Prepare messages
    let messages = prepare_messages(request)?;

    // Create chat completion builder
    let builder = ChatCompletion::builder(&model, messages);

    // Configure parameters
    let configured_builder = configure_parameters(request, builder).credentials(credentials);

    // Send the request
    println!("Sending request to OpenAI-compatible API");
    let response = configured_builder
        .create()
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
    println!("Starting OpenAI-compatible streaming chat completion");

    // Initialize client
    let (credentials, model) = initialize_openai_client(specs).await?;

    // Prepare messages
    let messages = prepare_messages(request)?;

    // Create chat completion builder
    let builder = ChatCompletion::builder(&model, messages);

    // Configure parameters
    let configured_builder = configure_parameters(request, builder).credentials(credentials);

    // Send the streaming request
    println!("Sending streaming request to OpenAI-compatible API");

    // Stream the chat completion
    let mut stream = configured_builder
        .create_stream()
        .await
        .context("Failed to create streaming chat completion")?;

    // Process each chunk as it arrives
    while let Some(result) =
        tokio::time::timeout(std::time::Duration::from_secs(120), stream.recv())
            .await
            .context("Stream timeout")?
    {
        // Extract content from the first choice
        if let Some(choice) = result.choices.first() {
            if let Some(content) = &choice.delta.content {
                if !content.is_empty() {
                    callback(content.clone())?;
                }
            }
        }
    }

    Ok(())
}
