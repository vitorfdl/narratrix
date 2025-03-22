use std::error::Error;
use std::fmt;

use anyhow::{anyhow, Context, Result};
use aws_sdk_bedrockruntime::error::SdkError;
use aws_sdk_bedrockruntime::operation::converse::ConverseError;
use aws_sdk_bedrockruntime::operation::converse::ConverseOutput;
use aws_sdk_bedrockruntime::types::{
    ContentBlock, ConversationRole, ConverseStreamOutput, InferenceConfiguration, Message,
    SystemContentBlock,
};
use aws_sdk_bedrockruntime::{
    config::{BehaviorVersion, Region},
    Client,
};

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
    let aws_secret_access_key = config["aws_secret_access_key"]
        .as_str()
        .context("Missing AWS secret access key")?;
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

    // Add parameters only if they exist in the request
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

    // Add system prompt if provided
    if let Some(system_prompt) = &request.system_prompt {
        let system_content = SystemContentBlock::Text(system_prompt.to_string());
        converse_request = converse_request.system(system_content);
    }

    // Send the request and process the response
    let response = converse_request
        .send()
        .await
        .map_err(|e| anyhow!("Bedrock API error: {}", e))?;

    println!("Waiting for response");
    let text = get_converse_output_text(response)?;
    println!("text: {}", text);
    Ok(text)
}

/// AWS Bedrock client for streaming inference
///
/// This function handles streaming inference requests.
/// It invokes a callback function for each token received.
pub async fn converse_stream(
    request: &InferenceRequest,
    specs: &ModelSpecs,
    callback: impl Fn(String) -> Result<()> + Send + 'static,
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

    // Add system prompt if provided
    if let Some(system_prompt) = &request.system_prompt {
        let system_content = SystemContentBlock::Text(system_prompt.to_string());
        converse_stream_request = converse_stream_request.system(system_content);
    }

    // Send the stream request
    let response = converse_stream_request.send().await;

    // Process the streaming response
    let mut stream = match response {
        Ok(output) => Ok(output.stream),
        Err(e) => {
            println!("Error starting stream: {:?}", e);
            match e {
                SdkError::ConstructionFailure(err) => {
                    Err(anyhow!("Construction failure: {:?}", err))
                }
                SdkError::TimeoutError(err) => Err(anyhow!("Request timeout: {:?}", err)),
                SdkError::DispatchFailure(err) => Err(anyhow!("Dispatch failure: {:?}", err)),
                _ => Err(anyhow!("Unknown AWS Bedrock stream error")),
            }
        }
    }?;

    // Process the stream chunks
    loop {
        let token = stream.recv().await;

        match token {
            Ok(Some(chunk)) => {
                // Extract text from the chunk
                let text = get_stream_chunk_text(chunk)?;
                if !text.is_empty() {
                    callback(text)?;
                }
            }
            Ok(None) => {
                // End of stream
                break;
            }
            Err(e) => {
                println!("Stream error: {:?}", e);
                return Err(anyhow!("Stream error: {:?}", e));
            }
        }
    }

    Ok(())
}

// Helper function to extract text from a stream chunk
fn get_stream_chunk_text(output: ConverseStreamOutput) -> Result<String> {
    match output {
        ConverseStreamOutput::ContentBlockDelta(event) => match event.delta() {
            Some(delta) => delta
                .as_text()
                .map(|s| s.to_string())
                .map_err(|_| anyhow!("Cannot convert delta to text")),
            None => Ok(String::new()),
        },
        _ => Ok(String::new()),
    }
}
