use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use env_vars::get_master_key;
use rand::{rngs::OsRng, RngCore};
use std::convert::TryInto; // Required for try_into()

mod env_vars;

// Helper function to hash a password using Argon2
#[tauri::command(scope = "app")]
pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| format!("Failed to hash password: {}", e))
}

// Helper function to verify a password against its hash
#[tauri::command(scope = "app")]
pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| format!("Failed to parse password hash: {}", e))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

// Helper function to encrypt an API key
#[tauri::command(scope = "app")]
pub fn encrypt_api_key(api_key: &str) -> Result<String, String> {
    // Generate a random salt for this encryption
    let salt = SaltString::generate(&mut OsRng);
    // Use the full PHC string representation
    let salt_phc_string = salt.to_string(); // Use to_string() for ownership
    let salt_bytes = salt_phc_string.as_bytes();
    let salt_len = salt_bytes.len() as u32; // Store length as u32

    // Derive key using this salt string
    let key = derive_encryption_key_with_salt(&salt_phc_string)?;

    // Create cipher instance
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Generate a random 12-byte nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt the API key
    let ciphertext = cipher
        .encrypt(nonce, api_key.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Combine salt length, salt bytes, nonce and ciphertext
    let mut combined = Vec::new();
    combined.extend_from_slice(&salt_len.to_be_bytes()); // Add length prefix (4 bytes)
    combined.extend_from_slice(salt_bytes); // Add salt bytes
    combined.extend_from_slice(&nonce_bytes); // Add nonce (12 bytes)
    combined.extend_from_slice(&ciphertext); // Add ciphertext

    Ok(BASE64.encode(combined))
}

// Helper function to decrypt an API key
#[tauri::command(scope = "app")]
pub fn decrypt_api_key(encrypted_api_key: &str) -> Result<String, String> {
    // Decode the base64 string
    let combined = BASE64
        .decode(encrypted_api_key)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Minimum length: 4 (len) + 0 (salt) + 12 (nonce)
    if combined.len() < 16 {
        return Err("Invalid encrypted data format: too short".to_string());
    }

    // Extract salt length (first 4 bytes)
    let salt_len_bytes: [u8; 4] = combined[..4]
        .try_into()
        .map_err(|_| "Failed to read salt length".to_string())?;
    let salt_len = u32::from_be_bytes(salt_len_bytes) as usize;

    // Calculate end indices
    let salt_end_index = 4 + salt_len;
    let nonce_end_index = salt_end_index + 12;

    // Check if combined length is sufficient for salt, nonce, and potentially ciphertext
    if combined.len() < nonce_end_index {
        return Err(format!(
            "Invalid encrypted data format: length mismatch. Expected at least {}, got {}",
            nonce_end_index,
            combined.len()
        ));
    }

    // Extract salt bytes
    let salt_bytes = &combined[4..salt_end_index];
    // Convert salt bytes back to string (PHC format string is ASCII/UTF-8)
    let salt_phc_string = String::from_utf8(salt_bytes.to_vec())
        .map_err(|e| format!("Failed to parse salt bytes as UTF-8: {}", e))?;

    // Derive key using the parsed salt string
    let key = derive_encryption_key_with_salt(&salt_phc_string)?;

    // Create cipher instance
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Extract nonce and ciphertext
    let nonce_bytes = &combined[salt_end_index..nonce_end_index];
    // Ensure nonce is exactly 12 bytes before creating Nonce slice
    if nonce_bytes.len() != 12 {
        return Err(format!(
            "Invalid nonce length: expected 12, got {}",
            nonce_bytes.len()
        ));
    }
    let nonce = Nonce::from_slice(nonce_bytes); // Safe now
    let ciphertext = &combined[nonce_end_index..];

    // Decrypt the API key
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext)
        .map_err(|e| format!("Failed to convert decrypted data to string: {}", e))
}

fn derive_encryption_key_with_salt(salt_phc_string: &str) -> Result<[u8; 32], String> {
    let master_key = get_master_key("MASTER_KEY");

    // Parse the full PHC string. Use 'new' as it handles PHC format.
    let salt = SaltString::new(salt_phc_string)
        .map_err(|e| format!("Failed to parse salt PHC string: {}", e))?;

    let argon2 = Argon2::default();

    // Derive hash using the parsed salt
    let hash = argon2
        .hash_password(master_key.as_bytes(), &salt) // Pass the parsed SaltString
        .map_err(|e| format!("Failed to derive key: {}", e))?;

    // Extract the raw hash bytes directly
    let output = hash
        .hash
        .ok_or_else(|| "Hash missing from PasswordHash".to_string())?;
    let hash_bytes = output.as_bytes();

    // Ensure the hash is long enough
    if hash_bytes.len() < 32 {
        return Err("Derived hash is too short for a 32-byte key".to_string());
    }

    // Use the first 32 bytes of the raw hash as the encryption key
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash_bytes[..32]);

    Ok(key)
}
