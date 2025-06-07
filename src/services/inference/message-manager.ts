import { useChatActions, useCurrentChatMessages } from "@/hooks/chatStore";
import { ChatMessage, ChatMessageType } from "@/schema/chat-message-schema";
import { useCallback, useMemo } from "react";

/**
 * Hook for managing chat messages during inference
 */
export function useMessageManager() {
  const chatMessages = useCurrentChatMessages();
  const { addChatMessage, updateChatMessage } = useChatActions();

  // Memoize message lookup for better performance
  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    chatMessages?.forEach((msg) => {
      map.set(msg.id, msg);
    });
    return map;
  }, [chatMessages]);

  /**
   * Updates a character message with new text (optimized with message map lookup)
   */
  const updateMessageById = useCallback(
    async (messageId: string, messageText: string, messageIndex = 0): Promise<void> => {
      try {
        if (messageId === "generate-input-area" || !messageId) {
          return;
        }

        // Use memoized message map for faster lookup
        const existingMessage = messageMap.get(messageId);

        // Create a new messages array, preserving existing messages if any
        const updatedMessages = existingMessage?.messages ? [...existingMessage.messages] : [];

        // Update or create the message at the specified index
        if (updatedMessages.length <= messageIndex) {
          // Pad the array with empty strings if the index is beyond the current length
          while (updatedMessages.length < messageIndex) {
            updatedMessages.push("");
          }
          // Add the new message at the end
          updatedMessages.push(messageText);
        } else {
          // Update the existing message at the specified index
          updatedMessages[messageIndex] = messageText;
        }

        // Update the message with the new messages array
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
   * Batch update multiple messages at once for better performance
   */
  const batchUpdateMessages = useCallback(
    async (
      updates: Array<{
        messageId: string;
        messageText: string;
        messageIndex?: number;
      }>,
    ): Promise<void> => {
      try {
        // Process all updates in parallel
        const updatePromises = updates.map(({ messageId, messageText, messageIndex = 0 }) => updateMessageById(messageId, messageText, messageIndex));

        await Promise.all(updatePromises);
      } catch (err) {
        console.error("Failed to batch update messages:", err);
      }
    },
    [updateMessageById],
  );

  /**
   * Create a new user message
   */
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

  /**
   * Create a new character message with placeholder text
   */
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

  /**
   * Update an existing message to show loading state
   */
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

  /**
   * Optimized message existence check
   */
  const messageExists = useCallback(
    (messageId: string): boolean => {
      return messageMap.has(messageId);
    },
    [messageMap],
  );

  /**
   * Get message by ID with memoized lookup
   */
  const getMessageById = useCallback(
    (messageId: string): ChatMessage | undefined => {
      return messageMap.get(messageId);
    },
    [messageMap],
  );

  return {
    updateMessageById,
    batchUpdateMessages,
    createUserMessage,
    createCharacterMessage,
    setMessageLoading,
    messageExists,
    getMessageById,
  };
}
