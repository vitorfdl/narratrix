import { type ProfileResponse } from "@/schema/profiles-schema";
import { getProfileById, updateProfile } from "@/services/profile-service";
import { v10Migration } from "./version_10";
import { v11Migration } from "./version_11";
import { v12Migration } from "./version_12";

// Type for a migration function
export type ProfileMigration = (profile: ProfileResponse) => Promise<ProfileResponse>;

// Map of version numbers to migration functions
const migrations: Record<number, () => Promise<ProfileMigration>> = {
  10: async () => v10Migration,
  11: async () => v11Migration,
  12: async () => v12Migration,
  // Add future migrations here
};

/**
 * Runs all necessary migrations for a profile, in order, updating the profile in the database after each step.
 * @param profileId The profile's unique ID
 * @returns The fully migrated profile
 */
export async function runProfileMigrations(profileId: string): Promise<ProfileResponse> {
  let profile = await getProfileById(profileId);
  if (!profile) {
    throw new Error("Profile not found for migration");
  }
  const currentVersion = profile.version ?? 0;
  console.log(`Running migrations for profile ${profileId} from version ${currentVersion}`);

  const migrationVersions = Object.keys(migrations)
    .map(Number)
    .filter((v) => v > currentVersion)
    .sort((a, b) => a - b);

  for (const version of migrationVersions) {
    const getMigration = migrations[version];
    if (!getMigration) {
      continue;
    }
    const migrate = await getMigration();
    if (typeof migrate !== "function") {
      throw new Error(`Migration for version ${version} is not a function`);
    }
    // Migration functions should accept and return ProfileResponse
    profile = await migrate(profile);
    const updated = await updateProfile(profile.id, { ...profile, version });
    if (!updated) {
      throw new Error(`Failed to update profile at version ${version}`);
    }
    profile = updated;
  }
  return profile;
}
