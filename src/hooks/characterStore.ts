import { Character, CharacterUnion, EXPRESSION_LIST } from "@/schema/characters-schema";
import {
  CharacterFilter,
  createCharacter as createCharacterAPI,
  deleteCharacter as deleteCharacterAPI,
  getCharacterById as getCharacterByIdAPI,
  listCharacters as listCharactersAPI,
  updateCharacter as updateCharacterAPI,
} from "@/services/character-service";
import { getImageUrl } from "@/services/file-system-service";
import { nanoid } from "nanoid";
import { useEffect } from "react";
import { StoreApi, UseBoundStore, create } from "zustand";
import { useShallow } from "zustand/shallow";

interface CharacterState {
  // State
  characters: CharacterUnion[];
  isLoading: boolean;
  error: string | null;
  avatarUrls: Record<string, string>;
  isLoadingAvatars: boolean;

  actions: {
    // CRUD Operations
    createCharacter: (characterData: Character) => Promise<CharacterUnion>;
    getCharacterById: (id: string) => Promise<CharacterUnion | null>;
    updateCharacter: (
      profile_id: string,
      id: string,
      updateData: Partial<Omit<CharacterUnion, "id" | "profile_id" | "created_at" | "updated_at">>,
    ) => Promise<CharacterUnion | null>;
    deleteCharacter: (id: string) => Promise<boolean>;

    // List Operations
    fetchCharacters: (profile_id: string, filter?: CharacterFilter) => Promise<void>;

    // Utility Actions
    clearCharacters: () => void;
    clearError: () => void;

    // New actions
    loadCharacterAvatars: () => Promise<void>;
    refreshCharacterAvatars: (characterId?: string) => Promise<void>;
  };
}

// Explicitly type the hook returned by create
export const useCharacterStore: UseBoundStore<StoreApi<CharacterState>> = create<CharacterState>((set, get) => ({
  // Initial state
  characters: [],
  isLoading: false,
  error: null,
  avatarUrls: {},
  isLoadingAvatars: false,

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

    updateCharacter: async (profile_id: string, id: string, updateData) => {
      try {
        set({ isLoading: true, error: null });
        const updatedCharacter = await updateCharacterAPI(id, updateData as any);

        if (updatedCharacter) {
          await get().actions.fetchCharacters(profile_id);
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

    // New actions
    loadCharacterAvatars: async () => {
      const { characters } = get();
      const { avatarUrls } = get();

      // Only load avatars that aren't already cached
      const charactersToLoad = characters.filter((char) => char.avatar_path && !avatarUrls[char.id]);

      if (!charactersToLoad.length) {
        return;
      }

      set({ isLoadingAvatars: true });

      try {
        const newUrlMap = { ...avatarUrls };

        await Promise.all(
          charactersToLoad.map(async (char) => {
            if (char.avatar_path) {
              try {
                const url = await getImageUrl(char.avatar_path);
                newUrlMap[char.id] = url;
              } catch (error) {
                console.error(`Failed to load avatar for ${char.id}:`, error);
              }
            }
          }),
        );

        set({ avatarUrls: newUrlMap, isLoadingAvatars: false });
      } catch (error) {
        console.error("Failed to load avatars:", error);
        set({ isLoadingAvatars: false });
      }
    },

    refreshCharacterAvatars: async (characterId?: string) => {
      const { characters, avatarUrls } = get();

      if (!characters.length) {
        return;
      }

      set({ isLoadingAvatars: true });

      try {
        // Create a copy of the current avatar URLs
        const newUrlMap: Record<string, string> = { ...avatarUrls };

        if (characterId) {
          // Refresh only the specified character avatar
          const character = characters.find((char) => char.id === characterId);
          if (character?.avatar_path) {
            try {
              const url = await getImageUrl(character.avatar_path);
              newUrlMap[character.id] = url;
            } catch (error) {
              console.error(`Failed to load avatar for ${character.id}:`, error);
            }
          }
        } else {
          // Refresh all character avatars
          await Promise.all(
            characters.map(async (char) => {
              if (char.avatar_path) {
                try {
                  const url = await getImageUrl(char.avatar_path);
                  newUrlMap[char.id] = url;
                } catch (error) {
                  console.error(`Failed to load avatar for ${char.id}:`, error);
                }
              }
            }),
          );
        }

        set({ avatarUrls: newUrlMap, isLoadingAvatars: false });
      } catch (error) {
        console.error("Failed to refresh avatars:", error);
        set({ isLoadingAvatars: false });
      }
    },
  },
}));

// Export hooks for easy access to store data
export const useCharacters = () => useCharacterStore((state) => state.characters);
export const useCharacterById = (id: string) => useCharacterStore((state) => state.characters.find((character) => character.id === id));
export const useCharactersLoading = () => useCharacterStore((state) => state.isLoading);
export const useCharactersError = () => useCharacterStore((state) => state.error);
export const useCharacterActions = () => useCharacterStore((state) => state.actions);
export const useCharacterTagList = () =>
  useCharacterStore(
    useShallow((state) => {
      const allTags = state.characters.flatMap((character) => character.tags || []);
      return [...new Set(allTags)];
    }),
  );

// Replace useCharacterAvatars with this simpler hook
export const useCharacterAvatars = () => {
  const avatarUrls = useCharacterStore((state) => state.avatarUrls);
  const isLoading = useCharacterStore((state) => state.isLoadingAvatars);
  const { loadCharacterAvatars, refreshCharacterAvatars } = useCharacterStore((state) => state.actions);

  // Load avatars on first use if not already loaded
  useEffect(() => {
    loadCharacterAvatars();
  }, [loadCharacterAvatars]);

  return { urlMap: avatarUrls, isLoading, reloadAll: refreshCharacterAvatars };
};
