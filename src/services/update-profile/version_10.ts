import { ProfileResponse, QuickAction } from "@/schema/profiles-schema";
import quickActionsData from "@/services/update-profile/data/quick_actions.json";

/**
 * Migration for version 10:
 * - If quick actions exist in localStorage, replace the profile's quick_actions with them.
 */
const v10Migration = async (profile: ProfileResponse): Promise<ProfileResponse> => {
  try {
    // Access localStorage for quick actions (browser environment only)
    if (typeof window !== "undefined" && window.localStorage) {
      const quickActionsRaw = window.localStorage.getItem("quickActions");
      if (quickActionsRaw) {
        try {
          const quickActions = JSON.parse(quickActionsRaw);
          if (Array.isArray(quickActions)) {
            // Clean up quickActions from localStorage after use
            window.localStorage.removeItem("quickActions");
            return {
              ...profile,
              quick_actions: quickActions,
            };
          }
        } catch (err) {
          // If parsing fails, ignore and continue
          console.warn("Failed to parse quickActions from localStorage:", err);
        }
        // Clean up even if parsing fails
        window.localStorage.removeItem("quickActions");
      }
      // If quickActions is not present in localStorage, use the bundled quick_actions.json
      if (!quickActionsRaw) {
        try {
          if (Array.isArray(quickActionsData)) {
            return {
              ...profile,
              quick_actions: quickActionsData as QuickAction[],
            };
          }
        } catch (jsonErr) {
          console.error("Migration v10: Error loading quick_actions.json", jsonErr);
        }
      }
    }
  } catch (error) {
    // Log and continue with the original profile
    console.error("Migration v10: Error accessing localStorage for quick actions", error);
  }
  return profile;
};

export { v10Migration };
