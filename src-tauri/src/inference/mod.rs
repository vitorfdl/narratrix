use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::runtime::Runtime;
use tokio::sync::{mpsc, Semaphore};
use tokio::task::JoinHandle;

// Add this to expose our LLM module
mod llm;
pub mod tokenizer;
pub use llm::process_inference;
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct InferenceMessage {
    pub role: String, // Must be either "assistant" or "user"
    pub text: String,
    pub system: Option<String>,
    pub tool_calls: Option<Vec<InferenceToolCall>>,
    pub thinking: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct InferenceToolCall {
    pub name: String,
    pub arguments: serde_json::Value,
}

// Types for inference requests and responses
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct InferenceRequest {
    pub id: String,
    pub message_list: Vec<InferenceMessage>,
    pub system_prompt: Option<String>,
    pub parameters: serde_json::Value,
    pub stream: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct InferenceResponse {
    pub request_id: String,
    pub status: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

// Model specs for controlling concurrency
#[derive(Clone, Debug, Deserialize)]
pub struct ModelSpecs {
    pub id: String,
    pub model_type: String, // "completion" or "chat"
    pub config: serde_json::Value,
    pub max_concurrent_requests: usize,
    pub engine: String,
}

// Simplified Model Queue
struct ModelQueue {
    sender: mpsc::Sender<InferenceRequest>,
    active_tasks: Arc<Mutex<HashMap<String, JoinHandle<()>>>>,
    is_empty: Arc<Mutex<bool>>,
}

// Queue manager to handle all model queues
pub struct InferenceQueueManager {
    queues: HashMap<String, ModelQueue>,
    app_handle: AppHandle,
    runtime: Arc<Runtime>,
}

impl InferenceQueueManager {
    pub fn new(app_handle: AppHandle) -> Self {
        // Create a Tokio runtime for async operations
        let runtime = Arc::new(Runtime::new().expect("Failed to create Tokio runtime"));

        Self {
            queues: HashMap::new(),
            app_handle,
            runtime,
        }
    }

    pub fn add_request(&mut self, request: InferenceRequest, specs: ModelSpecs) {
        let model_id = specs.id.clone();

        // Create queue if it doesn't exist
        if !self.queues.contains_key(&model_id) {
            self.create_queue(model_id.clone(), specs);
        }

        // Get the queue and send the request
        if let Some(queue) = self.queues.get_mut(&model_id) {
            // Mark the queue as not empty
            if let Ok(mut is_empty) = queue.is_empty.lock() {
                *is_empty = false;
            }

            // Send the request to the queue
            let sender = queue.sender.clone();
            let request_clone = request.clone();

            self.runtime.spawn(async move {
                if let Err(e) = sender.send(request_clone).await {
                    eprintln!("Failed to send request to queue: {}", e);
                }
            });
        }
    }

    // Cancel a specific request by simply aborting the task
    pub fn cancel_request(&mut self, model_id: &str, request_id: &str) -> bool {
        if let Some(queue) = self.queues.get_mut(model_id) {
            if let Ok(mut active_tasks) = queue.active_tasks.lock() {
                if let Some(handle) = active_tasks.remove(request_id) {
                    // Abort the task without waiting for it
                    handle.abort();

                    // Send a cancelled response
                    let response = InferenceResponse {
                        request_id: request_id.to_string(),
                        status: "cancelled".to_string(),
                        result: None,
                        error: Some("Request was cancelled".to_string()),
                    };

                    // Emit the cancellation event
                    let _ = self.app_handle.emit("inference-response", response);

                    return true;
                }
            }
        }
        false
    }

    // Check and clean up any empty queues
    pub fn clean_empty_queues(&mut self) {
        let mut empty_queues = Vec::new();

        // Find empty queues
        for (model_id, queue) in &self.queues {
            if let Ok(is_empty) = queue.is_empty.lock() {
                if *is_empty {
                    if let Ok(active_tasks) = queue.active_tasks.lock() {
                        if active_tasks.is_empty() {
                            empty_queues.push(model_id.clone());
                        }
                    }
                }
            }
        }

        // Remove empty queues
        for model_id in empty_queues {
            self.queues.remove(&model_id);
            println!("Removed empty queue for model: {}", model_id);
        }
    }

    fn create_queue(&mut self, model_id: String, specs: ModelSpecs) {
        let app_handle = self.app_handle.clone();
        let runtime = self.runtime.clone();

        // Clone for the spawn task
        let model_id_for_task = model_id.clone();

        // Create a channel for the queue
        let (sender, mut receiver) = mpsc::channel::<InferenceRequest>(100);

        // Create a semaphore to limit concurrent processing
        let semaphore = Arc::new(Semaphore::new(specs.max_concurrent_requests));

        // Create a shared empty state flag
        let is_empty = Arc::new(Mutex::new(true));
        let is_empty_clone = is_empty.clone();

        // Create a map to store active task handles
        let active_tasks = Arc::new(Mutex::new(HashMap::<String, JoinHandle<()>>::new()));
        let active_tasks_clone = active_tasks.clone();

        // Spawn a task to process requests from the queue
        runtime.spawn(async move {
            while let Some(request) = receiver.recv().await {
                let request_id = request.id.clone();

                // Acquire semaphore permit
                let permit = match semaphore.clone().acquire_owned().await {
                    Ok(permit) => permit,
                    Err(e) => {
                        eprintln!("Failed to acquire semaphore: {}", e);
                        continue;
                    }
                };

                let request_clone = request.clone();
                let model_id_clone = model_id_for_task.clone();
                let app_handle_clone = app_handle.clone();
                let active_tasks = active_tasks_clone.clone();
                let is_empty = is_empty_clone.clone();
                let specs_clone = specs.clone();
                let request_id_clone = request_id.clone();

                // Process the request in a separate task and store its handle
                let handle = tokio::spawn(async move {
                    // Process the inference request
                    let result =
                        process_inference(&request_clone, &specs_clone, app_handle_clone.clone())
                            .await;

                    // Handle the result
                    match result {
                        Ok(_) => {}
                        Err(e) => {
                            // Error processing
                            let error_json = match serde_json::to_string(&serde_json::json!({
                                "message": e.to_string(),
                                "details": format!("{:?}", e),
                                "source": e.source().map(|s| s.to_string())
                            })) {
                                Ok(json) => Some(json),
                                Err(_) => Some(e.to_string()),
                            };

                            let response = InferenceResponse {
                                request_id: request_clone.id.clone(),
                                status: "error".to_string(),
                                result: None,
                                error: error_json,
                            };

                            // Use the result to check if emission succeeded
                            if let Err(e) = app_handle_clone.emit("inference-response", response) {
                                eprintln!("Failed to emit inference error event: {}", e);
                            }
                        }
                    }

                    // Clean up when the task is done
                    if let Ok(mut tasks) = active_tasks.lock() {
                        tasks.remove(&request_id_clone);

                        // If there are no active tasks, mark the queue as empty
                        if tasks.is_empty() {
                            if let Ok(mut empty) = is_empty.lock() {
                                *empty = true;
                            }
                        }
                    }

                    // Drop the permit when done
                    drop(permit);
                });

                // Store the task handle for potential cancellation
                if let Ok(mut tasks) = active_tasks_clone.lock() {
                    tasks.insert(request_id, handle);
                }
            }
        });

        // Add the queue to the map
        self.queues.insert(
            model_id.clone(),
            ModelQueue {
                sender,
                active_tasks,
                is_empty,
            },
        );
    }
}

// Shared state for the inference queue
pub struct InferenceState {
    pub queue_manager: Mutex<InferenceQueueManager>,
}

impl InferenceState {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            queue_manager: Mutex::new(InferenceQueueManager::new(app_handle)),
        }
    }
}

#[tauri::command]
pub fn queue_inference_request(
    state: tauri::State<'_, Arc<InferenceState>>,
    request: InferenceRequest,
    specs: ModelSpecs,
) -> Result<String, String> {
    let mut manager = state.queue_manager.lock().map_err(|e| e.to_string())?;
    manager.add_request(request.clone(), specs);
    Ok(request.id)
}

#[tauri::command]
pub fn cancel_inference_request(
    state: tauri::State<'_, Arc<InferenceState>>,
    model_id: String,
    request_id: String,
) -> Result<bool, String> {
    let mut manager = state.queue_manager.lock().map_err(|e| e.to_string())?;
    let result = manager.cancel_request(&model_id, &request_id);
    Ok(result)
}

#[tauri::command]
pub fn clean_inference_queues(state: tauri::State<'_, Arc<InferenceState>>) -> Result<(), String> {
    let mut manager = state.queue_manager.lock().map_err(|e| e.to_string())?;
    manager.clean_empty_queues();
    Ok(())
}
