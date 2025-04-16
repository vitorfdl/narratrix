import { CreateInferenceTemplateParams } from "@/schema/template-inferance-schema";
import { createInferenceTemplate } from "@/services/template-inference-service";
import inferenceTemplates from "@/services/update-profile/data/inference_templates.json";
import { ProfileResponse } from "../profile-service";

/**
 * Migration for version 11:
 * - Import bundled inference templates and create them in the database for the current profile.
 */
const v11Migration = async (profile: ProfileResponse): Promise<ProfileResponse> => {
  try {
    if (!profile?.id) {
      throw new Error("Profile ID is required for inference template migration");
    }
    if (Array.isArray(inferenceTemplates)) {
      for (const template of inferenceTemplates) {
        try {
          const params: CreateInferenceTemplateParams = {
            profile_id: profile.id,
            name: template.name,
            config: {
              ...template.config,
              assistantMessageFormatting: {
                prefill: "",
                prefillOnlyCharacters: false,
                ...template.config.assistantMessageFormatting,
              },
            },
            // description is not part of CreateInferenceTemplateParams, so we ignore it
          };
          await createInferenceTemplate(params);
        } catch (err) {
          console.error(`Migration v11: Failed to create inference template '${template.name}'`, err);
        }
      }
    } else {
      console.warn("Migration v11: inferenceTemplates is not an array");
    }
  } catch (error) {
    // Log and continue with the original profile
    console.error("Migration v11: Error importing inference templates", error);
  }
  return profile;
};

export { v11Migration };
