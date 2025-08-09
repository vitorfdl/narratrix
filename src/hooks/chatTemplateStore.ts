import { create } from "zustand";
import { ChatTemplate } from "@/schema/template-chat-schema";
import {
  ChatTemplateFilter,
  createChatTemplate as createChatTemplateAPI,
  deleteChatTemplate as deleteChatTemplateAPI,
  getChatTemplateById as getChatTemplateByIdAPI,
  getChatTemplatesByProfile as getChatTemplatesByProfileAPI,
  listChatTemplates as listChatTemplatesAPI,
  NewChatTemplateParams,
  updateChatTemplate as updateChatTemplateAPI,
} from "@/services/template-chat-service";

interface ChatTemplateState {
  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Template collections
  chatTemplates: ChatTemplate[];

  actions: {
    // Chat Template Operations
    createChatTemplate: (templateData: NewChatTemplateParams) => Promise<ChatTemplate>;
    getChatTemplateById: (id: string) => Promise<ChatTemplate | null>;
    updateChatTemplate: (id: string, updateData: Partial<Omit<ChatTemplate, "id" | "profile_id" | "created_at" | "updated_at">>) => Promise<ChatTemplate | null>;
    deleteChatTemplate: (id: string) => Promise<boolean>;
    fetchChatTemplates: (filter?: ChatTemplateFilter) => Promise<void>;
    getChatTemplatesByProfile: (profileId: string) => Promise<ChatTemplate[]>;

    // Utility Functions
    clearTemplates: () => void;
    clearError: () => void;
  };
}

export const useChatTemplateStore = create<ChatTemplateState>((set, get) => ({
  // Initial state
  isLoading: false,
  error: null,
  chatTemplates: [],

  // Chat Template Operations
  actions: {
    createChatTemplate: async (templateData: NewChatTemplateParams) => {
      try {
        set({ isLoading: true, error: null });
        const newTemplate = await createChatTemplateAPI(templateData);

        set((state) => ({
          chatTemplates: [...state.chatTemplates, newTemplate],
          isLoading: false,
        }));

        return newTemplate;
      } catch (error) {
        set({
          error: `Failed to create chat template: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        throw error;
      }
    },

    getChatTemplateById: async (id: string) => {
      try {
        set({ isLoading: true, error: null });

        // First check if the template is already in the store
        const cachedTemplate = get().chatTemplates.find((template) => template.id === id);
        if (cachedTemplate) {
          set({ isLoading: false });
          return cachedTemplate;
        }

        // If not in the store, fetch it from the API
        const template = await getChatTemplateByIdAPI(id);

        // If found, add it to our store
        if (template) {
          set((state) => ({
            chatTemplates: [...state.chatTemplates.filter((t) => t.id !== id), template],
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return template;
      } catch (error) {
        set({
          error: `Failed to get chat template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    updateChatTemplate: async (id: string, updateData) => {
      try {
        set({ isLoading: true, error: null });
        const updatedTemplate = await updateChatTemplateAPI(id, updateData);

        if (updatedTemplate) {
          set((state) => ({
            chatTemplates: state.chatTemplates.map((template) => (template.id === id ? updatedTemplate : template)),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return updatedTemplate;
      } catch (error) {
        console.log("error", error);
        set({
          error: `Failed to update chat template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    deleteChatTemplate: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const success = await deleteChatTemplateAPI(id);

        if (success) {
          set((state) => ({
            chatTemplates: state.chatTemplates.filter((template) => template.id !== id),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return success;
      } catch (error) {
        set({
          error: `Failed to delete chat template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return false;
      }
    },

    fetchChatTemplates: async (filter?: ChatTemplateFilter) => {
      try {
        set({ isLoading: true, error: null });
        const templates = await listChatTemplatesAPI(filter);
        set({ chatTemplates: templates, isLoading: false });
      } catch (error) {
        console.log("error", error);
        set({
          error: `Failed to fetch chat templates: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
      }
    },

    getChatTemplatesByProfile: async (profileId: string) => {
      try {
        set({ isLoading: true, error: null });

        // Check if we already have templates for this profile
        const existingTemplates = get().chatTemplates.filter((template) => template.profile_id === profileId);

        // If we don't have any templates yet, fetch them first
        if (existingTemplates.length === 0) {
          await get().actions.fetchChatTemplates({ profile_id: profileId });
        }

        const templates = await getChatTemplatesByProfileAPI(profileId);
        set({ isLoading: false });
        return templates;
      } catch (error) {
        set({
          error: `Failed to get chat templates for profile ${profileId}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return [];
      }
    },

    // Utility Functions
    clearTemplates: () =>
      set({
        chatTemplates: [],
      }),

    clearError: () => set({ error: null }),
  },
}));

export const useChatTemplateList = () => useChatTemplateStore((state) => state.chatTemplates);
export const useChatTemplate = (id: string) => useChatTemplateStore((state) => state.chatTemplates.find((template) => template.id === id));
export const useChatTemplateActions = () => useChatTemplateStore((state) => state.actions);
export const useChatTemplateError = () => useChatTemplateStore((state) => state.error);
export const useChatTemplateIsLoading = () => useChatTemplateStore((state) => state.isLoading);
