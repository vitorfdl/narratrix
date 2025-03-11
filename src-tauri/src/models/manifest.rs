use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri::{AppHandle, Runtime};

/// A model hint that specifies a required field in the config
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelHint {
    /// The key name in the config JSON
    pub key: String,
    /// A description of what this field is used for
    pub description: String,
    /// Whether this field is required
    pub required: bool,
    /// The type of the field (e.g., "string", "number", "boolean")
    pub field_type: String,
}

/// The manifest for a model origin
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelManifest {
    /// A unique identifier for the model origin
    pub id: String,
    /// The display name of the model origin
    pub name: String,
    /// A description of the model origin
    pub description: String,
    /// The URL for the model origin's website or API documentation
    pub website: Option<String>,
    /// Hints about the fields required in the config
    pub hints: Vec<ModelHint>,
    /// Whether an API key is required
    pub requires_api_key: bool,
    /// The key name for the API key in the config JSON
    pub api_key_name: Option<String>,
    /// The key name for the model name in the config JSON (if applicable)
    pub model_name_key: Option<String>,
    /// Example models that can be used
    pub example_models: Option<Vec<String>>,
}

/// Manifest manager for handling model manifests
pub struct ManifestManager {
    manifests_dir: PathBuf,
    manifests: Vec<ModelManifest>,
}

impl ManifestManager {
    /// Create a new ManifestManager and load all manifests
    pub fn new<R: Runtime>(app_handle: &AppHandle<R>) -> Result<Self, String> {
        // Get the app data directory for manifests
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))?;

        // Create manifests directory inside the app dir if it doesn't exist
        let manifests_dir = app_dir.join("model_manifests");
        fs::create_dir_all(&manifests_dir)
            .map_err(|e| format!("Failed to create manifests directory: {}", e))?;

        // Also check for bundled manifests in the resource directory
        if let Ok(res_dir) = app_handle.path().resource_dir() {
            let bundled_manifests_dir = res_dir.join("manifests");

            // If bundled manifests exist and the app manifests directory is empty,
            // copy the bundled manifests to the app directory
            if bundled_manifests_dir.exists() {
                if fs::read_dir(&manifests_dir)
                    .map(|d| d.count() == 0)
                    .unwrap_or(true)
                {
                    copy_manifests(&bundled_manifests_dir, &manifests_dir)
                        .map_err(|e| format!("Failed to copy bundled manifests: {}", e))?;
                }
            }
        }

        // Load all manifests from the directory
        let manifests = load_manifests_from_dir(&manifests_dir)?;

        Ok(ManifestManager {
            manifests_dir,
            manifests,
        })
    }

    /// Get all loaded manifests
    pub fn get_all_manifests(&self) -> &Vec<ModelManifest> {
        &self.manifests
    }

    /// Get a manifest by its ID
    pub fn get_manifest_by_id(&self, id: &str) -> Option<&ModelManifest> {
        self.manifests.iter().find(|m| m.id == id)
    }

    /// Reload all manifests from the disk
    pub fn reload_manifests(&mut self) -> Result<(), String> {
        self.manifests = load_manifests_from_dir(&self.manifests_dir)?;
        Ok(())
    }

    /// Validate a config JSON against a manifest
    pub fn validate_config(&self, model_origin: &str, config: &str) -> Result<(), String> {
        // Get the manifest
        let manifest = self
            .get_manifest_by_id(model_origin)
            .ok_or_else(|| format!("Unknown model origin: {}", model_origin))?;

        // Parse the config JSON
        let config_json: JsonValue = serde_json::from_str(config)
            .map_err(|e| format!("Invalid JSON in config field: {}", e))?;

        // Validate required fields from the hints
        for hint in &manifest.hints {
            if hint.required {
                if !config_json.get(&hint.key).is_some() {
                    return Err(format!("Missing required field in config: {}", hint.key));
                }

                // Validate field type if specified
                if let Some(value) = config_json.get(&hint.key) {
                    match hint.field_type.as_str() {
                        "string" => {
                            if !value.is_string() {
                                return Err(format!("Field {} must be a string", hint.key));
                            }
                        }
                        "number" => {
                            if !value.is_number() {
                                return Err(format!("Field {} must be a number", hint.key));
                            }
                        }
                        "boolean" => {
                            if !value.is_boolean() {
                                return Err(format!("Field {} must be a boolean", hint.key));
                            }
                        }
                        "array" => {
                            if !value.is_array() {
                                return Err(format!("Field {} must be an array", hint.key));
                            }
                        }
                        "object" => {
                            if !value.is_object() {
                                return Err(format!("Field {} must be an object", hint.key));
                            }
                        }
                        _ => {} // Skip validation for unknown types
                    }
                }
            }
        }

        // Check if API key is required and present
        if manifest.requires_api_key {
            if let Some(key_name) = &manifest.api_key_name {
                if !config_json.get(key_name).is_some() {
                    return Err(format!("Missing required API key field: {}", key_name));
                }
            } else {
                return Err(
                    "API key is required but the key name is not specified in the manifest"
                        .to_string(),
                );
            }
        }

        Ok(())
    }
}

/// Load all manifest files from a directory
fn load_manifests_from_dir(dir: &Path) -> Result<Vec<ModelManifest>, String> {
    let mut manifests = Vec::new();

    // Read the directory
    let entries =
        fs::read_dir(dir).map_err(|e| format!("Failed to read manifests directory: {}", e))?;

    // Process each entry
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Skip if not a file or not a JSON file
        if !path.is_file() || path.extension().map_or(true, |ext| ext != "json") {
            continue;
        }

        // Read and parse the file
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read manifest file {}: {}", path.display(), e))?;

        let manifest: ModelManifest = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse manifest file {}: {}", path.display(), e))?;

        manifests.push(manifest);
    }

    Ok(manifests)
}

/// Copy manifests from one directory to another
fn copy_manifests(from_dir: &Path, to_dir: &Path) -> Result<(), String> {
    // Read the source directory
    let entries = fs::read_dir(from_dir)
        .map_err(|e| format!("Failed to read source manifests directory: {}", e))?;

    // Process each entry
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Skip if not a file or not a JSON file
        if !path.is_file() || path.extension().map_or(true, |ext| ext != "json") {
            continue;
        }

        // Create the destination path
        let file_name = path.file_name().unwrap();
        let dest_path = to_dir.join(file_name);

        // Copy the file
        fs::copy(&path, &dest_path).map_err(|e| {
            format!(
                "Failed to copy manifest from {} to {}: {}",
                path.display(),
                dest_path.display(),
                e
            )
        })?;
    }

    Ok(())
}

/// Expose Tauri command to get all available model manifests
#[tauri::command]
pub async fn get_all_model_manifests<R: Runtime>(
    app_handle: AppHandle<R>,
) -> Result<Vec<ModelManifest>, String> {
    let manager = ManifestManager::new(&app_handle)?;
    Ok(manager.get_all_manifests().clone())
}

/// Expose Tauri command to get a specific model manifest by ID
#[tauri::command]
pub async fn get_model_manifest_by_id<R: Runtime>(
    app_handle: AppHandle<R>,
    id: String,
) -> Result<Option<ModelManifest>, String> {
    let manager = ManifestManager::new(&app_handle)?;
    Ok(manager.get_manifest_by_id(&id).cloned())
}
