import { useCallback, useMemo } from "react";
import { getCurrentChatId, useChatActions, useCurrentChatMessages } from "@/hooks/chatStore";
import type { ChatMessage, ChatMessageType } from "@/schema/chat-message-schema";
import { updateChatMessage as apiUpdateChatMessage } from "@/services/chat-message-service";

/**
 * Hook for managing chat messages during inference.
 *
 * Provides two update paths:
 * - Store-based: `updateMessageById` uses the Zustand store (reactive UI for current chat).
 * - Direct DB: `updateMessageDirect` bypasses the store, safe for background-chat streaming.
 */
export function useMessageManager() {
  const chatMessages = useCurrentChatMessages();
  const { addChatMessage, updateChatMessage, fetchChatMessages } = useChatActions();

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    if (chatMessages) {
      for (const msg of chatMessages) {
        map.set(msg.id, msg);
      }
    }
    return map;
  }, [chatMessages]);

  /**
   * Updates a character message with new text (store-aware, reactive for current chat).
   */
  const updateMessageById = useCallback(
    async (messageId: string, messageText: string, messageIndex = 0): Promise<void> => {
      try {
        if (messageId === "generate-input-area" || !messageId) {
          return;
        }

        const existingMessage = messageMap.get(messageId);

        const updatedMessages = existingMessage?.messages ? [...existingMessage.messages] : [];

        if (updatedMessages.length <= messageIndex) {
          while (updatedMessages.length < messageIndex) {
            updatedMessages.push("");
          }
          updatedMessages.push(messageText);
        } else {
          updatedMessages[messageIndex] = messageText;
        }

        await updateChatMessage(messageId, {
          messages: updatedMessages,
          message_index: messageIndex,
        });
      } catch (err) {
        console.error("Failed to update character message:", err);
      }
    },
    [messageMap, updateChatMessage],
  );

  /**
   * Updates a message directly in the DB, bypassing the Zustand store.
   * Safe to call for any chat regardless of which chat is currently selected.
   * If the target chatId matches the currently viewed chat, the store is refreshed afterward.
   *
   * @param chatId The chat this message belongs to (used to decide whether to refresh store).
   * @param messageId The message to update.
   * @param messageText The new text content.
   * @param messageIndex Which version/index to update.
   * @param existingMessages The current messages array snapshot (captured at generation start).
   */
  const updateMessageDirect = useCallback(
    async (chatId: string, messageId: string, messageText: string, messageIndex: number, existingMessages?: string[]): Promise<void> => {
      try {
        if (messageId === "generate-input-area" || !messageId) {
          return;
        }

        const updatedMessages = existingMessages ? [...existingMessages] : [];

        if (updatedMessages.length <= messageIndex) {
          while (updatedMessages.length < messageIndex) {
            updatedMessages.push("");
          }
          updatedMessages.push(messageText);
        } else {
          updatedMessages[messageIndex] = messageText;
        }

        await apiUpdateChatMessage(messageId, {
          messages: updatedMessages,
          message_index: messageIndex,
        });

        if (chatId === getCurrentChatId()) {
          fetchChatMessages().catch(() => {});
        }
      } catch (err) {
        console.error("Failed to update character message (direct):", err);
      }
    },
    [fetchChatMessages],
  );

  const batchUpdateMessages = useCallback(
    async (
      updates: Array<{
        messageId: string;
        messageText: string;
        messageIndex?: number;
      }>,
    ): Promise<void> => {
      try {
        const updatePromises = updates.map(({ messageId, messageText, messageIndex = 0 }) => updateMessageById(messageId, messageText, messageIndex));
        await Promise.all(updatePromises);
      } catch (err) {
        console.error("Failed to batch update messages:", err);
      }
    },
    [updateMessageById],
  );

  const createUserMessage = useCallback(
    async (userMessage: string): Promise<ChatMessage> => {
      return addChatMessage({
        character_id: null,
        type: "user" as ChatMessageType,
        messages: [userMessage],
        extra: {},
      });
    },
    [addChatMessage],
  );

  const createCharacterMessage = useCallback(
    async (characterId: string): Promise<ChatMessage> => {
      return addChatMessage({
        character_id: characterId,
        type: "character" as ChatMessageType,
        messages: ["..."],
        extra: {},
      });
    },
    [addChatMessage],
  );

  const setMessageLoading = useCallback(
    async (messageId: string, messageIndex = 0): Promise<void> => {
      const existingMessage = messageMap.get(messageId);
      if (existingMessage) {
        const updatedMessages = [...existingMessage.messages];
        updatedMessages[messageIndex] = "...";

        await updateChatMessage(messageId, {
          messages: updatedMessages,
          message_index: messageIndex,
        });
      }
    },
    [messageMap, updateChatMessage],
  );

  const messageExists = useCallback(
    (messageId: string): boolean => {
      return messageMap.has(messageId);
    },
    [messageMap],
  );

  const getMessageById = useCallback(
    (messageId: string): ChatMessage | undefined => {
      return messageMap.get(messageId);
    },
    [messageMap],
  );

  return {
    updateMessageById,
    updateMessageDirect,
    batchUpdateMessages,
    createUserMessage,
    createCharacterMessage,
    setMessageLoading,
    messageExists,
    getMessageById,
  };
}
