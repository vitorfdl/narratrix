import { ChatMessage, CreateChatMessageParams, UpdateChatMessageParams } from "@/schema/chat-message-schema";
import { Chat, ChatParticipant, CreateChatParams } from "@/schema/chat-schema";
import {
  createChatMessage as apiCreateChatMessage,
  deleteChatMessage as apiDeleteChatMessage,
  updateChatMessage as apiUpdateChatMessage,
  getChatMessagesByChatId,
  getNextMessagePosition,
} from "@/services/chat-message-service";
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
  selectedChatMessages: ChatMessage[]; // TODO: get from setSelectedChatById when Messages are implemented
  selectedChatChapters: any[]; // TODO: get from setSelectedChatById when Chapters are implemented
  isLoading: boolean;
  error: string | null;
  actions: {
    fetchChatList: (profileId: string) => Promise<Chat[]>;
    setSelectedChatById: (id: string) => Promise<void>;
    updateSelectedChat: (chat: Partial<Chat>) => Promise<Chat>;

    // Messages
    addChatMessage: (message: CreateChatMessageParams) => Promise<ChatMessage>;
    deleteChatMessage: (messageId: string) => Promise<void>;
    updateChatMessage: (messageId: string, message: Partial<UpdateChatMessageParams>) => Promise<ChatMessage>;

    // Chapters
    addChatChapter: (chapter: any) => Promise<void>;
    deleteChatChapter: (chapterId: string) => Promise<void>;
    updateChatChapter: (chapterId: string, chapter: Partial<any>) => Promise<any>;

    // Participants
    addParticipant: (participant: ChatParticipant) => Promise<void>;
    removeParticipant: (participantId: string) => Promise<void>;
    updateParticipant: (participantId: string, data: Partial<ChatParticipant>) => Promise<void>;
    toggleParticipantEnabled: (participantId: string) => Promise<void>;

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

        // Fetch messages for the selected chat
        const messages = await getChatMessagesByChatId(id);

        set({
          selectedChat: chat,
          selectedChatMessages: messages,
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

    // Participant management functions
    addParticipant: async (participant: ChatParticipant) => {
      try {
        const currentChat = get().selectedChat;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        const currentParticipants = currentChat.participants || [];

        // Check if participant with the same ID already exists
        if (currentParticipants.some((p) => p.id === participant.id)) {
          throw new Error(`Participant with ID ${participant.id} already exists`);
        }

        const updatedParticipants = [...currentParticipants, participant];

        const updatedChat = await get().actions.updateSelectedChat({
          participants: updatedParticipants,
        });

        set({
          selectedChat: updatedChat,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to add participant",
        });
        throw error;
      }
    },

    removeParticipant: async (participantId: string) => {
      try {
        const currentChat = get().selectedChat;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        const currentParticipants = currentChat.participants || [];

        if (!currentParticipants.some((p) => p.id === participantId)) {
          throw new Error(`Participant with ID ${participantId} not found`);
        }

        const updatedParticipants = currentParticipants.filter((p) => p.id !== participantId);

        const updatedChat = await get().actions.updateSelectedChat({
          participants: updatedParticipants,
        });

        set({
          selectedChat: updatedChat,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to remove participant",
        });
        throw error;
      }
    },

    updateParticipant: async (participantId: string, data: Partial<ChatParticipant>) => {
      try {
        const currentChat = get().selectedChat;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        const currentParticipants = currentChat.participants || [];
        const participantIndex = currentParticipants.findIndex((p) => p.id === participantId);

        if (participantIndex === -1) {
          throw new Error(`Participant with ID ${participantId} not found`);
        }

        const updatedParticipants = [...currentParticipants];
        updatedParticipants[participantIndex] = {
          ...updatedParticipants[participantIndex],
          ...data,
        };

        const updatedChat = await get().actions.updateSelectedChat({
          participants: updatedParticipants,
        });

        set({
          selectedChat: updatedChat,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to update participant",
        });
        throw error;
      }
    },

    toggleParticipantEnabled: async (participantId: string) => {
      try {
        const currentChat = get().selectedChat;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        const currentParticipants = currentChat.participants || [];
        const participant = currentParticipants.find((p) => p.id === participantId);

        if (!participant) {
          throw new Error(`Participant with ID ${participantId} not found`);
        }

        await get().actions.updateParticipant(participantId, {
          enabled: !participant.enabled,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to toggle participant",
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

    // Message implementations
    addChatMessage: async (message: CreateChatMessageParams) => {
      try {
        set({ isLoading: true, error: null });
        const currentChat = get().selectedChat;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        // If position isn't provided, get the next position
        if (!message.position) {
          message.position = await getNextMessagePosition(currentChat.id);
        }

        const newMessage = await apiCreateChatMessage({
          ...message,
          chat_id: currentChat.id,
        });

        set((state) => ({
          selectedChatMessages: [...state.selectedChatMessages, newMessage],
          isLoading: false,
        }));

        return newMessage;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to add message",
          isLoading: false,
        });
        throw error;
      }
    },

    deleteChatMessage: async (messageId: string) => {
      try {
        set({ isLoading: true, error: null });

        const success = await apiDeleteChatMessage(messageId);

        if (!success) {
          throw new Error(`Failed to delete message with ID ${messageId}`);
        }

        set((state) => ({
          selectedChatMessages: state.selectedChatMessages.filter((msg) => msg.id !== messageId),
          isLoading: false,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to delete message",
          isLoading: false,
        });
        throw error;
      }
    },

    updateChatMessage: async (messageId: string, messageData: UpdateChatMessageParams) => {
      try {
        set({ isLoading: true, error: null });

        const updatedMessage = await apiUpdateChatMessage(messageId, messageData);

        if (!updatedMessage) {
          throw new Error(`Failed to update message with ID ${messageId}`);
        }

        set((state) => ({
          selectedChatMessages: state.selectedChatMessages.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)),
          isLoading: false,
        }));

        return updatedMessage;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to update message",
          isLoading: false,
        });
        throw error;
      }
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
export const useCurrentChatTemplateID = () => useChatStore((state) => state.selectedChat?.chat_template_id);
export const useCurrentChatParticipants = () => useChatStore((state) => state.selectedChat?.participants || []);
export const useCurrentChatMessages = () => useChatStore((state) => state.selectedChatMessages);
export const useCurrentChatChapters = () => useChatStore((state) => state.selectedChatChapters);
export const useChatList = () => useChatStore((state) => state.chatList);
export const useChatActions = () => useChatStore((state) => state.actions);
export const useChatLoading = () => useChatStore((state) => state.isLoading);
export const useChatError = () => useChatStore((state) => state.error);
