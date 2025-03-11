import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Profile, ProfileState, ProfileAction, MAX_PROFILES } from '../types/profiles';
import { createProfile, getProfiles, deleteProfile, updateProfile, loginProfile } from '../hooks/profiles';
import type { ProfileResponse, NewProfile, LoginRequest } from '../hooks/profiles';
import { toast } from 'sonner';
import { useSessionProfileID } from '@/utils/session-storage';

// Initial state with empty values
const initialState: ProfileState = {
  profiles: [],
  currentProfileId: null,
  isAuthenticated: false,
};

const profileReducer = (state: ProfileState, action: ProfileAction): ProfileState => {
  switch (action.type) {
    case 'SET_PROFILES':
      return {
        ...state,
        profiles: action.payload,
      };
    case 'ADD_PROFILE':
      if (state.profiles.length >= MAX_PROFILES) {
        return state;
      }
      return {
        ...state,
        profiles: [...state.profiles, action.payload],
      };
    case 'REMOVE_PROFILE':
      return {
        ...state,
        profiles: state.profiles.filter(profile => profile.id !== action.payload),
        currentProfileId: state.currentProfileId === action.payload ? null : state.currentProfileId,
        isAuthenticated: state.currentProfileId === action.payload ? false : state.isAuthenticated,
      };
    case 'SET_CURRENT_PROFILE':
      return {
        ...state,
        currentProfileId: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        currentProfileId: null,
        isAuthenticated: false,
      };
    case 'SET_AUTHENTICATED':
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
  setCurrentProfile: (id: string) => void;
  login: (id: string, password?: string) => Promise<boolean>;
  logout: () => void;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(profileReducer, initialState);

  // Convert backend ProfileResponse to our internal Profile type
  const mapProfileResponse = (profile: ProfileResponse): Profile => ({
    id: profile.id,
    name: profile.name,
    avatar_path: profile.avatar_path || undefined,
    hasPassword: false, // We can't know this from the backend, so default to false
    created_at: profile.created_at,
  });

  // Load profiles from the database
  const refreshProfiles = async (): Promise<void> => {
    try {
      const profilesData = await getProfiles();
      console.log('profilesData', profilesData);
      const mappedProfiles = profilesData.map(mapProfileResponse);
      dispatch({ type: 'SET_PROFILES', payload: mappedProfiles });
    } catch (error) {
      console.error('Failed to load profiles:', error);
      toast.error('Failed to load profiles');
    }
  };

  useEffect(() => {
    // Load profiles on initialization
    refreshProfiles();

    // Retrieve the last selected profile from localStorage (just the ID)
    const [savedCurrentProfileId] = useSessionProfileID();
    if (savedCurrentProfileId) {
      dispatch({ type: 'SET_CURRENT_PROFILE', payload: savedCurrentProfileId });
      // We don't auto-login - user will need to enter password if required
    }
  }, []);

  useEffect(() => {
    // Save current profile ID to localStorage (just for remembering the last selection)
    const [, setSessionProfileID] = useSessionProfileID();
    if (state.currentProfileId) {
      setSessionProfileID(state.currentProfileId);
    } else {
      setSessionProfileID(undefined);
    }
  }, [state.currentProfileId]);

  const addProfile = async (name: string, avatar?: string, password?: string): Promise<void> => {
    try {
      const hasPassword = !!password;

      const newProfileData: NewProfile = {
        name,
        password: password || '', // Backend expects a string
        avatar_path: avatar || null
      };

      const createdProfile = await createProfile(newProfileData);
      const mappedProfile: Profile = mapProfileResponse(createdProfile);

      // Add the hasPassword flag since backend doesn't return passwords
      mappedProfile.hasPassword = hasPassword;

      dispatch({ type: 'ADD_PROFILE', payload: mappedProfile });
      toast.success('Profile created successfully');
    } catch (error) {
      console.error('Failed to create profile:', error);
      toast.error('Failed to create profile');
      throw error;
    }
  };

  const removeProfile = async (id: string): Promise<void> => {
    try {
      await deleteProfile(id);
      dispatch({ type: 'REMOVE_PROFILE', payload: id });
      toast.success('Profile deleted successfully');
    } catch (error) {
      console.error('Failed to delete profile:', error);
      toast.error('Failed to delete profile');
      throw error;
    }
  };

  const setCurrentProfile = (id: string): void => {
    dispatch({ type: 'SET_CURRENT_PROFILE', payload: id });
  };

  const login = async (id: string, password?: string): Promise<boolean> => {
    const profile = state.profiles.find(p => p.id === id);

    if (!profile) {
      toast.error('Profile not found');
      return false;
    }

    try {
      if (profile.hasPassword) {
        if (!password) {
          return false;
        }

        // Attempt to login with password
        const loginData: LoginRequest = {
          name: profile.name,
          password: password
        };

        await loginProfile(loginData);
      }

      // If we made it here, authentication succeeded
      dispatch({ type: 'SET_CURRENT_PROFILE', payload: id });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = (): void => {
    dispatch({ type: 'LOGOUT' });
  };

  const value = {
    ...state,
    addProfile,
    removeProfile,
    setCurrentProfile,
    login,
    logout,
    refreshProfiles
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export default ProfileContext; 