pub mod timestamps;

// Re-export commonly used utilities
pub use timestamps::{add_timestamps, now, update_timestamp, Timestamps};

pub fn merge_settings(current: &serde_json::Value, new: &serde_json::Value) -> serde_json::Value {
    if current.is_object() && new.is_object() {
        let mut result = current.clone();
        if let Some(result_obj) = result.as_object_mut() {
            for (key, value) in new.as_object().unwrap() {
                result_obj.insert(key.clone(), value.clone());
            }
        }
        result
    } else {
        new.clone()
    }
}
