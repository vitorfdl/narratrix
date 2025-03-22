pub mod aws_bedrock;
pub mod openai;

pub use aws_bedrock::BedrockConverseError;
use tauri::{AppHandle, Emitter};

use crate::inference::{InferenceRequest, InferenceResponse, ModelSpecs};
use anyhow::{anyhow, Context, Result};
use std::error::Error;
use std::fmt;
use std::sync::{Arc, Mutex};

#[derive(Debug)]
pub struct InferenceEngineError(pub String);

impl fmt::Display for InferenceEngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Inference Engine Error: {}", self.0)
    }
}

impl Error for InferenceEngineError {}

impl From<BedrockConverseError> for InferenceEngineError {
    fn from(error: BedrockConverseError) -> Self {
        InferenceEngineError(error.0)
    }
}

impl From<OpenAICompatibleError> for InferenceEngineError {
    fn from(error: OpenAICompatibleError) -> Self {
        InferenceEngineError(error.0)
    }
}

impl From<&str> for InferenceEngineError {
    fn from(error: &str) -> Self {
        InferenceEngineError(error.to_string())
    }
}

// Add these implementations for bidirectional conversion
impl From<InferenceEngineError> for BedrockConverseError {
    fn from(error: InferenceEngineError) -> Self {
        BedrockConverseError(error.0)
    }
}

impl From<InferenceEngineError> for OpenAICompatibleError {
    fn from(error: InferenceEngineError) -> Self {
        OpenAICompatibleError(error.0)
    }
}

#[derive(Debug)]
pub struct OpenAICompatibleError(pub String);

// Handle emitting inference responses to the frontend in a standard way
fn handle_inference_response(
    request_id: &str,
    status: &str,
    result: Option<serde_json::Value>,
    error: Option<String>,
    app_handle: &AppHandle,
) -> Result<()> {
    let inference_response = InferenceResponse {
        request_id: request_id.to_string(),
        status: status.to_string(),
        result,
        error,
    };

    // Emit the response event
    app_handle
        .emit("inference-response", &inference_response)
        .context("Failed to emit response")?;

    // Log in the backend for debugging
    println!(
        "Emitted inference response (status: {}): {:?}",
        status, inference_response
    );

    Ok(())
}

// Handle streaming response chunks in a standard way
fn handle_streaming_chunk(request_id: &str, chunk: &str, app_handle: &AppHandle) -> Result<()> {
    handle_inference_response(
        request_id,
        "streaming",
        Some(serde_json::json!({ "text": chunk })),
        None,
        app_handle,
    )
}

// Shared function to handle streaming inference for different providers
async fn handle_streaming<F, Fut>(
    request: &InferenceRequest,
    app_handle: &AppHandle,
    stream_fn: F,
) -> Result<String>
where
    F: FnOnce(Arc<Mutex<String>>, String, AppHandle) -> Fut,
    Fut: std::future::Future<Output = Result<()>>,
{
    let response_text = Arc::new(Mutex::new(String::new()));
    let request_id = request.id.clone();
    let app_handle_clone = app_handle.clone();

    stream_fn(
        Arc::clone(&response_text),
        request_id.clone(),
        app_handle_clone,
    )
    .await?;

    let result = response_text
        .lock()
        .map(|guard| guard.clone())
        .map_err(|e| anyhow!("Mutex poisoned: {}", e))?;

    // Final completed response
    handle_inference_response(
        &request.id,
        "completed",
        Some(serde_json::json!({ "text": result.clone() })),
        None,
        app_handle,
    )?;

    Ok(result)
}

// Shared function to handle non-streaming inference for different providers
async fn handle_non_streaming(
    request: &InferenceRequest,
    result: String,
    app_handle: &AppHandle,
) -> Result<String> {
    // Use the standard handler for completed responses
    handle_inference_response(
        &request.id,
        "completed",
        Some(serde_json::json!({ "text": result.clone() })),
        None,
        app_handle,
    )?;

    Ok(result)
}

/// Dispatch an inference request to the appropriate engine based on ModelSpecs.engine
pub async fn process_inference(
    request: &InferenceRequest,
    specs: &ModelSpecs,
    app_handle: AppHandle,
) -> Result<String> {
    match specs.engine.as_str() {
        "aws_bedrock" => {
            if request.stream {
                handle_streaming(
                    request,
                    &app_handle,
                    |response_text, request_id, app_handle_clone| async move {
                        aws_bedrock::converse_stream(request, specs, move |token| {
                            println!("Received token: {}", token);

                            handle_streaming_chunk(&request_id, &token, &app_handle_clone)?;

                            if let Ok(mut response) = response_text.lock() {
                                response.push_str(&token);
                            }
                            Ok(())
                        })
                        .await
                        .context("AWS Bedrock stream processing failed")
                    },
                )
                .await
            } else {
                let result = aws_bedrock::converse(request, specs)
                    .await
                    .context("AWS Bedrock inference failed")?;

                handle_non_streaming(request, result, &app_handle).await
            }
        }
        "openai_compatible" => {
            if request.stream {
                handle_streaming(
                    request,
                    &app_handle,
                    |response_text, request_id, app_handle_clone| async move {
                        openai::converse_stream(request, specs, move |token| {
                            println!("Received token: {}", token);

                            handle_streaming_chunk(&request_id, &token, &app_handle_clone)?;

                            if let Ok(mut response) = response_text.lock() {
                                response.push_str(&token);
                            }
                            Ok(())
                        })
                        .await
                        .context("OpenAI stream processing failed")
                    },
                )
                .await
            } else {
                let result = openai::converse(request, specs)
                    .await
                    .map_err(|e| {
                        println!("OpenAI error details: {:?}", e);
                        e
                    })
                    .with_context(|| "OpenAI inference failed")?;

                handle_non_streaming(request, result, &app_handle).await
            }
        }
        // Add other engine types here as they are implemented
        _ => Err(anyhow!("Unsupported inference engine: {}", specs.engine)),
    }
}
