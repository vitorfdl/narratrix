import { Agent, Character, CharacterUnion, EXPRESSION_LIST } from "@/schema/characters-schema";
import {
  CharacterFilter,
  createCharacter as createCharacterAPI,
  deleteCharacter as deleteCharacterAPI,
  getCharacterById as getCharacterByIdAPI,
  listCharacters as listCharactersAPI,
  updateCharacter as updateCharacterAPI,
} from "@/services/character-service";
import { nanoid } from "nanoid";
import { useCallback } from "react";
import { create } from "zustand";
import { useMultipleImageUrls } from "./useImageUrl";

interface CharacterState {
  // State
  characters: CharacterUnion[];
  isLoading: boolean;
  error: string | null;

  actions: {
    // CRUD Operations
    createCharacter: (characterData: Character | Agent) => Promise<CharacterUnion>;
    getCharacterById: (id: string) => Promise<CharacterUnion | null>;
    updateCharacter: (
      id: string,
      updateData: Partial<Omit<CharacterUnion, "id" | "profile_id" | "created_at" | "updated_at">>,
    ) => Promise<CharacterUnion | null>;
    deleteCharacter: (id: string) => Promise<boolean>;

    // List Operations
    fetchCharacters: (profile_id: string, filter?: CharacterFilter) => Promise<void>;

    // Utility Actions
    clearCharacters: () => void;
    clearError: () => void;
  };
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  // Initial state
  characters: [],
  isLoading: false,
  error: null,

  actions: {
    // CRUD Operations
    createCharacter: async (characterData) => {
      try {
        set({ isLoading: true, error: null });

        // If it's a character, generate default expressions
        if (characterData.type === "character") {
          const defaultExpressions = EXPRESSION_LIST.map((name) => ({
            id: nanoid(), // Generate unique ID for each expression
            name: name,
            image_path: null, // Default expressions start with no image
          }));
          // Ensure expressions array exists and assign defaults
          characterData.expressions = defaultExpressions;
        }

        const newCharacter = await createCharacterAPI(characterData);

        // Update the store with the new character
        set((state) => ({
          characters: [...state.characters, newCharacter],
          isLoading: false,
        }));

        return newCharacter;
      } catch (error) {
        set({
          error: `Failed to create character: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        throw error;
      }
    },

    getCharacterById: async (id: string) => {
      try {
        set({ isLoading: true, error: null });

        // First check if the character is already in the store
        const cachedCharacter = get().characters.find((character) => character.id === id);
        if (cachedCharacter) {
          set({ isLoading: false });
          return cachedCharacter;
        }

        // If not in the store, fetch it from the API
        const character = await getCharacterByIdAPI(id);

        // If found, add it to our store
        if (character) {
          set((state) => ({
            characters: [...state.characters.filter((c) => c.id !== id), character],
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return character;
      } catch (error) {
        set({
          error: `Failed to get character with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    updateCharacter: async (id: string, updateData) => {
      try {
        set({ isLoading: true, error: null });
        const updatedCharacter = await updateCharacterAPI(id, updateData as any);

        if (updatedCharacter) {
          // Update the character in our store
          set((state) => ({
            characters: state.characters.map((character) => (character.id === id ? updatedCharacter : character)),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return updatedCharacter;
      } catch (error) {
        set({
          error: `Failed to update character with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    deleteCharacter: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const success = await deleteCharacterAPI(id);

        if (success) {
          // Remove the character from our store
          set((state) => ({
            characters: state.characters.filter((character) => character.id !== id),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return success;
      } catch (error) {
        set({
          error: `Failed to delete character with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return false;
      }
    },

    // List Operations
    fetchCharacters: async (profile_id: string, filter?: CharacterFilter) => {
      try {
        if (!profile_id) {
          throw new Error("Profile ID is required");
        }
        set({ isLoading: true, error: null });
        const characters = await listCharactersAPI(profile_id, filter).catch((e) => {
          console.error("Error fetching characters:", e);
          throw new Error(`Failed to fetch characters: ${e.message}`);
        });
        set({ characters, isLoading: false });
      } catch (error) {
        set({
          error: `Failed to fetch characters: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
      }
    },

    // Utility actions
    clearCharacters: () => set({ characters: [] }),
    clearError: () => set({ error: null }),
  },
}));

// Export hooks for easy access to store data
export const useCharacters = () => useCharacterStore((state) => state.characters);
export const useCharacterById = (id: string) => useCharacterStore((state) => state.characters.find((character) => character.id === id));
export const useCharactersLoading = () => useCharacterStore((state) => state.isLoading);
export const useCharactersError = () => useCharacterStore((state) => state.error);
export const useCharacterActions = () => useCharacterStore((state) => state.actions);

/**
 * Custom hook to efficiently load and cache avatar URLs for all characters
 * Optimizes performance by using useMultipleImageUrls hook
 */
export const useCharacterAvatars = () => {
  const characters = useCharacters();

  // Memoize the getter functions to prevent unnecessary re-renders
  const getAvatarPath = useCallback((character: CharacterUnion) => character.avatar_path, []);
  const getCharacterId = useCallback((character: CharacterUnion) => character.id, []);

  return useMultipleImageUrls(
    characters,
    getAvatarPath, // Use memoized function
    getCharacterId, // Use memoized function
  );
};
