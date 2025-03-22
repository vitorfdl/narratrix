import { Manifest } from "@/schema/manifest-schema";
import { getManifestById as fetchManifestById, getAllManifests } from "@/services/manifest-service";
import { create } from "zustand";

interface ManifestState {
  // State
  manifests: Manifest[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchManifests: () => Promise<void>;
  getManifestById: (id: string) => Promise<Manifest | null>;
  clearError: () => void;
}

export const useManifestStore = create<ManifestState>((set, get) => ({
  // Initial state
  manifests: [],
  isLoading: false,
  error: null,

  // Actions
  fetchManifests: async () => {
    try {
      set({ isLoading: true, error: null });
      const manifests = await getAllManifests();
      set({ manifests, isLoading: false });
    } catch (error) {
      set({
        error: `Failed to fetch manifests: ${error instanceof Error ? error.message : String(error)}`,
        isLoading: false,
      });
    }
  },

  getManifestById: async (id: string) => {
    const { manifests, fetchManifests } = get();

    // If the store is empty, fetch all manifests first
    if (manifests.length === 0) {
      await fetchManifests();
    }

    // Check if we have the manifest in the store now
    const manifest = get().manifests.find((m) => m.id === id);

    if (manifest) {
      return manifest;
    }

    // If still not found, try to fetch it directly and update the store
    try {
      const fetchedManifest = await fetchManifestById(id);

      // If we found the manifest but it wasn't in our store,
      // let's update our store to include it
      if (fetchedManifest) {
        const updatedManifests = [...get().manifests];
        const existingIndex = updatedManifests.findIndex((m) => m.id === fetchedManifest.id);

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
        error: `Failed to fetch manifest with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
      });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
