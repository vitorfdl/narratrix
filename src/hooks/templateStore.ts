import {
  FormatTemplateFilter,
  NewFormatTemplateParams,
  createFormatTemplate as createFormatTemplateAPI,
  deleteFormatTemplate as deleteFormatTemplateAPI,
  getFormatTemplateById as getFormatTemplateByIdAPI,
  getFormatTemplatesByProfile as getFormatTemplatesByProfileAPI,
  listFormatTemplates as listFormatTemplatesAPI,
  updateFormatTemplate as updateFormatTemplateAPI,
} from "@/services/template-format-service";
import { create } from "zustand";

import {
  InferenceTemplateFilter,
  NewInferenceTemplateParams,
  createInferenceTemplate as createInferenceTemplateAPI,
  deleteInferenceTemplate as deleteInferenceTemplateAPI,
  getInferenceTemplateById as getInferenceTemplateByIdAPI,
  getInferenceTemplatesByProfile as getInferenceTemplatesByProfileAPI,
  listInferenceTemplates as listInferenceTemplatesAPI,
  updateInferenceTemplate as updateInferenceTemplateAPI,
} from "@/services/template-inference-service";

import {
  ChatTemplateFilter,
  NewChatTemplateParams,
  createChatTemplate as createChatTemplateAPI,
  deleteChatTemplate as deleteChatTemplateAPI,
  getChatTemplateById as getChatTemplateByIdAPI,
  getChatTemplatesByChat as getChatTemplatesByChatAPI,
  getChatTemplatesByProfile as getChatTemplatesByProfileAPI,
  listChatTemplates as listChatTemplatesAPI,
  updateChatTemplate as updateChatTemplateAPI,
} from "@/services/template-chat-service";

import { ChatTemplate } from "@/schema/template-chat-schema";
import { FormatTemplate } from "@/schema/template-format-schema";
import { InferenceTemplate } from "@/schema/template-inferance-schema";
import { SystemPromptTemplate } from "@/schema/template-prompt-schema";
import {
  NewSystemPromptTemplateParams,
  TemplateFilter as PromptTemplateFilter,
  createSystemPromptTemplate as createSystemPromptTemplateAPI,
  deleteSystemPromptTemplate as deleteSystemPromptTemplateAPI,
  getSystemPromptTemplateById as getSystemPromptTemplateByIdAPI,
  listSystemPromptTemplates as listSystemPromptTemplatesAPI,
  updateSystemPromptTemplate as updateSystemPromptTemplateAPI,
} from "@/services/template-prompt-service";

interface TemplateState {
  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Template collections
  formatTemplates: FormatTemplate[];
  inferenceTemplates: InferenceTemplate[];
  promptTemplates: SystemPromptTemplate[];
  chatTemplates: ChatTemplate[];

  actions: {
    createFormatTemplate: (templateData: NewFormatTemplateParams) => Promise<FormatTemplate>;
    getFormatTemplateById: (id: string) => Promise<FormatTemplate | null>;
    updateFormatTemplate: (
      id: string,
      updateData: Partial<Omit<FormatTemplate, "id" | "profile_id" | "createdAt" | "updatedAt">>,
    ) => Promise<FormatTemplate | null>;
    deleteFormatTemplate: (id: string) => Promise<boolean>;
    fetchFormatTemplates: (filter?: FormatTemplateFilter) => Promise<void>;
    getFormatTemplatesByProfile: (profileId: string) => Promise<FormatTemplate[]>;

    // Inference Template Operations
    createInferenceTemplate: (templateData: NewInferenceTemplateParams) => Promise<InferenceTemplate>;
    getInferenceTemplateById: (id: string) => Promise<InferenceTemplate | null>;
    updateInferenceTemplate: (
      id: string,
      updateData: Partial<Omit<InferenceTemplate, "id" | "profile_id" | "createdAt" | "updatedAt">>,
    ) => Promise<InferenceTemplate | null>;
    deleteInferenceTemplate: (id: string) => Promise<boolean>;
    fetchInferenceTemplates: (filter?: InferenceTemplateFilter) => Promise<void>;
    getInferenceTemplatesByProfile: (profileId: string) => Promise<InferenceTemplate[]>;

    // Prompt Template Operations
    createPromptTemplate: (templateData: NewSystemPromptTemplateParams) => Promise<SystemPromptTemplate>;
    getPromptTemplateById: (id: string) => Promise<SystemPromptTemplate | null>;
    updatePromptTemplate: (
      id: string,
      updateData: Partial<Omit<SystemPromptTemplate, "id" | "profile_id" | "createdAt" | "updatedAt">>,
    ) => Promise<SystemPromptTemplate | null>;
    deletePromptTemplate: (id: string) => Promise<boolean>;
    fetchPromptTemplates: (filter?: PromptTemplateFilter) => Promise<void>;

    // Chat Template Operations
    createChatTemplate: (templateData: NewChatTemplateParams) => Promise<ChatTemplate>;
    getChatTemplateById: (id: string) => Promise<ChatTemplate | null>;
    updateChatTemplate: (
      id: string,
      updateData: Partial<Omit<ChatTemplate, "id" | "profile_id" | "created_at" | "updated_at">>,
    ) => Promise<ChatTemplate | null>;
    deleteChatTemplate: (id: string) => Promise<boolean>;
    fetchChatTemplates: (filter?: ChatTemplateFilter) => Promise<void>;
    getChatTemplatesByProfile: (profileId: string) => Promise<ChatTemplate[]>;
    getChatTemplatesByChat: (chatId: string) => Promise<ChatTemplate[]>;

    // Utility Functions
    clearTemplates: () => void;
    clearError: () => void;
  };
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  // Initial state
  isLoading: false,
  error: null,
  formatTemplates: [],
  inferenceTemplates: [],
  promptTemplates: [],
  chatTemplates: [],

  // Format Template Operations
  actions: {
    createFormatTemplate: async (templateData: NewFormatTemplateParams) => {
      try {
        set({ isLoading: true, error: null });
        const newTemplate = await createFormatTemplateAPI(templateData);

        set((state) => ({
          formatTemplates: [...state.formatTemplates, newTemplate],
          isLoading: false,
        }));

        return newTemplate;
      } catch (error) {
        set({
          error: `Failed to create format template: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        throw error;
      }
    },

    getFormatTemplateById: async (id: string) => {
      try {
        set({ isLoading: true, error: null });

        // First check if the template is already in the store
        const cachedTemplate = get().formatTemplates.find((template) => template.id === id);
        if (cachedTemplate) {
          set({ isLoading: false });
          return cachedTemplate;
        }

        // If not in the store, fetch it from the API
        const template = await getFormatTemplateByIdAPI(id);

        // If found, add it to our store
        if (template) {
          set((state) => ({
            formatTemplates: [...state.formatTemplates.filter((t) => t.id !== id), template],
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return template;
      } catch (error) {
        set({
          error: `Failed to get format template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    updateFormatTemplate: async (id: string, updateData) => {
      try {
        set({ isLoading: true, error: null });
        const updatedTemplate = await updateFormatTemplateAPI(id, updateData);

        if (updatedTemplate) {
          set((state) => ({
            formatTemplates: state.formatTemplates.map((template) => (template.id === id ? updatedTemplate : template)),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return updatedTemplate;
      } catch (error) {
        set({
          error: `Failed to update format template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    deleteFormatTemplate: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const success = await deleteFormatTemplateAPI(id);

        if (success) {
          set((state) => ({
            formatTemplates: state.formatTemplates.filter((template) => template.id !== id),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return success;
      } catch (error) {
        set({
          error: `Failed to delete format template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return false;
      }
    },

    fetchFormatTemplates: async (filter?: FormatTemplateFilter) => {
      try {
        set({ isLoading: true, error: null });
        const templates = await listFormatTemplatesAPI(filter);
        set({ formatTemplates: templates, isLoading: false });
      } catch (error) {
        set({
          error: `Failed to fetch format templates: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
      }
    },

    getFormatTemplatesByProfile: async (profileId: string) => {
      try {
        set({ isLoading: true, error: null });

        // Check if we already have templates for this profile
        const existingTemplates = get().formatTemplates.filter((template) => template.profile_id === profileId);

        // If we don't have any templates yet, fetch them first
        if (existingTemplates.length === 0) {
          await get().actions.fetchFormatTemplates({ profile_id: profileId });
        }

        const templates = await getFormatTemplatesByProfileAPI(profileId);
        set({ isLoading: false });
        return templates;
      } catch (error) {
        set({
          error: `Failed to get format templates for profile ${profileId}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return [];
      }
    },

    // Inference Template Operations
    createInferenceTemplate: async (templateData: NewInferenceTemplateParams) => {
      try {
        set({ isLoading: true, error: null });
        const newTemplate = await createInferenceTemplateAPI(templateData);

        set((state) => ({
          inferenceTemplates: [...state.inferenceTemplates, newTemplate],
          isLoading: false,
        }));

        return newTemplate;
      } catch (error) {
        set({
          error: `Failed to create inference template: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        throw error;
      }
    },

    getInferenceTemplateById: async (id: string) => {
      try {
        set({ isLoading: true, error: null });

        // First check if the template is already in the store
        const cachedTemplate = get().inferenceTemplates.find((template) => template.id === id);
        if (cachedTemplate) {
          set({ isLoading: false });
          return cachedTemplate;
        }

        // If not in the store, fetch it from the API
        const template = await getInferenceTemplateByIdAPI(id);

        // If found, add it to our store
        if (template) {
          set((state) => ({
            inferenceTemplates: [...state.inferenceTemplates.filter((t) => t.id !== id), template],
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return template;
      } catch (error) {
        set({
          error: `Failed to get inference template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    updateInferenceTemplate: async (id: string, updateData) => {
      try {
        set({ isLoading: true, error: null });
        const updatedTemplate = await updateInferenceTemplateAPI(id, updateData);

        if (updatedTemplate) {
          set((state) => ({
            inferenceTemplates: state.inferenceTemplates.map((template) => (template.id === id ? updatedTemplate : template)),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return updatedTemplate;
      } catch (error) {
        set({
          error: `Failed to update inference template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    deleteInferenceTemplate: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const success = await deleteInferenceTemplateAPI(id);

        if (success) {
          set((state) => ({
            inferenceTemplates: state.inferenceTemplates.filter((template) => template.id !== id),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return success;
      } catch (error) {
        set({
          error: `Failed to delete inference template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return false;
      }
    },

    fetchInferenceTemplates: async (filter?: InferenceTemplateFilter) => {
      try {
        set({ isLoading: true, error: null });
        const templates = await listInferenceTemplatesAPI(filter);
        set({ inferenceTemplates: templates, isLoading: false });
      } catch (error) {
        set({
          error: `Failed to fetch inference templates: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
      }
    },

    getInferenceTemplatesByProfile: async (profileId: string) => {
      try {
        set({ isLoading: true, error: null });

        // Check if we already have templates for this profile
        const existingTemplates = get().inferenceTemplates.filter((template) => template.profile_id === profileId);

        // If we don't have any templates yet, fetch them first
        if (existingTemplates.length === 0) {
          await get().actions.fetchInferenceTemplates({ profile_id: profileId });
        }

        const templates = await getInferenceTemplatesByProfileAPI(profileId);
        set({ isLoading: false });
        return templates;
      } catch (error) {
        set({
          error: `Failed to get inference templates for profile ${profileId}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return [];
      }
    },

    // Prompt Template Operations
    createPromptTemplate: async (templateData: NewSystemPromptTemplateParams) => {
      try {
        set({ isLoading: true, error: null });
        const newTemplate = await createSystemPromptTemplateAPI(templateData);

        set((state) => ({
          promptTemplates: [...state.promptTemplates, newTemplate],
          isLoading: false,
        }));

        return newTemplate;
      } catch (error) {
        set({
          error: `Failed to create prompt template: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        throw error;
      }
    },

    getPromptTemplateById: async (id: string) => {
      try {
        set({ isLoading: true, error: null });

        // First check if the template is already in the store
        const cachedTemplate = get().promptTemplates.find((template) => template.id === id);
        if (cachedTemplate) {
          set({ isLoading: false });
          return cachedTemplate;
        }

        // If not in the store, fetch it from the API
        const template = await getSystemPromptTemplateByIdAPI(id);

        // If found, add it to our store
        if (template) {
          set((state) => ({
            promptTemplates: [...state.promptTemplates.filter((t) => t.id !== id), template],
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return template;
      } catch (error) {
        set({
          error: `Failed to get prompt template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    updatePromptTemplate: async (id: string, updateData) => {
      try {
        set({ isLoading: true, error: null });
        const updatedTemplate = await updateSystemPromptTemplateAPI(id, updateData);

        if (updatedTemplate) {
          set((state) => ({
            promptTemplates: state.promptTemplates.map((template) => (template.id === id ? updatedTemplate : template)),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return updatedTemplate;
      } catch (error) {
        set({
          error: `Failed to update prompt template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return null;
      }
    },

    deletePromptTemplate: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const success = await deleteSystemPromptTemplateAPI(id);

        if (success) {
          set((state) => ({
            promptTemplates: state.promptTemplates.filter((template) => template.id !== id),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }

        return success;
      } catch (error) {
        set({
          error: `Failed to delete prompt template with ID ${id}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return false;
      }
    },

    fetchPromptTemplates: async (filter?: PromptTemplateFilter) => {
      try {
        set({ isLoading: true, error: null });
        const templates = await listSystemPromptTemplatesAPI(filter);
        set({ promptTemplates: templates, isLoading: false });
      } catch (error) {
        set({
          error: `Failed to fetch prompt templates: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
      }
    },

    // Chat Template Operations
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

    getChatTemplatesByChat: async (chatId: string) => {
      try {
        set({ isLoading: true, error: null });

        // Check if we already have templates for this chat
        const existingTemplates = get().chatTemplates.filter((template) => template.chat_id === chatId);

        // If we don't have any templates yet, fetch them first
        if (existingTemplates.length === 0) {
          await get().actions.fetchChatTemplates({ chat_id: chatId });
        }

        const templates = await getChatTemplatesByChatAPI(chatId);
        set({ isLoading: false });
        return templates;
      } catch (error) {
        set({
          error: `Failed to get chat templates for chat ${chatId}: ${error instanceof Error ? error.message : String(error)}`,
          isLoading: false,
        });
        return [];
      }
    },

    // Utility Functions
    clearTemplates: () =>
      set({
        formatTemplates: [],
        inferenceTemplates: [],
        promptTemplates: [],
        chatTemplates: [],
      }),

    clearError: () => set({ error: null }),
  },
}));

export const useFormatTemplateList = () => useTemplateStore((state) => state.formatTemplates);
export const useInferenceTemplateList = () => useTemplateStore((state) => state.inferenceTemplates);
export const usePromptTemplateList = () => useTemplateStore((state) => state.promptTemplates);
export const useChatTemplateList = () => useTemplateStore((state) => state.chatTemplates);

export const useFormatTemplate = (id: string) => useTemplateStore((state) => state.formatTemplates.find((template) => template.id === id));
export const useInferenceTemplate = (id: string) => useTemplateStore((state) => state.inferenceTemplates.find((template) => template.id === id));
export const usePromptTemplate = (id: string) => useTemplateStore((state) => state.promptTemplates.find((template) => template.id === id));
export const useChatTemplate = (id: string) => useTemplateStore((state) => state.chatTemplates.find((template) => template.id === id));
export const useTemplateActions = () => useTemplateStore((state) => state.actions);

export const useTemplateError = () => useTemplateStore((state) => state.error);
export const useTemplateIsLoading = () => useTemplateStore((state) => state.isLoading);
