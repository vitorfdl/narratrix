export interface Profile {
  id: string;
  name: string;
  avatar_path?: string;
  hasPassword: boolean;
  password?: string; // Only used when creating/updating a profile
  created_at?: string | null;
}

export interface ProfileState {
  profiles: Profile[];
  currentProfileId: string | null;
  isAuthenticated: boolean;
}

export type ProfileAction =
  | { type: "SET_PROFILES"; payload: Profile[] }
  | { type: "ADD_PROFILE"; payload: Profile }
  | { type: "REMOVE_PROFILE"; payload: string }
  | { type: "SET_CURRENT_PROFILE"; payload: string }
  | { type: "LOGOUT" }
  | { type: "SET_AUTHENTICATED"; payload: boolean };

export const MAX_PROFILES = 5;
