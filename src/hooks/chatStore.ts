import { Message } from "@/pages/chat/components/WidgetMessages";
import { Chat, CreateChatParams } from "@/schema/chat-schema";
import {
  createChat as apiCreateChat,
  deleteChat as apiDeleteChat,
  updateChat as apiUpdateChat,
  getChatById,
  listChats,
} from "@/services/chat-service";
import { create } from "zustand";

interface chatState {
  chatList: Pick<Chat, "id" | "name">[];
  selectedChat: Chat | null;
  selectedChatMessages: Message[]; // TODO: get from setSelectedChatById when Messages are implemented
  selectedChatChapters: any[]; // TODO: get from setSelectedChatById when Chapters are implemented
  isLoading: boolean;
  error: string | null;
  actions: {
    fetchChatList: (profileId: string) => Promise<Chat[]>;
    setSelectedChatById: (id: string) => Promise<void>;
    updateSelectedChat: (chat: Partial<Chat>) => Promise<Chat>;

    // Messages
    addChatMessage: (message: Message) => Promise<void>;
    deleteChatMessage: (messageId: string) => Promise<void>;
    updateChatMessage: (messageId: string, message: Partial<Message>) => Promise<Message>;

    // Chapters
    addChatChapter: (chapter: any) => Promise<void>;
    deleteChatChapter: (chapterId: string) => Promise<void>;
    updateChatChapter: (chapterId: string, chapter: Partial<any>) => Promise<any>;

    createChat: (chat: CreateChatParams) => Promise<Chat>;
    deleteChat: (id: string) => Promise<void>;
    clearChatList: () => void;
    clearError: () => void;
  };
}

export const useChatStore = create<chatState>((set, get) => ({
  // Initial State
  chatList: [],
  selectedChat: null,
  selectedChatMessages: [],
  selectedChatChapters: [],
  isLoading: false,
  error: null,

  actions: {
    fetchChatList: async (profileId: string) => {
      try {
        set({ isLoading: true, error: null });
        const chats = await listChats({ profile_id: profileId });
        set({
          chatList: chats.map((chat) => ({ id: chat.id, name: chat.name })),
          isLoading: false,
        });
        return chats;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to fetch chat list",
          isLoading: false,
        });
        return [];
      }
    },

    setSelectedChatById: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const chat = await getChatById(id);

        if (!chat) {
          throw new Error(`Chat with ID ${id} not found`);
        }

        set({
          selectedChat: chat,
          selectedChatMessages: [], // Will be implemented later
          selectedChatChapters: [], // Will be implemented later
          isLoading: false,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to fetch chat",
          isLoading: false,
        });
      }
    },

    updateSelectedChat: async (chatData: Partial<Chat>) => {
      try {
        set({ isLoading: true, error: null });
        const currentChat = get().selectedChat;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        const updatedChat = await apiUpdateChat(currentChat.id, chatData);

        if (!updatedChat) {
          throw new Error("Failed to update chat");
        }

        set((state) => ({
          selectedChat: updatedChat,
          chatList: state.chatList.map((chat) => (chat.id === updatedChat.id ? { id: updatedChat.id, name: updatedChat.name } : chat)),
          isLoading: false,
        }));

        return updatedChat;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to update chat",
          isLoading: false,
        });
        throw error;
      }
    },

    createChat: async (chat: CreateChatParams) => {
      try {
        set({ isLoading: true, error: null });
        const newChat = await apiCreateChat(chat);

        set({
          chatList: [...get().chatList, { id: newChat.id, name: newChat.name }],
          isLoading: false,
        });

        return newChat;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to create chat",
          isLoading: false,
        });
        throw error;
      }
    },

    deleteChat: async (id: string) => {
      try {
        set({ isLoading: true, error: null });

        // Check if the deleted chat is the selected chat
        const isSelectedChat = get().selectedChat?.id === id;

        const success = await apiDeleteChat(id);

        if (!success) {
          throw new Error(`Failed to delete chat with ID ${id}`);
        }

        // Update store state
        set({
          chatList: get().chatList.filter((chat) => chat.id !== id),
          selectedChat: isSelectedChat ? null : get().selectedChat,
          selectedChatMessages: isSelectedChat ? [] : get().selectedChatMessages,
          selectedChatChapters: isSelectedChat ? [] : get().selectedChatChapters,
          isLoading: false,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to delete chat",
          isLoading: false,
        });
        throw error;
      }
    },

    clearChatList: () => {
      set({
        chatList: [],
        selectedChat: null,
        selectedChatMessages: [],
        selectedChatChapters: [],
      });
    },

    clearError: () => {
      set({ error: null });
    },

    // Message placeholders (to be implemented later)
    addChatMessage: async () => {
      /* To be implemented */
    },
    deleteChatMessage: async () => {
      /* To be implemented */
    },
    updateChatMessage: async () => {
      return {} as Message;
    },

    // Chapter placeholders (to be implemented later)
    addChatChapter: async () => {
      /* To be implemented */
    },
    deleteChatChapter: async () => {
      /* To be implemented */
    },
    updateChatChapter: async () => {
      return {};
    },
  },
}));

export const useCurrentChatUserCharacter = () =>
  useChatStore((state) => ({
    userCharacterId: state.selectedChat?.user_character_id,
    userCharacterSettings: state.selectedChat?.user_character_settings,
  }));

export const useCurrentChatId = () => useChatStore((state) => state.selectedChat?.id);
export const useCurrentChatName = () => useChatStore((state) => state.selectedChat?.name);
export const useCurrentChatUserCharacterID = () => useChatStore((state) => state.selectedChat?.user_character_id);
export const useCurrentChatTemplate = () => useChatStore((state) => state.selectedChat?.chat_template_id);
export const useCurrentChatParticipants = () => useChatStore((state) => state.selectedChat?.participants);
export const useCurrentChatMessages = () => useChatStore((state) => state.selectedChatMessages);
export const useCurrentChatChapters = () => useChatStore((state) => state.selectedChatChapters);
export const useChatList = () => useChatStore((state) => state.chatList);
export const useChatActions = () => useChatStore((state) => state.actions);
export const useChatLoading = () => useChatStore((state) => state.isLoading);
export const useChatError = () => useChatStore((state) => state.error);
