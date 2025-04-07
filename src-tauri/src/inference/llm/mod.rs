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
fn handle_streaming_chunk(
    request_id: &str,
    payload: &serde_json::Value,
    app_handle: &AppHandle,
) -> Result<()> {
    let mut result_payload = None;

    // Construct the appropriate result structure based on the payload type
    if let Some(obj) = payload.as_object() {
        if let Some(type_val) = obj.get("type").and_then(|v| v.as_str()) {
            if let Some(value_val) = obj.get("value") {
                match type_val {
                    "text" => {
                        result_payload = Some(serde_json::json!({ "text": value_val }));
                    }
                    "reasoning" => {
                        result_payload = Some(serde_json::json!({ "reasoning": value_val }));
                    }
                    _ => {}
                }
            }
        }
    }

    // Only emit if we successfully constructed a payload
    if let Some(payload_to_emit) = result_payload {
        handle_inference_response(
            request_id,
            "streaming",
            Some(payload_to_emit),
            None,
            app_handle,
        )?;
    }

    Ok(())
}

// Shared function to handle streaming inference for different providers
async fn handle_streaming<F, Fut>(
    request: &InferenceRequest,
    app_handle: &AppHandle,
    stream_fn: F,
) -> Result<String>
where
    F: FnOnce(
        Arc<Mutex<String>>, // Aggregated text response
        Arc<Mutex<String>>, // Aggregated reasoning response
        String,             // Request ID
        AppHandle,          // App handle
    ) -> Fut,
    Fut: std::future::Future<Output = Result<()>>,
{
    let response_text = Arc::new(Mutex::new(String::new()));
    let reasoning_text = Arc::new(Mutex::new(String::new()));
    let request_id = request.id.clone();
    let app_handle_clone = app_handle.clone();

    stream_fn(
        Arc::clone(&response_text),
        Arc::clone(&reasoning_text), // Pass reasoning text mutex
        request_id.clone(),
        app_handle_clone,
    )
    .await?;

    // Lock both mutexes to get the final aggregated strings
    let final_response = response_text
        .lock()
        .map(|guard| guard.clone())
        .map_err(|e| anyhow!("Response text mutex poisoned: {}", e))?;
    let final_reasoning = reasoning_text
        .lock()
        .map(|guard| guard.clone())
        .map_err(|e| anyhow!("Reasoning text mutex poisoned: {}", e))?;

    // Construct the final completed response payload
    let mut result_payload = serde_json::json!({
        "full_response": final_response.clone()
    });

    // Add reasoning only if it's not empty
    if !final_reasoning.is_empty() {
        if let Some(obj) = result_payload.as_object_mut() {
            obj.insert(
                "reasoning".to_string(),
                serde_json::Value::String(final_reasoning),
            );
        }
    }

    // Final completed response event
    handle_inference_response(
        &request.id,
        "completed",
        Some(result_payload),
        None,
        app_handle,
    )?;

    Ok(final_response) // Return only the main response text
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
                    |response_text, reasoning_text, request_id, app_handle_clone| async move {
                        aws_bedrock::converse_stream(request, specs, move |payload| {
                            // Emit the raw payload chunk
                            handle_streaming_chunk(&request_id, &payload, &app_handle_clone)?;

                            // Append to the correct string based on type
                            if let Some(obj) = payload.as_object() {
                                if let Some(type_val) = obj.get("type").and_then(|v| v.as_str()) {
                                    if let Some(value_val) =
                                        obj.get("value").and_then(|v| v.as_str())
                                    {
                                        match type_val {
                                            "text" => {
                                                if let Ok(mut response) = response_text.lock() {
                                                    response.push_str(value_val);
                                                }
                                            }
                                            "reasoning" => {
                                                if let Ok(mut reasoning) = reasoning_text.lock() {
                                                    reasoning.push_str(value_val);
                                                }
                                            }
                                            _ => {}
                                        }
                                    }
                                }
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
                    |response_text, _reasoning_text, request_id, app_handle_clone| async move {
                        // Note: OpenAI doesn't have separate reasoning stream yet, so _reasoning_text is unused
                        openai::converse_stream(request, specs, move |payload| {
                            // Emit the raw payload chunk
                            handle_streaming_chunk(&request_id, &payload, &app_handle_clone)?;

                            // OpenAI only sends text for now
                            if let Some(obj) = payload.as_object() {
                                if let Some(type_val) = obj.get("type").and_then(|v| v.as_str()) {
                                    if type_val == "text" {
                                        if let Some(value_val) =
                                            obj.get("value").and_then(|v| v.as_str())
                                        {
                                            if let Ok(mut response) = response_text.lock() {
                                                response.push_str(value_val);
                                            }
                                        }
                                    }
                                }
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
