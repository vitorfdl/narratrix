import { invoke } from "@tauri-apps/api/core";

// Type interfaces that match the Rust types
export interface ProfileResponse {
  id: string;
  name: string;
  avatar_path: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface NewProfile {
  name: string;
  password: string;
  avatar_path: string | null;
}

export interface LoginRequest {
  name: string;
  password: string;
}

export interface UpdateProfileRequest {
  name?: string;
  password?: string;
  avatar_path?: string | null;
}

// Profile related commands
export async function createProfile(
  profile: NewProfile,
): Promise<ProfileResponse> {
  return await invoke<ProfileResponse>("create_profile", { profile });
}

export async function getProfiles(): Promise<ProfileResponse[]> {
  return await invoke<ProfileResponse[]>("get_profiles");
}

export async function getProfileById(
  id: string,
): Promise<ProfileResponse | null> {
  return await invoke<ProfileResponse | null>("get_profile_by_id", { id });
}

export async function updateProfile(
  id: string,
  update: UpdateProfileRequest,
): Promise<ProfileResponse> {
  return await invoke<ProfileResponse>("update_profile", { id, update });
}

export async function deleteProfile(id: string): Promise<void> {
  return await invoke<void>("delete_profile", { id });
}

export async function loginProfile(
  login: LoginRequest,
): Promise<ProfileResponse> {
  return await invoke<ProfileResponse>("login_profile", { login });
}
