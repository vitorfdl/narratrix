import { Model, ModelType } from "@/schema/models-schema";
import {
  ModelFilter,
  NewModelParams,
  createModel as createModelAPI,
  deleteModel as deleteModelAPI,
  getModelById as getModelByIdAPI,
  getModelsByProfileGroupedByType as getModelsByProfileGroupedByTypeAPI,
  listModels as listModelsAPI,
  updateModel as updateModelAPI,
} from "@/services/model-service";
import { create } from "zustand";

interface ModelsState {
  // State
  models: Model[];
  isLoading: boolean;
  error: string | null;

  actions: {
    // CRUD Operations
    createModel: (modelData: NewModelParams) => Promise<Model>;
    getModelById: (id: string) => Promise<Model | null>;
    updateModel: (id: string, updateData: Partial<Omit<Model, "id" | "profile_id" | "created_at" | "updated_at">>) => Promise<Model | null>;
    deleteModel: (id: string) => Promise<boolean>;

    // List Operations
    fetchModels: (filter?: ModelFilter) => Promise<void>;
    getModelsByProfileGroupedByType: (profileId: string) => Promise<Record<ModelType, Model[]>>;

    // Utility Actions
    clearModels: () => void;
    clearError: () => void;
  };
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  // Initial state
  models: [],
  isLoading: false,
  error: null,

  actions: {
    // CRUD Operations
    createModel: async (modelData: NewModelParams) => {
      try {
        set({ isLoading: true, error: null });
        const newModel = await createModelAPI(modelData);

        await get().actions.fetchModels();

        return newModel;
      } catch (error) {
        set({
          error: `Failed to create model: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        throw error;
      }
    },

    getModelById: async (id: string) => {
      try {
        set({ isLoading: true, error: null });

        // First check if the model is already in the store
        const cachedModel = get().models.find((model) => model.id === id);
        if (cachedModel) {
          set({ isLoading: false });
          return cachedModel;
        }

        // If not in the store, fetch it from the API
        const model = await getModelByIdAPI(id);

        // If found, add it to our store
        if (model) {
          set((state) => ({
            models: [...state.models.filter((m) => m.id !== id), model],
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return model;
      } catch (error) {
        set({
          error: `Failed to get model with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    updateModel: async (id: string, updateData) => {
      try {
        set({ isLoading: true, error: null });
        const updatedModel = await updateModelAPI(id, updateData);

        if (updatedModel) {
          await get().actions.fetchModels();
        } else {
          set({ isLoading: false });
        }

        return updatedModel;
      } catch (error) {
        set({
          error: `Failed to update model with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    deleteModel: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const success = await deleteModelAPI(id);

        if (success) {
          // Remove the model from our store
          set((state) => ({
            models: state.models.filter((model) => model.id !== id),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return success;
      } catch (error) {
        set({
          error: `Failed to delete model with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return false;
      }
    },

    // List Operations
    fetchModels: async (filter?: ModelFilter) => {
      try {
        set({ isLoading: true, error: null });
        const models = await listModelsAPI(filter);
        set({ models, isLoading: false });
        return;
      } catch (error) {
        set({
          error: `Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
      }
    },

    getModelsByProfileGroupedByType: async (profileId: string) => {
      try {
        set({ isLoading: true, error: null });

        // Check if we already have models for this profile
        const existingModels = get().models.filter((model) => model.profile_id === profileId);

        // If we don't have any models yet, fetch them first
        if (existingModels.length === 0) {
          await get().actions.fetchModels({ profile_id: profileId });
        }

        // Use the API function or group the models ourselves
        const groupedModels = await getModelsByProfileGroupedByTypeAPI(profileId);
        set({ isLoading: false });
        return groupedModels;
      } catch (error) {
        set({
          error: `Failed to get models by type for profile ${profileId}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return {} as Record<ModelType, Model[]>;
      }
    },

    // Utility actions
    clearModels: () => set({ models: [] }),

    clearError: () => set({ error: null }),
  },
}));

export const useModels = () => useModelsStore((state) => state.models);
export const useModelById = (id: string) => useModelsStore((state) => state.models.find((model) => model.id === id));
export const useModelsLoading = () => useModelsStore((state) => state.isLoading);
export const useModelsError = () => useModelsStore((state) => state.error);
export const useModelsActions = () => useModelsStore((state) => state.actions);
