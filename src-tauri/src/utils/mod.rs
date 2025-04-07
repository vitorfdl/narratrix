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

// Helper function to derive an encryption key from a master key
fn derive_encryption_key() -> Result<[u8; 32], String> {
    // Get master key at compile time
    let master_key = get_master_key("MASTER_KEY");

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let hash = argon2
        .hash_password(master_key.as_bytes(), &salt)
        .map_err(|e| format!("Failed to derive key: {}", e))?;

    // Use the hash as the encryption key (first 32 bytes)
    let hash_str = hash.to_string();
    let mut key = [0u8; 32];

    for (i, byte) in hash_str.as_bytes().iter().enumerate().take(32) {
        key[i] = *byte;
    }

    Ok(key)
}

// Helper function to encrypt an API key
#[tauri::command(scope = "app")]
pub fn encrypt_api_key(api_key: &str) -> Result<String, String> {
    // Generate a secure key from the master key
    let key = derive_encryption_key()?;

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

    // Combine nonce and ciphertext and encode as base64
    let mut combined = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(combined))
}

// Helper function to decrypt an API key
#[tauri::command(scope = "app")]
pub fn decrypt_api_key(encrypted_api_key: &str) -> Result<String, String> {
    // Generate a secure key from the master key
    let key = derive_encryption_key()?;

    // Create cipher instance
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Decode the base64 string
    let combined = BASE64
        .decode(encrypted_api_key)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Extract nonce and ciphertext
    if combined.len() < 12 {
        return Err("Invalid encrypted data format".to_string());
    }

    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];

    // Decrypt the API key
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext)
        .map_err(|e| format!("Failed to convert decrypted data to string: {}", e))
}
