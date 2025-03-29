import { useSessionProfile } from "@/utils/session-storage";
import React, { createContext, ReactNode, useContext, useEffect, useReducer } from "react";
import { toast } from "sonner";
import { ProfileListItem, ProfileResponse } from "../schema/profiles-schema";
import { createProfile, deleteProfile, getProfileById, getProfiles, loginProfile } from "../services/profile-service";
import { useCharacterActions } from "./characterStore";
import { useChatActions } from "./chatStore";
import { useModelManifestsActions } from "./manifestStore";
import { useTemplateActions } from "./templateStore";

export const MAX_PROFILES = 5;
export interface ProfileState {
  profiles: ProfileListItem[];
  currentProfile: ProfileResponse | null;
  isAuthenticated: boolean;
}

export type ProfileAction =
  | { type: "SET_PROFILES"; payload: ProfileListItem[] }
  | { type: "ADD_PROFILE"; payload: ProfileListItem }
  | { type: "REMOVE_PROFILE"; payload: string }
  | { type: "SET_CURRENT_PROFILE"; payload: ProfileResponse }
  | { type: "LOGOUT" }
  | { type: "SET_AUTHENTICATED"; payload: boolean };

// Initial state with empty values
const initialState: ProfileState = {
  profiles: [],
  currentProfile: null,
  isAuthenticated: false,
};

const profileReducer = (state: ProfileState, action: ProfileAction): ProfileState => {
  switch (action.type) {
    case "SET_PROFILES":
      return {
        ...state,
        profiles: action.payload,
      };
    case "ADD_PROFILE":
      if (state.profiles.length >= MAX_PROFILES) {
        return state;
      }
      return {
        ...state,
        profiles: [...state.profiles, action.payload],
      };
    case "REMOVE_PROFILE":
      return {
        ...state,
        profiles: state.profiles.filter((profile) => profile.id !== action.payload),
        currentProfile: state.currentProfile?.id === action.payload ? null : state.currentProfile,
        isAuthenticated: state.currentProfile?.id === action.payload ? false : state.isAuthenticated,
      };
    case "SET_CURRENT_PROFILE":
      return {
        ...state,
        currentProfile: action.payload,
      };
    case "LOGOUT":
      return {
        ...state,
        currentProfile: null,
        isAuthenticated: false,
      };
    case "SET_AUTHENTICATED":
      return {
        ...state,
        isAuthenticated: action.payload,
      };
    default:
      return state;
  }
};

interface ProfileContextType extends ProfileState {
  addProfile: (name: string, avatar?: string, password?: string) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  setCurrentProfile: (profile: ProfileResponse) => void;
  login: (id: string, password?: string) => Promise<boolean>;
  logout: () => void;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(profileReducer, initialState);
  const [savedCurrentProfile, setSessionProfileID] = useSessionProfile();
  const { fetchManifests } = useModelManifestsActions();
  const { fetchFormatTemplates, fetchInferenceTemplates, fetchPromptTemplates } = useTemplateActions();
  const { fetchCharacters } = useCharacterActions();
  const { fetchChatList } = useChatActions();
  // Load profiles from the database
  const refreshProfiles = async (): Promise<void> => {
    try {
      const profilesData = await getProfiles();
      dispatch({ type: "SET_PROFILES", payload: profilesData });
    } catch (error) {
      console.error("Failed to load profiles:", error);
      toast.error("Failed to load profiles");
    }
  };

  useEffect(() => {
    // Load profiles on initialization
    refreshProfiles();

    if (savedCurrentProfile) {
      dispatch({ type: "SET_CURRENT_PROFILE", payload: savedCurrentProfile });
    }
  }, [savedCurrentProfile]);

  useEffect(() => {
    // Save current profile ID to localStorage (just for remembering the last selection)
    if (state.currentProfile) {
      setSessionProfileID(state.currentProfile);
      fetchManifests();
      fetchFormatTemplates({ profile_id: state.currentProfile.id });
      fetchInferenceTemplates({ profile_id: state.currentProfile.id });
      fetchPromptTemplates({ profile_id: state.currentProfile.id });
      fetchCharacters(state.currentProfile.id);
      fetchChatList(state.currentProfile.id);
    } else {
      setSessionProfileID(undefined);
    }
  }, [state.currentProfile]);

  const addProfile = async (name: string, avatar?: string, password?: string): Promise<void> => {
    try {
      const newProfileData = {
        name,
        password: password,
        avatar_path: avatar || undefined,
      };

      const createdProfile = await createProfile(newProfileData);

      dispatch({ type: "ADD_PROFILE", payload: createdProfile });
    } catch (error) {
      console.error("Failed to create profile:", error);
      throw error;
    }
  };

  const removeProfile = async (id: string): Promise<void> => {
    try {
      await deleteProfile(id);
      dispatch({ type: "REMOVE_PROFILE", payload: id });
    } catch (error) {
      console.error("Failed to delete profile:", error);
      throw error;
    }
  };

  const setCurrentProfile = (profile: ProfileResponse): void => {
    dispatch({ type: "SET_CURRENT_PROFILE", payload: profile });
  };

  const login = async (id: string, password?: string): Promise<boolean> => {
    const profile = state.profiles.find((p) => p.id === id);

    if (!profile) {
      toast.error("Profile not found");
      return false;
    }

    try {
      let fullProfile: ProfileResponse | null;
      if (profile.hasPassword) {
        if (!password) {
          return false;
        }

        fullProfile = await loginProfile({
          id: profile.id,
          password: password,
        });
      } else {
        fullProfile = await getProfileById(profile.id);
      }

      if (!fullProfile) {
        console.error("Login failed:", "Profile not found");
        return false;
      }

      // If we made it here, authentication succeeded
      dispatch({ type: "SET_CURRENT_PROFILE", payload: fullProfile });
      dispatch({ type: "SET_AUTHENTICATED", payload: true });
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = (): void => {
    dispatch({ type: "LOGOUT" });
  };

  const value = {
    ...state,
    addProfile,
    removeProfile,
    setCurrentProfile,
    login,
    logout,
    refreshProfiles,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};

export default ProfileContext;
