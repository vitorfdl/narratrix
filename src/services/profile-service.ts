import { formatDateTime } from "@/utils/date-time.ts";
import { hashPassword, verifyPassword } from "../commands/security.ts";
import {
  type AppSettings,
  LoginPasswordParams,
  LoginPasswordSchema,
  NewProfileParams,
  type Profile,
  type ProfileResponse,
  ProfileSchema,
  updateProfileSchema,
} from "../schema/profiles-schema.ts";
import { uuidUtils } from "../schema/utils-schema.ts";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database.ts";

// Profile related functions
export async function createProfile(profileData: NewProfileParams): Promise<ProfileResponse> {
  // Validate input with Zod schema
  const profile = await ProfileSchema.parseAsync(profileData);

  const id = crypto.randomUUID();

  // Hash the password
  const hashedPassword = profile.password ? await hashPassword(profile.password) : undefined;

  // Use default empty object for settings if not provided
  const settings = profile.settings || {};

  await executeDBQuery(
    `INSERT INTO profiles (id, name, password, avatar_path, settings, quick_actions, version, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      profile.name,
      hashedPassword,
      profile.avatar_path,
      JSON.stringify(settings),
      JSON.stringify(profile.quick_actions),
      profile.version,
      profile.created_at,
      profile.updated_at,
    ],
  );

  // Return a validated ProfileResponse
  const response: ProfileResponse = {
    id,
    name: profile.name,
    avatar_path: profile.avatar_path,
    settings,
    quick_actions: profile.quick_actions,
    version: profile.version,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    hasPassword: !!profile.password,
  };

  return response;
}

export async function getProfiles() {
  const result = await selectDBQuery<Omit<ProfileResponse, "settings">[]>(
    `SELECT 
      id, 
      name, 
      avatar_path,
      version,
      created_at,
      (password IS NOT NULL AND trim(password) != '') as hasPassword
    FROM profiles`,
  );

  // Validate each result with the ProfileSummarySchema
  return result.map((profile) => ({
    ...profile,
    hasPassword: !!profile.hasPassword,
  }));
}

export async function getProfileById(id: string): Promise<ProfileResponse | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<ProfileResponse[]>(
    `SELECT 
        id, 
        name, 
        avatar_path, 
        settings,
        quick_actions,
        version,
        created_at, 
        updated_at,
        (password IS NOT NULL AND trim(password) != '') as hasPassword
      FROM profiles 
      WHERE id = $1`,
    [validId],
  );

  if (result.length === 0) {
    return null;
  }

  // Parse settings from string to object if needed
  const profile = result[0];
  profile.settings = typeof profile.settings === "string" ? JSON.parse(profile.settings) : profile.settings;
  profile.quick_actions = typeof profile.quick_actions === "string" ? JSON.parse(profile.quick_actions) : profile.quick_actions;

  // Ensure hasPassword is a boolean
  profile.hasPassword = !!profile.hasPassword;

  // Validate with ProfileResponseSchema
  return profile;
}

export async function updateProfile(id: string, updateData: Partial<Profile>): Promise<ProfileResponse> {
  const validId = uuidUtils.uuid().parse(id);
  const update = updateProfileSchema.parse(updateData);

  // First get the current profile to merge settings
  const currentProfile = await getProfileById(validId);
  if (!currentProfile) {
    throw new Error("Profile not found");
  }

  // Handle settings merge if needed
  const processedUpdate = { ...update };
  if (update.settings) {
    processedUpdate.settings = {
      ...currentProfile.settings,
      ...update.settings,
    };
  }
  // Define field mappings for special transformations
  const fieldMapping: Partial<Record<keyof Profile, (value: any) => any>> = {
    password: async (pwd: string) => await hashPassword(pwd),
    settings: (settings: object) => JSON.stringify(settings),
    quick_actions: (quick_actions: object) => JSON.stringify(quick_actions),
  };

  // Build update query using the utility function
  const { updates, values, whereClause } = buildUpdateParams(validId, processedUpdate, fieldMapping);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE profiles SET ${updates.join(", ")}${whereClause}`, values);
  }

  // Return the updated profile
  const updatedProfile = await getProfileById(validId);
  if (!updatedProfile) {
    throw new Error("Profile updated but could not be retrieved");
  }

  return updatedProfile;
}

export async function deleteProfile(id: string): Promise<void> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  await executeDBQuery("DELETE FROM profiles WHERE id = $1", [validId]);
}

export async function loginProfile(loginData: LoginPasswordParams): Promise<ProfileResponse> {
  // Validate input with Zod schema
  const login = LoginPasswordSchema.parse(loginData);

  // Get the profile by name
  const profiles = await selectDBQuery<Array<Profile>>(
    `SELECT 
      id, 
      name, 
      password,
      avatar_path, 
      settings,
      quick_actions,
      version,
      created_at, 
      updated_at 
    FROM profiles 
    WHERE id = $1`,
    [login.id],
  );

  if (profiles.length === 0) {
    throw new Error("Profile not found");
  }

  const profile = profiles[0];

  // Verify the password
  const isValid = profile.password ? await verifyPassword(login.password || "", profile.password) : true;
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  // Parse settings from string to object if needed
  profile.settings = typeof profile.settings === "string" ? JSON.parse(profile.settings) : profile.settings;
  profile.quick_actions = typeof profile.quick_actions === "string" ? JSON.parse(profile.quick_actions) : profile.quick_actions;
  // Remove password field from the response
  const { password, ...profileResponse } = profile;

  return { ...profileResponse, hasPassword: !!password };
}

export async function updateProfileSettings(id: string, settings: AppSettings): Promise<ProfileResponse> {
  const validId = uuidUtils.uuid().parse(id);

  // First get the current profile to ensure it exists
  const currentProfile = await getProfileById(validId);
  if (!currentProfile) {
    throw new Error("Profile not found");
  }

  const now = formatDateTime();

  // Update just the settings field
  await executeDBQuery("UPDATE profiles SET settings = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(settings), now, validId]);

  // Return the updated profile
  const updatedProfile = await getProfileById(validId);
  if (!updatedProfile) {
    throw new Error("Profile updated but could not be retrieved");
  }

  return updatedProfile;
}

export async function updateProfilePassword(id: string, currentPassword: string, newPassword: string | null): Promise<ProfileResponse> {
  const validId = uuidUtils.uuid().parse(id);

  // First get the profile to verify the current password
  const profiles = await selectDBQuery<Profile[]>("SELECT id, password FROM profiles WHERE id = $1", [validId]);

  if (profiles.length === 0) {
    throw new Error("Profile not found");
  }

  const profile = profiles[0];

  // Verify the current password
  if (profile.password) {
    const isValid = await verifyPassword(currentPassword, profile.password);
    if (!isValid) {
      throw new Error("Invalid current password");
    }
  }

  // Hash new password
  const hashedPassword = newPassword ? await hashPassword(newPassword) : null;
  const now = formatDateTime();

  // Update the password
  await executeDBQuery("UPDATE profiles SET password = $1, updated_at = $2 WHERE id = $3", [hashedPassword, now, validId]);

  // Return the updated profile
  const updatedProfile = await getProfileById(validId);
  if (!updatedProfile) {
    throw new Error("Profile updated but could not be retrieved");
  }

  return updatedProfile;
}

// Export type definitions
export type { Profile, ProfileResponse };
