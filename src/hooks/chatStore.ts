import { ChatChapter } from "@/schema/chat-chapter-schema";
import { ChatMessage, CreateChatMessageParams, UpdateChatMessageParams } from "@/schema/chat-message-schema";
import { Chat, ChatParticipant, CreateChatParams } from "@/schema/chat-schema";
import {
  createChatChapter as apiCreateChatChapter,
  deleteChatChapter as apiDeleteChatChapter,
  updateChatChapter as apiUpdateChatChapter,
  getChaptersByChatId,
  getNextChapterSequence,
} from "@/services/chat-chapter-service";
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
import { toast } from "sonner";
import { create } from "zustand";

// Create a type that omits chat_id and makes position optional for store use
type AddChatMessageParams = Omit<CreateChatMessageParams, "chat_id" | "chapter_id" | "disabled" | "position" | "message_index"> & {
  position?: number;
  disabled?: boolean;
};

// Create a type for adding chapters through the store
type AddChatChapterParams = Omit<ChatChapter, "id" | "chat_id" | "created_at" | "updated_at" | "sequence"> & {
  sequence?: number;
};

interface chatState {
  chatList: Pick<Chat, "id" | "name">[];
  selectedChat: Chat;
  selectedChatMessages: ChatMessage[];
  selectedChatChapters: ChatChapter[];
  isLoading: boolean;
  error: string | null;
  actions: {
    fetchChatList: (profileId: string) => Promise<Chat[]>;
    setSelectedChatById: (id: string) => Promise<void>;
    updateSelectedChat: (chat: Partial<Chat>) => Promise<Chat>;

    // Messages
    addChatMessage: (message: AddChatMessageParams) => Promise<ChatMessage>;
    deleteChatMessage: (messageId: string) => Promise<void>;
    updateChatMessage: (messageId: string, message: Partial<UpdateChatMessageParams>) => Promise<ChatMessage>;

    // Chapters
    addChatChapter: (chapter: AddChatChapterParams) => Promise<ChatChapter>;
    deleteChatChapter: (chapterId: string) => Promise<boolean>;
    updateChatChapter: (chapterId: string, chapter: Partial<ChatChapter>) => Promise<ChatChapter | null>;
    fetchChatChapters: (chatId: string) => Promise<ChatChapter[]>;

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
  selectedChat: {} as Chat,
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
        const messages = await getChatMessagesByChatId(id, chat.active_chapter_id!);

        // Fetch chapters for the selected chat
        const chapters = await getChaptersByChatId(id);

        set({
          selectedChat: chat,
          selectedChatMessages: messages,
          selectedChatChapters: chapters,
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

        if (!newChat) {
          throw new Error("Failed to create chat");
        }

        // Create a default chapter for the new chat
        const defaultChapter = await apiCreateChatChapter({
          chat_id: newChat.id,
          title: "Chapter 1",
          sequence: 1,
          scenario: null,
          instructions: null,
          start_message: null,
        });

        // Update the chat with the active chapter
        const updatedChat = await apiUpdateChat(newChat.id, {
          active_chapter_id: defaultChapter.id,
        });

        if (!updatedChat) {
          throw new Error("Failed to update chat with active chapter");
        }

        set({
          chatList: [...get().chatList, { id: updatedChat.id, name: updatedChat.name }],
          isLoading: false,
        });

        return updatedChat;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create chat");
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
          selectedChat: isSelectedChat ? ({} as Chat) : get().selectedChat,
          selectedChatMessages: isSelectedChat ? [] : get().selectedChatMessages,
          selectedChatChapters: isSelectedChat ? [] : get().selectedChatChapters,
          isLoading: false,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete chat");
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

        await get().actions.updateSelectedChat({
          participants: updatedParticipants,
        });

        set((state) => ({
          selectedChat: {
            ...state.selectedChat!,
            participants: updatedParticipants,
          },
        }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add participant");
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

        set((state) => ({
          selectedChat: {
            ...state.selectedChat!,
            participants: updatedParticipants,
          },
        }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to remove participant");
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

        set((state) => ({
          selectedChat: {
            ...state.selectedChat!,
            participants: updatedParticipants,
          },
        }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update participant");
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
        toast.error(error instanceof Error ? error.message : "Failed to toggle participant");
        set({
          error: error instanceof Error ? error.message : "Failed to toggle participant",
        });
        throw error;
      }
    },

    clearChatList: () => {
      set({
        chatList: [],
        selectedChat: {} as Chat,
        selectedChatMessages: [],
        selectedChatChapters: [],
      });
    },

    clearError: () => {
      set({ error: null });
    },

    // Message implementations
    addChatMessage: async (message) => {
      try {
        set({ isLoading: true, error: null });
        const currentChat = get().selectedChat;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        // If position isn't provided, get the next position
        if (!message.position) {
          message.position = await getNextMessagePosition(currentChat.id, currentChat.active_chapter_id!);
        }

        const newMessage = await apiCreateChatMessage({
          ...message,
          chat_id: currentChat.id,
          chapter_id: currentChat.active_chapter_id!,
          message_index: 0,
          position: message.position,
          disabled: message.disabled ?? false,
        });

        set((state) => ({
          selectedChatMessages: [...state.selectedChatMessages, newMessage],
          isLoading: false,
        }));

        return newMessage;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add message");
        set({
          error: error instanceof Error ? error.message : "Failed to add message",
          isLoading: false,
        });
        throw error;
      }
    },

    deleteChatMessage: async (messageId) => {
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
        toast.error(error instanceof Error ? error.message : "Failed to delete message");
        set({
          error: error instanceof Error ? error.message : "Failed to delete message",
          isLoading: false,
        });
        throw error;
      }
    },

    updateChatMessage: async (messageId, messageData, persist = true) => {
      try {
        set({ isLoading: true, error: null });

        let updatedMessage: ChatMessage | null = null;
        if (persist) {
          updatedMessage = await apiUpdateChatMessage(messageId, messageData);
          if (!updatedMessage) {
            throw new Error(`Failed to update message with ID ${messageId}`);
          }
        } else {
          updatedMessage = {
            ...get().selectedChatMessages.find((msg) => msg.id === messageId),
            ...messageData,
          } as ChatMessage;
          if (!updatedMessage) {
            throw new Error(`Failed to update message with ID ${messageId}`);
          }
        }

        set((state) => ({
          selectedChatMessages: state.selectedChatMessages.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)),
          isLoading: false,
        }));

        return updatedMessage;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update message");
        set({
          error: error instanceof Error ? error.message : "Failed to update message",
          isLoading: false,
        });
        throw error;
      }
    },

    // Chapter implementations
    fetchChatChapters: async (chatId: string) => {
      try {
        set({ isLoading: true, error: null });
        const chapters = await getChaptersByChatId(chatId);

        set({
          selectedChatChapters: chapters,
          isLoading: false,
        });

        return chapters;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to fetch chat chapters");
        set({
          error: error instanceof Error ? error.message : "Failed to fetch chat chapters",
          isLoading: false,
        });
        throw error;
      }
    },

    addChatChapter: async (chapterData: AddChatChapterParams) => {
      try {
        set({ isLoading: true, error: null });
        const currentChat = get().selectedChat;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        // If sequence isn't provided, get the next sequence number
        const sequence = chapterData.sequence || (await getNextChapterSequence(currentChat.id));

        const newChapter = await apiCreateChatChapter({
          chat_id: currentChat.id,
          title: chapterData.title,
          sequence,
          scenario: chapterData.scenario || null,
          instructions: chapterData.instructions || null,
          start_message: chapterData.start_message || null,
          custom: chapterData.custom || null,
        });

        set((state) => ({
          selectedChatChapters: [...state.selectedChatChapters, newChapter],
          isLoading: false,
        }));

        return newChapter;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add chat chapter");
        set({
          error: error instanceof Error ? error.message : "Failed to add chat chapter",
          isLoading: false,
        });
        throw error;
      }
    },

    deleteChatChapter: async (chapterId: string) => {
      try {
        set({ isLoading: true, error: null });
        const currentChat = get().selectedChat;
        const chapters = get().selectedChatChapters;

        if (!currentChat) {
          throw new Error("No chat selected");
        }

        // Prevent deletion if it's the only chapter
        if (chapters.length <= 1) {
          set({
            error: "Cannot delete the only chapter in the chat",
            isLoading: false,
          });
          return false;
        }

        // Check if the chapter to delete is the active chapter
        const isActiveChapter = currentChat.active_chapter_id === chapterId;

        // Delete the chapter
        const success = await apiDeleteChatChapter(chapterId);

        if (!success) {
          throw new Error(`Failed to delete chapter with ID ${chapterId}`);
        }

        // Update the selectedChatChapters
        const updatedChapters = chapters.filter((chapter) => chapter.id !== chapterId);

        set((state) => ({
          selectedChatChapters: updatedChapters,
          isLoading: false,
        }));

        // If the deleted chapter was the active one, set a new active chapter
        if (isActiveChapter && updatedChapters.length > 0) {
          // Find the chapter with the next lowest sequence number
          const newActiveChapter = updatedChapters.reduce((prev, current) => (prev.sequence < current.sequence ? prev : current));

          // Update the chat with the new active chapter
          await get().actions.updateSelectedChat({
            active_chapter_id: newActiveChapter.id,
          });

          // Also update the messages to show the new chapter's messages
          const messages = await getChatMessagesByChatId(currentChat.id, newActiveChapter.id);
          set({
            selectedChatMessages: messages,
          });
        }

        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete chat chapter");
        set({
          error: error instanceof Error ? error.message : "Failed to delete chat chapter",
          isLoading: false,
        });
        throw error;
      }
    },

    updateChatChapter: async (chapterId: string, chapterData: Partial<ChatChapter>) => {
      try {
        set({ isLoading: true, error: null });

        const updatedChapter = await apiUpdateChatChapter(chapterId, chapterData);

        if (!updatedChapter) {
          throw new Error(`Failed to update chapter with ID ${chapterId}`);
        }

        set((state) => ({
          selectedChatChapters: state.selectedChatChapters.map((chapter) => (chapter.id === updatedChapter.id ? updatedChapter : chapter)),
          isLoading: false,
        }));

        return updatedChapter;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update chat chapter");
        set({
          error: error instanceof Error ? error.message : "Failed to update chat chapter",
          isLoading: false,
        });
        throw error;
      }
    },
  },
}));

export const useCurrentChatUserCharacter = () =>
  useChatStore((state) => ({
    userCharacterId: state.selectedChat?.user_character_id,
    userCharacterSettings: state.selectedChat?.user_character_settings,
  }));

export const useCurrentChatId = () => useChatStore((state) => state.selectedChat.id);
export const useCurrentChatName = () => useChatStore((state) => state.selectedChat.name);
export const useCurrentChatUserCharacterID = () => useChatStore((state) => state.selectedChat.user_character_id);
export const useCurrentChatTemplateID = () => useChatStore((state) => state.selectedChat.chat_template_id);
export const useCurrentChatActiveChapterID = () => useChatStore((state) => state.selectedChat.active_chapter_id);
export const useCurrentChatParticipants = () => useChatStore((state) => state.selectedChat.participants);
export const useCurrentChatMessages = () => useChatStore((state) => state.selectedChatMessages);
export const useCurrentChatChapters = () => useChatStore((state) => state.selectedChatChapters);
export const useChatList = () => useChatStore((state) => state.chatList);
export const useChatActions = () => useChatStore((state) => state.actions);
export const useChatLoading = () => useChatStore((state) => state.isLoading);
export const useChatError = () => useChatStore((state) => state.error);
