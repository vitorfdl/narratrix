import { invoke } from "@tauri-apps/api/core";

/**
 * Hash a password using Argon2
 * @param password The password to hash
 * @returns A promise that resolves to the hashed password
 */
async function hashPassword(password: string): Promise<string> {
  return await invoke<string>("hash_password", { password });
}

/**
 * Verify a password against a hash
 * @param password The password to verify
 * @param hash The hash to verify against
 * @returns A promise that resolves to a boolean indicating if the password is valid
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await invoke<boolean>("verify_password", {
    password,
    hash,
  });
}

/**
 * Encrypt an API key using the backend encryption function
 * @param apiKey The API key to encrypt
 * @returns A promise that resolves to the encrypted API key or rejects with an error message
 */
async function encryptApiKey(apiKey: string): Promise<string> {
  try {
    return await invoke<string>("encrypt_api_key", { apiKey });
  } catch (error) {
    throw new Error(`Failed to encrypt API key: ${error}`);
  }
}

/**
 * Decrypt an API key using the backend decryption function
 * @param encryptedApiKey The encrypted API key to decrypt
 * @returns A promise that resolves to the decrypted API key or rejects with an error message
 */
async function decryptApiKey(encryptedApiKey: string): Promise<string> {
  try {
    return await invoke<string>("decrypt_api_key", { encryptedApiKey });
  } catch (error) {
    
    throw new Error(`Failed to decrypt API key: ${error}`);
  }
}

export { decryptApiKey, encryptApiKey, hashPassword, verifyPassword };
