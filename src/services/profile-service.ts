import { hashPassword, verifyPassword } from "../commands/security.ts";
import { LoginPasswordParams, LoginPasswordSchema, NewProfileParams, type Profile, type ProfileResponse, ProfileSchema } from "../schema/profiles-schema.ts";
import { uuidUtils } from "../schema/utils-schema.ts";
import { executeDBQuery, selectDBQuery } from "../utils/database.ts";

// Helper to format dates
function formatDateTime(): string {
  return new Date().toISOString();
}

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
    `INSERT INTO profiles (id, name, password, avatar_path, settings, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, profile.name, hashedPassword, profile.avatar_path, JSON.stringify(settings), profile.created_at, profile.updated_at],
  );

  // Return a validated ProfileResponse
  const response: ProfileResponse = {
    id,
    name: profile.name,
    avatar_path: profile.avatar_path,
    settings,
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
        created_at, 
        updated_at 
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

  // Validate with ProfileResponseSchema
  return profile;
}

export async function updateProfile(id: string, updateData: Partial<Profile>): Promise<ProfileResponse> {
  const validId = uuidUtils.uuid().parse(id);
  const update = ProfileSchema.parse(updateData);

  // First get the current profile to merge settings
  const currentProfile = await getProfileById(validId);
  if (!currentProfile) {
    throw new Error("Profile not found");
  }

  // Build query parts
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (update.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    values.push(update.name);
    paramIndex++;
  }

  if (update.password !== undefined) {
    const hashedPassword = await hashPassword(update.password!);
    updates.push(`password = $${paramIndex}`);
    values.push(hashedPassword);
    paramIndex++;
  }

  if (update.avatar_path !== undefined) {
    updates.push(`avatar_path = $${paramIndex}`);
    values.push(update.avatar_path);
    paramIndex++;
  }

  if (update.settings !== undefined) {
    // Merge with existing settings
    const mergedSettings = {
      ...currentProfile.settings,
      ...update.settings,
    };
    updates.push(`settings = $${paramIndex}`);
    values.push(JSON.stringify(mergedSettings));
    paramIndex++;
  }

  // Always update the updated_at timestamp
  const now = formatDateTime();
  updates.push(`updated_at = $${paramIndex}`);
  values.push(now);
  paramIndex++;

  // Add the ID for the WHERE clause
  values.push(validId);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE profiles SET ${updates.join(", ")} WHERE id = $${paramIndex}`, values);
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

  // Remove password field from the response
  const { password, ...profileResponse } = profile;

  return { ...profileResponse, hasPassword: !!password };
}

// Export type definitions
export type { Profile, ProfileResponse };
