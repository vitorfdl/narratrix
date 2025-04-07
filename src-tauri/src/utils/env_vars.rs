// src-tauri/src/config.rs
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::env;

// Load environment variables once at startup
static ENV_VARS: Lazy<HashMap<String, String>> = Lazy::new(|| {
    // Try to load .env file in development, no-op if file doesn't exist
    let _ = dotenvy::dotenv();

    // Create a HashMap with all environment variables
    env::vars().collect()
});

/// Get environment variable from multiple sources
///
/// 1. First checks compile-time environment variables (for production builds)
/// 2. Then checks runtime environment variables (including those from .env files)
/// 3. Finally uses the provided default value if no variable is found
pub fn get_master_key(default: &str) -> String {
    // First try compile-time environment variables (works in GitHub Actions)
    if let Some(value) = option_env!("MASTER_KEY") {
        if !value.is_empty() {
            return value.to_string();
        }
    }

    // Then check runtime environment variables (works with .env in development)
    match ENV_VARS.get("MASTER_KEY") {
        Some(value) if !value.is_empty() => value.clone(),
        _ => default.to_string(),
    }
}
