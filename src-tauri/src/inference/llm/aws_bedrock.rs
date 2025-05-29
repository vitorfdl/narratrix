use std::error::Error;
use std::fmt;

use anyhow::{anyhow, Context, Result};
use aws_sdk_bedrockruntime::error::SdkError;
use aws_sdk_bedrockruntime::operation::converse::ConverseError;
use aws_sdk_bedrockruntime::operation::converse::ConverseOutput;
use aws_sdk_bedrockruntime::types::PerformanceConfigLatency;
use aws_sdk_bedrockruntime::types::PerformanceConfiguration;
use aws_sdk_bedrockruntime::types::{
    CachePointBlock, CachePointType, ContentBlock, ContentBlockDelta, ConversationRole,
    ConverseStreamOutput, InferenceConfiguration, Message, SystemContentBlock,
};
use aws_sdk_bedrockruntime::{
    config::{BehaviorVersion, Region},
    Client,
};
use aws_smithy_types::Document;
use serde_json;

use crate::inference::{InferenceRequest, ModelSpecs};

#[derive(Debug)]
pub struct BedrockConverseError(pub String);

impl fmt::Display for BedrockConverseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Bedrock Converse Error: {}", self.0)
    }
}

impl Error for BedrockConverseError {}

impl From<SdkError<ConverseError>> for BedrockConverseError {
    fn from(error: SdkError<ConverseError>) -> Self {
        match error {
            SdkError::ConstructionFailure(err) => {
                BedrockConverseError(format!("Construction failure: {:?}", err))
            }
            SdkError::TimeoutError(err) => {
                BedrockConverseError(format!("Request timeout: {:?}", err))
            }
            SdkError::DispatchFailure(err) => {
                BedrockConverseError(format!("Dispatch failure: {:?}", err))
            }
            // SdkError::ResponseError { err, .. } => {
            //     BedrockConverseError(format!("Response error: {}", err))
            // }
            // SdkError::ServiceError { err, .. } => {
            //     BedrockConverseError(format!("Service error: {}", err))
            // }
            _ => BedrockConverseError("Unknown AWS Bedrock error".into()),
        }
    }
}

impl From<&str> for BedrockConverseError {
    fn from(error: &str) -> Self {
        BedrockConverseError(error.to_string())
    }
}

// Function to extract the text from a Converse response
fn get_converse_output_text(output: ConverseOutput) -> Result<String> {
    let text = output
        .output()
        .ok_or_else(|| anyhow!("no output"))?
        .as_message()
        .map_err(|_| anyhow!("output not a message"))?
        .content()
        .first()
        .ok_or_else(|| anyhow!("no content in message"))?
        .as_text()
        .map_err(|_| anyhow!("content is not text"))?
        .to_string();
    Ok(text)
}

// Helper function to initialize AWS client and prepare messages
async fn initialize_bedrock_request(
    request: &InferenceRequest,
    specs: &ModelSpecs,
) -> Result<(Client, String, Vec<Message>)> {
    // Extract AWS configuration from the model specs
    let config = &specs.config;

    let aws_access_key_id = config["aws_access_key_id"]
        .as_str()
        .context("Missing AWS access key ID")?;

    let encrypted_aws_secret_access_key = config["aws_secret_access_key"]
        .as_str()
        .context("Missing AWS secret access key")?;
    let aws_secret_access_key = if !encrypted_aws_secret_access_key.is_empty() {
        match crate::utils::decrypt_api_key(&encrypted_aws_secret_access_key) {
            Ok(decrypted) => decrypted,
            Err(_) => encrypted_aws_secret_access_key.to_string(),
        }
    } else {
        "".to_string()
    };

    let aws_region = config["aws_region"]
        .as_str()
        .context("Missing AWS region")?;
    let model_id = config["model"].as_str().context("Missing model ID")?;

    // Configure the AWS SDK with credentials and region
    let sdk_config = aws_config::defaults(BehaviorVersion::latest())
        .region(Region::new(aws_region.to_string()))
        .credentials_provider(aws_sdk_bedrockruntime::config::Credentials::new(
            aws_access_key_id,
            aws_secret_access_key,
            None,
            None,
            "bedrock-credentials",
        ))
        .load()
        .await;

    let client = Client::new(&sdk_config);

    // Convert InferenceRequest messages to Bedrock Converse messages
    let mut messages = Vec::new();

    // Add messages from request
    for msg in &request.message_list {
        // Convert role string to ConversationRole
        let role = match msg.role.as_str() {
            "user" => ConversationRole::User,
            "assistant" => ConversationRole::Assistant,
            _ => return Err(anyhow!("Invalid role: {}", msg.role)),
        };

        // Create message
        let message = Message::builder()
            .role(role)
            .content(ContentBlock::Text(msg.text.clone()))
            .build()
            .map_err(|_| anyhow!("Failed to build message"))?;

        messages.push(message);
    }

    Ok((client, model_id.to_string(), messages))
}

// Helper function to configure inference parameters
fn configure_inference(request: &InferenceRequest) -> InferenceConfiguration {
    let mut inference_config = InferenceConfiguration::builder();

    // Check if reasoning is enabled
    let reasoning_enabled = request
        .parameters
        .get("reasoning_budget")
        .and_then(|v| v.as_i64())
        .is_some();

    // Add parameters based on whether reasoning is enabled
    if reasoning_enabled {
        // When reasoning is enabled, only max_tokens should be added
        // and it should include the reasoning_budget value
        if let Some(max_tokens) = request
            .parameters
            .get("max_tokens")
            .and_then(|v| v.as_i64())
        {
            let reasoning_budget = request
                .parameters
                .get("reasoning_budget")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            // Sum max_tokens and reasoning_budget
            let total_tokens = max_tokens + reasoning_budget;
            inference_config = inference_config.max_tokens(total_tokens as i32);
        }
    } else {
        // Standard behavior when reasoning is not enabled
        if let Some(max_tokens) = request
            .parameters
            .get("max_tokens")
            .and_then(|v| v.as_i64())
        {
            inference_config = inference_config.max_tokens(max_tokens as i32);
        }

        if let Some(temperature) = request
            .parameters
            .get("temperature")
            .and_then(|v| v.as_f64())
        {
            inference_config = inference_config.temperature(temperature as f32);
        }

        if let Some(top_p) = request.parameters.get("top_p").and_then(|v| v.as_f64()) {
            inference_config = inference_config.top_p(top_p as f32);
        }
    }

    inference_config.build()
}

/// AWS Bedrock client for inference
///
/// This function handles non-streaming inference requests.
/// For streaming inference, a separate function will be implemented.
pub async fn converse(request: &InferenceRequest, specs: &ModelSpecs) -> Result<String> {
    println!("Starting AWS Bedrock converse");

    // Initialize client and prepare messages
    let (client, model_id, messages) = initialize_bedrock_request(request, specs).await?;

    // Create the converse request
    let mut converse_request = client.converse().model_id(model_id);

    // Add all messages to the request
    for message in messages {
        converse_request = converse_request.messages(message);
    }

    // Configure inference parameters
    converse_request = converse_request.inference_config(configure_inference(request));

    // Add reasoning configuration if enabled
    if let Some(reasoning_budget) = request
        .parameters
        .get("reasoning_budget")
        .and_then(|v| v.as_i64())
    {
        // Add reasoning configuration to additional_model_request_fields
        let reasoning_config_value = serde_json::json!({
            "reasoning_config": {
                "type": "enabled",
                "budget_tokens": reasoning_budget
            }
        });
        let reasoning_config_doc = convert_serde_to_aws_document(reasoning_config_value)
            .context("Failed to convert reasoning config to Document")?;

        converse_request = converse_request.additional_model_request_fields(reasoning_config_doc);
    }

    // Add system prompt with optional caching
    if let Some(system_prompt) = &request.system_prompt {
        let enable_caching = request
            .parameters
            .get("prompt_cache_depth")
            .and_then(|v| v.as_i64())
            .unwrap_or(0)
            > 0;

        if enable_caching {
            converse_request =
                converse_request.system(SystemContentBlock::Text(system_prompt.to_string()));
            let cache_point = CachePointBlock::builder()
                .r#type(CachePointType::Default)
                .build()
                .map_err(|e| anyhow!("Failed to build cache point: {}", e))?;
            converse_request = converse_request.system(SystemContentBlock::CachePoint(cache_point));
        } else {
            converse_request =
                converse_request.system(SystemContentBlock::Text(system_prompt.to_string()));
        }
    }

    // Send the request and process the response
    let response = converse_request
        .send()
        .await
        .map_err(|e| anyhow!("Bedrock API error: {}", e))?;

    let text = get_converse_output_text(response)?;
    Ok(text)
}

/// AWS Bedrock client for streaming inference
///
/// This function handles streaming inference requests.
/// It invokes a callback function for each chunk received.
pub async fn converse_stream(
    request: &InferenceRequest,
    specs: &ModelSpecs,
    callback: impl Fn(serde_json::Value) -> Result<()> + Send + 'static,
) -> Result<()> {
    println!("Starting AWS Bedrock converse_stream");

    // Initialize client and prepare messages
    let (client, model_id, messages) = initialize_bedrock_request(request, specs).await?;

    // Create the converse_stream request
    let mut converse_stream_request = client.converse_stream().model_id(model_id);

    // Add all messages to the request
    for message in messages {
        converse_stream_request = converse_stream_request.messages(message);
    }

    // Configure inference parameters
    converse_stream_request =
        converse_stream_request.inference_config(configure_inference(request));

    // Add reasoning configuration if enabled
    if let Some(reasoning_budget) = request
        .parameters
        .get("reasoning_budget")
        .and_then(|v| v.as_i64())
    {
        // Add reasoning configuration to additional_model_request_fields
        let reasoning_config_value = serde_json::json!({
            "reasoning_config": {
                "type": "enabled",
                "budget_tokens": reasoning_budget
            }
        });
        let reasoning_config_doc = convert_serde_to_aws_document(reasoning_config_value)
            .context("Failed to convert reasoning config to Document")?;

        converse_stream_request =
            converse_stream_request.additional_model_request_fields(reasoning_config_doc);
    }

    // Add system prompt with optional caching
    if let Some(system_prompt) = &request.system_prompt {
        let enable_caching = request
            .parameters
            .get("prompt_cache_depth")
            .and_then(|v| v.as_i64())
            .unwrap_or(0)
            > 0;

        if enable_caching {
            converse_stream_request =
                converse_stream_request.system(SystemContentBlock::Text(system_prompt.to_string()));
            let cache_point = CachePointBlock::builder()
                .r#type(CachePointType::Default)
                .build()
                .map_err(|e| anyhow!("Failed to build cache point: {}", e))?;
            converse_stream_request =
                converse_stream_request.system(SystemContentBlock::CachePoint(cache_point));
        } else {
            converse_stream_request =
                converse_stream_request.system(SystemContentBlock::Text(system_prompt.to_string()));
        }
    }

    converse_stream_request = converse_stream_request.performance_config(
        PerformanceConfiguration::builder()
            .latency(PerformanceConfigLatency::Standard)
            .build(),
    );

    // Send the stream request
    let response = converse_stream_request.send().await;

    // Process the streaming response
    let mut stream = match response {
        Ok(output) => Ok(output.stream),
        Err(e) => {
            let err_msg = format!("Error starting Bedrock stream: {}", e);
            println!("{}", err_msg);
            // Return a more detailed error using context or formatting the SdkError
            Err(anyhow!(e).context(err_msg))
        }
    }?;

    // Process the stream chunks
    // Wait 1-2 seconds before starting to process chunks
    tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

    loop {
        let token = stream.recv().await;

        match token {
            Ok(Some(chunk)) => {
                // Process the chunk and call the callback
                if let Some(payload) = process_stream_chunk(chunk)? {
                    // Propagate potential errors from the callback
                    if let Err(e) = callback(payload) {
                        let err_msg =
                            format!("Error processing stream chunk payload in callback: {}", e);
                        println!("{}", err_msg);
                        return Err(anyhow!(e).context(err_msg));
                    }
                }
            }
            Ok(None) => {
                // End of stream
                break;
            }
            Err(e) => {
                // Return a more detailed error using context or formatting the RecvError
                let err_msg = format!("Bedrock stream receive error: {}", e);
                println!("{}", err_msg);
                return Err(anyhow!(e).context(err_msg));
            }
        }
    }

    Ok(())
}

// Helper function to process a stream chunk and return a JSON payload for the callback
fn process_stream_chunk(output: ConverseStreamOutput) -> Result<Option<serde_json::Value>> {
    match output {
        ConverseStreamOutput::ContentBlockDelta(event) => match event.delta() {
            Some(delta) => match delta {
                ContentBlockDelta::Text(text) => {
                    if !text.is_empty() {
                        Ok(Some(serde_json::json!({ "type": "text", "value": text })))
                    } else {
                        Ok(None)
                    }
                }
                ContentBlockDelta::ReasoningContent(reasoning_delta) => {
                    if let Ok(text) = reasoning_delta.as_text() {
                        if !text.is_empty() {
                            Ok(Some(serde_json::json!({
                                "type": "reasoning",
                                "value": text
                            })))
                        } else {
                            Ok(None)
                        }
                    } else {
                        Ok(None) // Not a text delta within reasoning
                    }
                }
                _ => Ok(None), // Ignore other delta types for now
            },
            None => Ok(None),
        },
        // Handle other stream output types if needed (e.g., Metadata)
        ConverseStreamOutput::MessageStart(_) => Ok(None),
        ConverseStreamOutput::MessageStop(_) => Ok(None),
        ConverseStreamOutput::ContentBlockStart(_) => Ok(None),
        ConverseStreamOutput::ContentBlockStop(_) => Ok(None),
        ConverseStreamOutput::Metadata(_) => Ok(None),
        _ => Ok(None),
    }
}

// Helper function to convert serde_json::Value to aws_smithy_types::Document
fn convert_serde_to_aws_document(value: serde_json::Value) -> Result<Document> {
    match value {
        serde_json::Value::Null => Ok(Document::Null),
        serde_json::Value::Bool(b) => Ok(Document::Bool(b)),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(Document::Number(aws_smithy_types::Number::NegInt(i)))
            } else if let Some(u) = n.as_u64() {
                Ok(Document::Number(aws_smithy_types::Number::PosInt(u)))
            } else if let Some(f) = n.as_f64() {
                Ok(Document::Number(aws_smithy_types::Number::Float(f)))
            } else {
                Err(anyhow!("Invalid number format"))
            }
        }
        serde_json::Value::String(s) => Ok(Document::String(s)),
        serde_json::Value::Array(arr) => {
            let mut docs = Vec::new();
            for item in arr {
                docs.push(convert_serde_to_aws_document(item)?);
            }
            Ok(Document::Array(docs))
        }
        serde_json::Value::Object(map) => {
            let mut doc_map = std::collections::HashMap::new();
            for (k, v) in map {
                doc_map.insert(k, convert_serde_to_aws_document(v)?);
            }
            Ok(Document::Object(doc_map))
        }
    }
}
