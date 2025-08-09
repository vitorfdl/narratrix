import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { CreateLorebookEntryParams, CreateLorebookParams, Lorebook, LorebookEntry, UpdateLorebookEntryParams, UpdateLorebookParams } from "@/schema/lorebook-schema";
import * as lorebookService from "@/services/lorebook-service";

/**
 * Interface for the Lorebook store state
 */
interface LorebookState {
  lorebooks: Lorebook[];
  // Stores only the entries for the currently selected lorebook
  selectedLorebookEntries: LorebookEntry[];
  selectedLorebookId: string | null;
  selectedEntryId: string | null;
  isLoadingLorebooks: boolean;
  isLoadingEntries: boolean; // Loading state specifically for selected entries
  error: string | null;
  actions: LorebookActions;
}

/**
 * Interface for the Lorebook store actions
 */
interface LorebookActions {
  // Lorebook actions
  loadLorebooks: (profileId: string) => Promise<void>;
  createLorebook: (data: CreateLorebookParams) => Promise<Lorebook | null>;
  updateLorebook: (id: string, data: UpdateLorebookParams) => Promise<Lorebook | null>;
  deleteLorebook: (id: string) => Promise<boolean>;
  selectLorebook: (id: string | null) => void;

  // Lorebook Entry actions
  loadLorebookEntries: (profileId: string, lorebookId: string) => Promise<void>;
  createLorebookEntry: (data: CreateLorebookEntryParams) => Promise<LorebookEntry | null>;
  updateLorebookEntry: (id: string, data: UpdateLorebookEntryParams) => Promise<LorebookEntry | null>;
  deleteLorebookEntry: (profileId: string, id: string, lorebookId: string) => Promise<boolean>;
  selectLorebookEntry: (id: string | null) => void;

  clearError: () => void;
}

/**
 * Lorebook store implementation using Zustand
 */
export const useLorebookStore = create<LorebookState>()(
  devtools(
    (set, get) => ({
      lorebooks: [],
      selectedLorebookEntries: [], // Initialize with an empty array
      selectedLorebookId: null,
      selectedEntryId: null,
      isLoadingLorebooks: false,
      isLoadingEntries: false,
      error: null,
      actions: {
        // --- Lorebook Actions ---
        loadLorebooks: async (profileId) => {
          set({ isLoadingLorebooks: true, error: null });
          try {
            const lorebooks = await lorebookService.listLorebooks({ profile_id: profileId });
            set({ lorebooks, isLoadingLorebooks: false });
          } catch (err: any) {
            console.log("err", err);
            set({ error: `Failed to load lorebooks: ${err.message}`, isLoadingLorebooks: false });
          }
        },
        createLorebook: async (data) => {
          set({ error: null });
          try {
            const newLorebook = await lorebookService.createLorebook(data);
            set((state) => ({
              lorebooks: [...state.lorebooks, newLorebook],
            }));
            return newLorebook;
          } catch (err: any) {
            console.log("err", err);
            set({ error: `Failed to create lorebook: ${err.message}` });
            return null;
          }
        },
        updateLorebook: async (id, data) => {
          set({ error: null });
          try {
            const updatedLorebook = await lorebookService.updateLorebook(id, data);
            if (updatedLorebook) {
              set((state) => ({
                lorebooks: state.lorebooks.map((lb) => (lb.id === id ? updatedLorebook : lb)),
              }));
            }
            return updatedLorebook;
          } catch (err: any) {
            set({ error: `Failed to update lorebook: ${err.message}` });
            return null;
          }
        },
        deleteLorebook: async (id) => {
          set({ error: null });
          try {
            const success = await lorebookService.deleteLorebook(id);
            if (success) {
              set((state) => {
                const newLorebooks = state.lorebooks.filter((lb) => lb.id !== id);
                const wasSelected = state.selectedLorebookId === id;
                return {
                  lorebooks: newLorebooks,
                  // Clear selection and entries if the deleted book was selected
                  selectedLorebookId: wasSelected ? null : state.selectedLorebookId,
                  selectedLorebookEntries: wasSelected ? [] : state.selectedLorebookEntries,
                  selectedEntryId: wasSelected ? null : state.selectedEntryId,
                };
              });
            }
            return success;
          } catch (err: any) {
            set({ error: `Failed to delete lorebook: ${err.message}` });
            return false;
          }
        },
        selectLorebook: (id) => {
          // Reset entries and selection when a new lorebook is chosen
          set({
            selectedLorebookId: id,
            selectedEntryId: null,
            selectedLorebookEntries: [],
            isLoadingEntries: !!id, // Start loading if an ID is provided
            error: null, // Clear previous entry loading errors
          });
          // Note: Loading entries is expected to be triggered manually after selection if needed
          // e.g., useEffect in the component observing selectedLorebookId
          if (!id) {
            set({ isLoadingEntries: false }); // Ensure loading stops if null ID
          }
        },

        // --- Lorebook Entry Actions ---
        loadLorebookEntries: async (profileId, lorebookId) => {
          // Only load entries if the request is for the currently selected lorebook
          if (get().selectedLorebookId !== lorebookId) {
            console.warn(`Attempted to load entries for lorebook ${lorebookId}, but ${get().selectedLorebookId} is currently selected. Aborting load.`);
            // Ensure loading state is false if the load is aborted early
            set({ isLoadingEntries: false });
            return;
          }

          set({ isLoadingEntries: true, error: null });
          try {
            const entries = await lorebookService.listLorebookEntries(profileId, { lorebook_id: lorebookId });
            // Double-check the selected lorebook hasn't changed during the async fetch
            if (get().selectedLorebookId === lorebookId) {
              set({
                selectedLorebookEntries: entries,
                isLoadingEntries: false,
              });
            } else {
              // Selection changed during fetch, discard results
              set({ isLoadingEntries: false });
            }
          } catch (err: any) {
            // Handle error only if the failed load was for the currently selected book
            if (get().selectedLorebookId === lorebookId) {
              set({ error: `Failed to load entries for lorebook ${lorebookId}: ${err.message}`, isLoadingEntries: false });
            } else {
              // Reset loading state if selection changed during a failed fetch
              set({ isLoadingEntries: false });
            }
          }
        },
        createLorebookEntry: async (data) => {
          set({ error: null });
          try {
            const newEntry = await lorebookService.createLorebookEntry(data);
            // Only add the new entry to the state if its lorebook is currently selected
            if (get().selectedLorebookId === data.lorebook_id) {
              set((state) => ({
                selectedLorebookEntries: [...state.selectedLorebookEntries, newEntry],
              }));
            }
            return newEntry;
          } catch (err: any) {
            set({ error: `Failed to create lorebook entry: ${err.message}` });
            return null;
          }
        },
        updateLorebookEntry: async (id, data) => {
          set({ error: null });
          try {
            const updatedEntry = await lorebookService.updateLorebookEntry(id, data);
            // Only update the state if the entry belongs to the currently selected lorebook
            if (updatedEntry && get().selectedLorebookId === updatedEntry.lorebook_id) {
              set((state) => ({
                selectedLorebookEntries: state.selectedLorebookEntries.map(
                  (
                    entry: LorebookEntry, // Explicit type for entry
                  ) => (entry.id === id ? updatedEntry : entry),
                ),
              }));
            }
            // Assumption: lorebook_id cannot be changed via this update method.
            // If it could, logic to remove from selectedLorebookEntries might be needed.
            return updatedEntry;
          } catch (err: any) {
            set({ error: `Failed to update lorebook entry: ${err.message}` });
            return null;
          }
        },
        deleteLorebookEntry: async (profileId, id, lorebookId) => {
          set({ error: null });
          try {
            const success = await lorebookService.deleteLorebookEntry(id, profileId);
            // Only modify state if the deletion was successful AND the entry was in the selected book
            if (success && get().selectedLorebookId === lorebookId) {
              set((state) => ({
                selectedLorebookEntries: state.selectedLorebookEntries.filter((entry: LorebookEntry) => entry.id !== id), // Explicit type
                // Clear selected entry ID if the deleted entry was the one selected
                selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId,
              }));
            } else if (success && get().selectedEntryId === id) {
              // If the deleted entry was selected, but its book wasn't the selected one,
              // still clear the selection.
              set({ selectedEntryId: null });
            }
            return success;
          } catch (err: any) {
            set({ error: `Failed to delete lorebook entry: ${err.message}` });
            return false;
          }
        },
        selectLorebookEntry: (id) => {
          set({ selectedEntryId: id });
        },

        clearError: () => set({ error: null }),
      },
    }),
    { name: "lorebookStore" }, // Name for Redux DevTools extension
  ),
);

// Hooks for accessing state and actions
export const useLorebookStoreActions = () => useLorebookStore((state) => state.actions);
export const useLorebookStoreState = <T>(selector: (state: LorebookState) => T): T => useLorebookStore(selector);

// Specific state selectors
export const useLorebooks = () => useLorebookStore((state) => state.lorebooks);
// Renamed selector to reflect it returns entries for the *selected* lorebook
export const useSelectedLorebookEntries = () => useLorebookStore((state) => state.selectedLorebookEntries);
export const useSelectedLorebookId = () => useLorebookStore((state) => state.selectedLorebookId);
export const useSelectedEntryId = () => useLorebookStore((state) => state.selectedEntryId);
export const useIsLoadingLorebooks = () => useLorebookStore((state) => state.isLoadingLorebooks);
export const useIsLoadingEntries = () => useLorebookStore((state) => state.isLoadingEntries);
export const useLorebookError = () => useLorebookStore((state) => state.error);
