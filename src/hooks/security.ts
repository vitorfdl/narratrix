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
async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await invoke<boolean>("verify_password", {
    password,
    hash,
  });
}

export { hashPassword, verifyPassword };
