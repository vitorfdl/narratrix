import { runProfileMigrations } from "@/services/update-profile";
import { useSessionProfile } from "@/utils/session-storage";
import { useEffect } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { ProfileListItem, ProfileResponse, UpdateProfileParams } from "../schema/profiles-schema";
import { createProfile, deleteProfile, getProfileById, getProfiles, loginProfile, updateProfile } from "../services/profile-service";
import { useThemeStore } from "./ThemeContext";
import { useAgentActions } from "./agentStore";
import { useCharacterActions } from "./characterStore";
import { useChatActions } from "./chatStore";
import { useChatTemplateActions } from "./chatTemplateStore";
import { useLorebookStoreActions } from "./lorebookStore";
import { useModelManifestsActions } from "./manifestStore";
import { useModelsActions } from "./modelsStore";
import { useTemplateActions } from "./templateStore";

export const MAX_PROFILES = 5;

interface ProfileState {
  profiles: ProfileListItem[];
  currentProfile: ProfileResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface ProfileActions {
  fetchProfiles: () => Promise<ProfileListItem[]>;
  addProfile: (profile: UpdateProfileParams) => Promise<void>;
  updateProfile: (profileChanges: UpdateProfileParams) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  setCurrentProfile: (profile: ProfileResponse | undefined) => void;
  login: (id: string, password?: string) => Promise<ProfileResponse | null>;
  logout: () => void;
  clearError: () => void;
}

interface ProfileStore extends ProfileState {
  actions: ProfileActions;
}

const initialState: ProfileState = {
  profiles: [],
  currentProfile: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const useProfileStore = create<ProfileStore>((set, get) => {
  return {
    ...initialState,

    actions: {
      fetchProfiles: async () => {
        try {
          set({ isLoading: true, error: null });
          const profilesData = await getProfiles();
          set({ profiles: profilesData, isLoading: false });
          return profilesData;
        } catch (error) {
          console.error("Failed to load profiles:", error);
          toast.error("Failed to load profiles");
          set({
            error: error instanceof Error ? error.message : "Failed to load profiles",
            isLoading: false,
          });
          return [];
        }
      },

      addProfile: async (profile) => {
        try {
          set({ isLoading: true, error: null });

          if (get().profiles.length >= MAX_PROFILES) {
            throw new Error(`Maximum number of profiles (${MAX_PROFILES}) reached`);
          }

          if (!profile.name) {
            throw new Error("Profile name is required");
          }

          const newProfileData = {
            name: profile.name,
            password: profile.password,
            version: 0,
            quick_actions: profile.quick_actions || [],
            avatar_path: profile.avatar_path || null,
          };

          const createdProfile = await createProfile(newProfileData);

          set((state) => ({
            profiles: [...state.profiles, createdProfile],
            isLoading: false,
          }));
        } catch (error) {
          console.error("Failed to create profile:", error);
          toast.error(error instanceof Error ? error.message : "Failed to create profile");
          set({
            error: error instanceof Error ? error.message : "Failed to create profile",
            isLoading: false,
          });
          throw error;
        }
      },

      updateProfile: async (profileChanges: UpdateProfileParams) => {
        try {
          set({ isLoading: true, error: null });

          const currentProfile = get().currentProfile;
          if (!currentProfile) {
            throw new Error("No profile selected");
          }

          const updatedProfile = await updateProfile(currentProfile.id, profileChanges);

          if (profileChanges.name || profileChanges.avatar_path || profileChanges.avatar_path) {
            await get().actions.fetchProfiles();
          }

          set(() => ({
            currentProfile: updatedProfile,
          }));
        } catch (error) {
          console.error("Failed to update profile:", error);
          toast.error(error instanceof Error ? error.message : "Failed to update profile");
          set({
            error: error instanceof Error ? error.message : "Failed to update profile",
            isLoading: false,
          });
        }
      },

      removeProfile: async (id: string) => {
        try {
          set({ isLoading: true, error: null });

          const isCurrentProfile = get().currentProfile?.id === id;

          await deleteProfile(id);

          set((state) => ({
            profiles: state.profiles.filter((profile) => profile.id !== id),
            isLoading: false,
          }));

          if (isCurrentProfile) {
            get().actions.logout();
          }
        } catch (error) {
          console.error("Failed to delete profile:", error);
          toast.error(error instanceof Error ? error.message : "Failed to delete profile");
          set({
            error: error instanceof Error ? error.message : "Failed to delete profile",
            isLoading: false,
          });
          throw error;
        }
      },

      setCurrentProfile: (profile: ProfileResponse | undefined) => {
        if (profile) {
          set({
            currentProfile: profile,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          get().actions.logout();
        }
      },

      login: async (id: string, password?: string): Promise<ProfileResponse | null> => {
        try {
          set({ isLoading: true, error: null });
          const profile = get().profiles.find((p) => p.id === id);

          if (!profile) {
            toast.error("Profile not found");
            set({ isLoading: false, error: "Profile not found" });
            return null;
          }

          let fullProfile: ProfileResponse | null;
          if (profile.hasPassword) {
            if (!password) {
              toast.warning("Password required for this profile.");
              set({ isLoading: false, error: "Password required" });
              return null;
            }
            fullProfile = await loginProfile({ id: profile.id, password: password });
          } else {
            fullProfile = await getProfileById(profile.id);
          }

          if (!fullProfile) {
            const loginError = "Login failed: Profile data retrieval failed.";
            console.error(loginError);
            toast.error("Login failed. Please try again.");
            set({ isLoading: false, error: loginError });
            return null;
          }

          // --- MIGRATION HOOK ---
          try {
            const migratedProfile = await runProfileMigrations(fullProfile.id);
            if (migratedProfile && migratedProfile.version !== fullProfile.version) {
              fullProfile = migratedProfile;
            }
          } catch (migrationError) {
            console.error("Profile migration failed:", migrationError);
            toast.error("Profile migration failed. Some features may not work as expected.");
          }
          // --- END MIGRATION HOOK ---

          set({
            currentProfile: fullProfile,
            isAuthenticated: true,
            isLoading: false,
          });
          return fullProfile;
        } catch (error) {
          console.error("Login failed:", error);
          const errorMessage = error instanceof Error ? error.message : "Login failed";
          toast.error(errorMessage);
          set({ error: errorMessage, isLoading: false });
          return null;
        }
      },

      logout: () => {
        set({
          currentProfile: null,
          isAuthenticated: false,
        });
      },

      clearError: () => {
        set({ error: null });
      },
    },
  };
});

export const useProfileSynchronization = () => {
  const currentProfile = useProfileStore((state) => state.currentProfile);
  const { fetchManifests } = useModelManifestsActions();
  const { fetchModels } = useModelsActions();
  const { fetchFormatTemplates, fetchInferenceTemplates } = useTemplateActions();
  const { fetchCharacters } = useCharacterActions();
  const { fetchChatList } = useChatActions();
  const { fetchChatTemplates } = useChatTemplateActions();
  const { loadLorebooks } = useLorebookStoreActions();
  const { setTheme } = useThemeStore();
  const { fetchAgents } = useAgentActions();

  useEffect(() => {
    if (currentProfile?.id && currentProfile.settings) {
      fetchManifests();
      fetchFormatTemplates(currentProfile.id);
      fetchInferenceTemplates({ profile_id: currentProfile.id });
      fetchChatTemplates({ profile_id: currentProfile.id });
      fetchCharacters(currentProfile.id);
      fetchChatList(currentProfile.id);
      loadLorebooks(currentProfile.id);
      fetchModels({ profile_id: currentProfile.id });
      fetchAgents(currentProfile.id);
      setTheme(currentProfile.settings.appearance.theme || "system");
    } else {
      console.log("No current profile or settings, skipping data synchronization.");
    }
  }, [currentProfile, fetchManifests, fetchFormatTemplates, fetchInferenceTemplates, fetchChatTemplates, fetchCharacters, fetchChatList, loadLorebooks, setTheme]);

  return null;
};

export const useProfiles = () => useProfileStore((state) => state.profiles);
export const useCurrentProfile = () => useProfileStore((state) => state.currentProfile);
export const useIsAuthenticated = () => useProfileStore((state) => state.isAuthenticated);
export const useProfileLoading = () => useProfileStore((state) => state.isLoading);
export const useProfileError = () => useProfileStore((state) => state.error);

export const useProfileActions = () => useProfileStore((state) => state.actions);

export const useInitializeProfiles = () => {
  const [, setSessionProfile] = useSessionProfile();

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const { fetchProfiles, login, logout } = useProfileStore.getState().actions;
      const { isAuthenticated: isAlreadyAuthenticated } = useProfileStore.getState();

      await fetchProfiles();
      if (!isMounted) {
        return;
      }

      let savedProfileData: ProfileResponse | undefined;
      try {
        const item = sessionStorage.getItem("sessionProfile");
        savedProfileData = item ? JSON.parse(item) : undefined;
      } catch (error) {
        console.error("Failed to parse saved profile from session storage:", error);
        sessionStorage.removeItem("sessionProfile");
      }

      const savedProfileId = savedProfileData?.id;

      if (savedProfileId) {
        const currentProfileId = useProfileStore.getState().currentProfile?.id;
        if (isAlreadyAuthenticated && currentProfileId === savedProfileId) {
          return;
        }

        const loggedInProfile = await login(savedProfileId);

        if (!isMounted) {
          return;
        }

        if (loggedInProfile) {
          setSessionProfile(loggedInProfile);
        } else {
          console.warn("Auto-login failed for saved profile ID:", savedProfileId);
          setSessionProfile(undefined);
          const { currentProfile } = useProfileStore.getState();
          if (currentProfile) {
            logout();
          }
        }
      } else {
        const { currentProfile } = useProfileStore.getState();
        if (currentProfile) {
          logout();
        }
        setSessionProfile(undefined);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [setSessionProfile]);

  return null;
};
