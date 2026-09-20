import type { SheetSection } from "@/schema/template-character-sheet-schema";
import { createCharacterSheetTemplate } from "@/services/template-character-sheet-service";
import characterSheets from "@/services/update-profile/data/character_sheets.json";
import { ProfileResponse } from "../profile-service";

/**
 * Migration for version 13:
 * - Import bundled character sheet templates (DnD 5E, Novel Protagonist) and
 *   create them in the database for the current profile.
 */
const v13Migration = async (profile: ProfileResponse): Promise<ProfileResponse> => {
  try {
    if (!profile?.id) {
      throw new Error("Profile ID is required for character sheet template migration");
    }

    if (Array.isArray(characterSheets)) {
      for (const template of characterSheets) {
        try {
          await createCharacterSheetTemplate({
            profile_id: profile.id,
            name: template.name,
            favorite: false,
            sections: template.sections as SheetSection[],
          });
        } catch (err) {
          console.error(`Migration v13: Failed to create character sheet template '${template.name}'`, err);
        }
      }
    } else {
      console.warn("Migration v13: characterSheets is not an array");
    }
  } catch (error) {
    // Log and continue with the original profile
    console.error("Migration v13: Error importing character sheet templates", error);
  }

  return profile;
};

export { v13Migration };
