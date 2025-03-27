import { ManifestContent, ManifestType, getAllManifests, getCharacterManifestById, getModelManifestById } from "@/services/manifest-service";
import { create } from "zustand";

// Generic interface for manifest stores
interface ManifestState<T extends ManifestType> {
  // State
  manifests: ManifestContent<T>[];
  isLoading: boolean;
  error: string | null;

  // Actions
  actions: {
    fetchManifests: () => Promise<void>;
    getManifestById: (id: string) => Promise<ManifestContent<T> | null>;
    clearError: () => void;
  };
}

// Create store factory function
function createManifestStore<T extends ManifestType>(type: T) {
  return create<ManifestState<T>>((set, get) => ({
    // Initial state
    manifests: [],
    isLoading: false,
    error: null,

    actions: {
      // Actions
      fetchManifests: async () => {
        try {
          set({ isLoading: true, error: null });
          const manifests = await getAllManifests(type);
          set({ manifests, isLoading: false });
        } catch (error) {
          set({
            error: `Failed to fetch ${type} manifests: ${error instanceof Error ? error.message : String(error)}`,
            isLoading: false,
          });
        }
      },

      getManifestById: async (id: string): Promise<ManifestContent<T> | null> => {
        const { manifests, actions } = get();

        // If the store is empty, fetch all manifests first
        if (manifests.length === 0) {
          await actions.fetchManifests();
        }

        // Check if we have the manifest in the store now
        const manifest = get().manifests.find((m) => m.id === id);

        if (manifest) {
          return manifest;
        }

        // If still not found, try to fetch it directly and update the store
        try {
          let fetchedManifest = null;

          // Type-safe approach with conditional fetching
          if (type === "model") {
            fetchedManifest = (await getModelManifestById(id)) as ManifestContent<T> | null;
          } else {
            fetchedManifest = (await getCharacterManifestById(id)) as ManifestContent<T> | null;
          }

          // If we found the manifest but it wasn't in our store,
          // let's update our store to include it
          if (fetchedManifest) {
            const updatedManifests = [...get().manifests];
            const existingIndex = updatedManifests.findIndex((m) => m.id === fetchedManifest!.id);

            if (existingIndex >= 0) {
              updatedManifests[existingIndex] = fetchedManifest;
            } else {
              updatedManifests.push(fetchedManifest);
            }

            set({ manifests: updatedManifests });
          }

          return fetchedManifest;
        } catch (error) {
          set({
            error: `Failed to fetch ${type} manifest with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          });
          return null;
        }
      },

      clearError: () => set({ error: null }),
    },
  }));
}

// Model manifest store (backward compatible with existing usage)
export const useManifestStore = createManifestStore("model");

// Character manifest store
export const useCharacterManifestStore = createManifestStore("character");

// Type definitions for each store for better type inference
export type ModelManifestStore = ManifestState<"model">;
export type CharacterManifestStore = ManifestState<"character">;

// Convenience exports for model manifests
export const useModelManifests = () => useManifestStore((state) => state.manifests);
export const useModelManifestById = (id: string) => useManifestStore((state) => state.manifests.find((manifest) => manifest.id === id));
export const useModelManifestsLoading = () => useManifestStore((state) => state.isLoading);
export const useModelManifestsError = () => useManifestStore((state) => state.error);
export const useModelManifestsActions = () => useManifestStore((state) => state.actions);

// Convenience exports for character manifests
export const useCharacterManifests = () => useCharacterManifestStore((state) => state.manifests);
export const useCharacterManifestById = (id: string) => useCharacterManifestStore((state) => state.manifests.find((manifest) => manifest.id === id));
export const useCharacterManifestsLoading = () => useCharacterManifestStore((state) => state.isLoading);
export const useCharacterManifestsError = () => useCharacterManifestStore((state) => state.error);
export const useCharacterManifestsActions = () => useCharacterManifestStore((state) => state.actions);
