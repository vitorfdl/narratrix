import { NewFormatTemplate, SystemPromptType } from "@/schema/template-format-schema";
import { createFormatTemplate } from "@/services/template-format-service";
import formatTemplates from "@/services/update-profile/data/format_template.json";
import { ProfileResponse } from "../profile-service";

/**
 * Migration for version 12:
 * - Import bundled format templates and create them in the database for the current profile.
 * - Similar to v11 migration but for format templates instead of inference templates.
 */
const v12Migration = async (profile: ProfileResponse): Promise<ProfileResponse> => {
  try {
    if (!profile?.id) {
      throw new Error("Profile ID is required for format template migration");
    }

    if (Array.isArray(formatTemplates)) {
      for (const template of formatTemplates) {
        try {
          // Create a new format template with the current profile ID
          const params: NewFormatTemplate = {
            profile_id: profile.id,
            name: template.name,
            config: {
              settings: {
                ...template.config.settings,
                prefix_messages: template.config.settings.prefix_messages as "never" | "always" | "characters",
              },
              reasoning: template.config.reasoning,
              context_separator: template.config.context_separator,
              lorebook_separator: template.config.lorebook_separator,
            },
            prompts: template.prompts.map((prompt) => ({
              type: prompt.type as SystemPromptType,
              content: prompt.content,
            })),
          };

          await createFormatTemplate(params);
        } catch (err) {
          console.error(`Migration v12: Failed to create format template '${template.name}'`, err);
        }
      }
    } else {
      console.warn("Migration v12: formatTemplates is not an array");
    }
  } catch (error) {
    // Log and continue with the original profile
    console.error("Migration v12: Error importing format templates", error);
  }

  return profile;
};

export { v12Migration };
