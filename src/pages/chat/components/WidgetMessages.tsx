import { Button } from "@/components/ui/button";
import {
  useChatActions,
  useCurrentChatActiveChapterID,
  useCurrentChatId,
  useCurrentChatMessages,
  useCurrentChatParticipants,
  useCurrentChatUserCharacterID,
} from "@/hooks/chatStore";
import { useExpressionStore } from "@/hooks/expressionStore";
import { ChevronDown } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStickToBottom } from "use-stick-to-bottom";

import { useCharacters } from "@/hooks/characterStore";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { ChatMessage, updateChatMessagesUsingFilter } from "@/services/chat-message-service";
import MessageItem from "./message-controls/MessageItem";
import MidMessageLayerWrapper from "./message-controls/MidMessageLayerWrapper";
import { NoMessagePlaceholder } from "./message-controls/NoMessagePlaceholder";
import { SummarySettings } from "./message-controls/SummaryDialog";

// Message pagination constants - inspired by NextChat
const CHAT_PAGE_SIZE = 15; // Number of messages per page
const MIN_RENDER_MESSAGES = 30; // Minimum messages to keep rendered

// Scroll behavior constants
const TOP_EDGE_THRESHOLD = 50; // Distance from top to trigger loading more messages

// Message container styles
const MESSAGE_CONTAINER_STYLES = "relative flex flex-col h-full @container";
const MESSAGES_LIST_STYLES = "messages-container flex flex-col gap-2 p-1 overflow-y-auto h-full";
const MESSAGE_GROUP_STYLES = "message-group relative group/message transition-all";
const SCROLL_BUTTON_STYLES = "absolute bottom-4 right-4 rounded-full shadow-md bg-background z-10 opacity-80 hover:opacity-100";

const WidgetMessages: React.FC = () => {
  const inferenceService = useInferenceServiceFromContext();

  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const currentChatId = useCurrentChatId();
  const currentChatActiveChapterID = useCurrentChatActiveChapterID();
  const characters = useCharacters();
  const messages = useCurrentChatMessages();
  const { updateChatMessage, addChatMessage, fetchChatMessages } = useChatActions();
  const setSelectedText = useExpressionStore((state) => state.setSelectedText);
  const currentChatParticipants = useCurrentChatParticipants();

  const [isEditingID, setIsEditingID] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [messageReasonings, setMessageReasonings] = useState<Record<string, string>>({});
  const [streamingTimestamp, setStreamingTimestamp] = useState<number>(0); // Track streaming updates

  // Message pagination state - NextChat style
  const [renderMessages, setRenderMessages] = useState(messages.slice(-MIN_RENDER_MESSAGES));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollLockRef = useRef(false);

  // Auto-scroll hook for smooth chat behavior
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom();

  // Ref for selection debounce timer
  const selectionTimeoutRef = useRef<number | null>(null);

  const handleCancelEdit = useCallback(() => {
    setIsEditingID(null);
    setEditedContent("");
  }, []);

  const onEditMessage = useCallback(
    async (messageId: string) => {
      try {
        const message = messages.find((m) => m.id === messageId);
        if (!message) {
          return;
        }

        // Make sure editedContent is not empty
        if (!editedContent.trim()) {
          toast.error("Message cannot be empty");
          return;
        }

        const updatedMessages = [...message.messages];
        updatedMessages[message.message_index] = editedContent;

        await updateChatMessage(messageId, {
          messages: updatedMessages,
        });
      } catch (error) {
        console.error("Failed to edit message:", error);
        toast.error("Failed to update message");
      }
    },
    [messages, editedContent, updateChatMessage],
  );

  const handleSaveEdit = useCallback(
    async (messageId: string) => {
      if (editedContent.trim()) {
        await onEditMessage(messageId);
        setIsEditingID(null);
        setEditedContent("");
      } else {
        toast.error("Message cannot be empty");
      }
    },
    // Include all dependencies that this function uses
    [editedContent, setIsEditingID, setEditedContent, onEditMessage],
  );

  const onRegenerateMessage = async (messageId: string, targetIndex?: number) => {
    try {
      // Mark this message as streaming immediately
      setStreamingMessageId(messageId);

      // Find the message to regenerate
      const message = messages.find((m) => m.id === messageId);
      if (!message || message.type !== "character" || !message.character_id) {
        setStreamingMessageId(null); // Clear if invalid
        return;
      }

      // Get the character settings
      const character = characters.find((c) => c.id === message.character_id);
      if (!character) {
        console.error("Character not found");
        setStreamingMessageId(null); // Clear if character not found
        return;
      }

      // Clear any existing reasoning for this message when regenerating
      if (messageReasonings[messageId]) {
        setMessageReasonings((prev) => {
          const newReasonings = { ...prev };
          delete newReasonings[messageId];
          return newReasonings;
        });
      }

      // Use the inference service to regenerate the message
      await inferenceService.regenerateMessage(messageId, {
        characterId: message.character_id,
        messageIndex: targetIndex !== undefined ? targetIndex : message.message_index,
        onStreamingStateChange: (state) => {
          // When streaming stops or errors out, clear the streaming message ID
          if (!state) {
            setStreamingMessageId(null);
          }
        },
      });
    } catch (error) {
      console.error("Failed to regenerate message:", error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred");
      // Clear streaming message ID if there was an error
      setStreamingMessageId(null);
    }
  };

  const handleSwipe = useCallback(
    (messageId: string, direction: "left" | "right") => {
      // If already streaming, don't allow swipes
      if (streamingMessageId) {
        return;
      }

      const message = messages.find((m) => m.id === messageId);
      if (!message) {
        return;
      }

      const currentIndex = message.message_index;
      const newIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;

      // If we're trying to access an index that doesn't exist yet (only possible when swiping right)
      if (newIndex >= message.messages.length && direction === "right") {
        // Schedule regeneration for the next render cycle
        setTimeout(() => {
          onRegenerateMessage(messageId, newIndex);
        }, 0);
        return;
      }

      const clampedIndex = Math.max(0, Math.min(newIndex, message.messages.length - 1));

      // Only update if the index changed
      if (clampedIndex !== currentIndex) {
        updateChatMessage(messageId, {
          message_index: clampedIndex,
        });
      }
    },
    [messages, streamingMessageId, updateChatMessage, onRegenerateMessage],
  );

  // Subscribe to streaming state changes
  useEffect(() => {
    const unsubscribe = inferenceService.subscribeToStateChanges((streamingState) => {
      if (streamingState.messageId) {
        // If we have a message ID in the streaming state
        setStreamingMessageId(streamingState.messageId as string);

        // If there's new accumulated reasoning, update the reasonings state
        if (streamingState.accumulatedReasoning && streamingState.accumulatedReasoning.trim() !== "") {
          setMessageReasonings((prev) => ({
            ...prev,
            [streamingState.messageId as string]: streamingState.accumulatedReasoning,
          }));
        }

        // Update timestamp to trigger re-renders during streaming
        if (streamingState.accumulatedText !== "") {
          setStreamingTimestamp(Date.now());
        }
      } else if (streamingMessageId) {
        setStreamingMessageId(null);
      }
    });

    return unsubscribe;
  }, [inferenceService, streamingMessageId]);

  // Handle scroll events for message pagination
  const onChatScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const { scrollTop } = container;
    const isTouchTopEdge = scrollTop <= TOP_EDGE_THRESHOLD;
    const currentMessageCount = renderMessages.length;
    const allMessageCount = messages.length;
    const hasMoreMessages = currentMessageCount < allMessageCount;

    if (isTouchTopEdge && !isLoadingMore && hasMoreMessages && !scrollLockRef.current) {
      setIsLoadingMore(true);
      scrollLockRef.current = true;

      // Calculate how many more messages to load
      const numberToLoad = Math.min(CHAT_PAGE_SIZE, allMessageCount - currentMessageCount);
      const newStartIndex = allMessageCount - currentMessageCount - numberToLoad;
      const newMessages = messages.slice(Math.max(0, newStartIndex), allMessageCount - currentMessageCount);

      // Store current scroll height before adding messages
      const prevScrollHeight = container.scrollHeight;

      // Add new messages to the beginning
      setRenderMessages((prev) => [...newMessages, ...prev]);

      // Restore scroll position after DOM update
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight;
          const scrollDiff = newScrollHeight - prevScrollHeight;
          container.scrollTop = scrollTop + scrollDiff;

          setIsLoadingMore(false);
          scrollLockRef.current = false;
        });
      });
    }
  }, [scrollRef, renderMessages.length, messages.length, isLoadingMore]);


  // Check if a message has reasoning data
  const hasReasoning = useCallback(
    (messageId: string) => {
      return !!messageReasonings[messageId];
    },
    [messageReasonings],
  );

  // Update render messages when messages change
  useEffect(() => {
    const totalMessages = messages.length;
    const currentRendered = renderMessages.length;

    // If we're showing recent messages and new messages arrive
    if (isAtBottom || currentRendered === 0) {
      setRenderMessages(messages.slice(-MIN_RENDER_MESSAGES));
      // Let use-stick-to-bottom handle auto-scroll behavior
    } else {
      // Preserve the view when messages update but we're not at bottom
      const oldestRenderedId = renderMessages[0]?.id;
      if (oldestRenderedId) {
        const oldestIndex = messages.findIndex((m) => m.id === oldestRenderedId);
        if (oldestIndex >= 0) {
          // Keep the same messages in view
          const endIndex = Math.min(oldestIndex + currentRendered, totalMessages);
          setRenderMessages(messages.slice(oldestIndex, endIndex));
        }
      }
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // Reset state when chat changes
  useEffect(() => {
    setRenderMessages(messages.slice(-MIN_RENDER_MESSAGES));
    scrollLockRef.current = false;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [currentChatId, scrollToBottom]);

  // Initial scroll to the bottom when component mounts
  useEffect(() => {
    // Immediate scroll first
    scrollToBottom("auto");

    // Safety check for any dynamically loaded content
    const safetyCheck = setTimeout(() => {
      scrollToBottom("auto");
    }, 100);

    return () => clearTimeout(safetyCheck);
  }, [scrollToBottom, currentChatId]);

  // Add selection handler
  const handleMessageSelection = useCallback(
    (characterId: string | undefined) => {
      // Clear any existing timer
      if (selectionTimeoutRef.current) {
        window.clearTimeout(selectionTimeoutRef.current);
      }

      // Start a new timer
      selectionTimeoutRef.current = window.setTimeout(() => {
        const selection = window.getSelection();
        if (selection?.toString().trim()) {
          setSelectedText(selection.toString().trim(), characterId || null);
        }
        // No need for the 'else' part that clears selection,
        // as a simple click without dragging won't trigger this after the delay.
      }, 400); // 300ms delay
    },
    [setSelectedText],
  );

  const handleSummarizeMessages = useCallback(
    async (messageBefore: string, settings: SummarySettings) => {
      const messageUpdatedList = await fetchChatMessages();
      // Find the message with the given ID to get its position
      const targetIndex = messageUpdatedList.findIndex((m) => m.id === messageBefore);
      if (targetIndex === -1) {
        toast.error("Message not found");
        return;
      }
      const targetMessage = messageUpdatedList[targetIndex];

      // Find the last system message with summary script if any
      const lastSummaryIndex = structuredClone(messageUpdatedList).findIndex(
        (msg) => msg.type === "system" && msg.extra?.script === "summary" && msg.position <= targetMessage.position,
      );

      // Determine the start position (either after the last summary or from the beginning)
      const startIndex = lastSummaryIndex !== -1 ? lastSummaryIndex + 1 : 0;
      if (targetIndex <= startIndex) {
        toast.error("Cannot summarize. Target message must be after the selected range start.");
        return;
      }

      // Get all messages that need to be summarized
      const messagesToSummarize = messageUpdatedList.slice(startIndex, targetIndex + 1);
      if (messagesToSummarize.length === 0) {
        toast.error("No messages to summarize");
        return;
      }

      // Create the summarization request
      const createSummary = async () => {
        try {
          await updateChatMessagesUsingFilter(
            {
              chat_id: currentChatId,
              chapter_id: currentChatActiveChapterID!,
              position_lte: targetMessage.position,
              not_type: "system",
            },
            { disabled: true },
          );

          const extra: ChatMessage["extra"] = {
            script: "summary",
            startPosition: messageUpdatedList[startIndex].position,
            endPosition: targetMessage.position,
          };

          const nextCharacterID = currentChatParticipants?.find((p) => p.enabled)?.id || currentChatUserCharacterID;

          // Create a new system message for the summary
          const summaryMessage = await addChatMessage({
            character_id: nextCharacterID || "",
            type: "system",
            messages: ["Generating summary..."],
            position: targetMessage.position + 1,
            extra,
          });

          // Generate a summary using the inference service
          try {
            // Start inference to generate the summary
            await inferenceService.generateMessage({
              existingMessageId: summaryMessage.id,
              messageIndex: 0,
              userMessage: settings.requestPrompt,
              chatTemplateID: settings.chatTemplateID || undefined,
              characterId: nextCharacterID || "",
              systemPromptOverride: settings.systemPrompt || undefined,
              quietUserMessage: true,
              extraSuggestions: {},
              messageHistoryOverride: messagesToSummarize,
            });

            toast.success("Summary generated successfully");
          } catch (error) {
            console.error("Error generating summary:", error);
            toast.error("Failed to generate summary");

            // Update the summary message to show the erro
            await updateChatMessage(summaryMessage.id, {
              messages: ["Failed to generate summary. Please try again."],
            });
          }
        } catch (error) {
          console.error("Error creating summary:", error);
          toast.error("Failed to create summary");
        }
      };

      // Execute the summarization process
      createSummary();
    },
    [messages, currentChatId, currentChatActiveChapterID, addChatMessage, updateChatMessage, inferenceService, currentChatUserCharacterID],
  );

  // Add useEffect to handle editor focus when editing starts
  useEffect(() => {
    if (isEditingID) {
      // Use setTimeout to wait for the DOM to update
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${isEditingID}"]`);
        if (!messageElement) {
          return;
        }
        const editorElement = messageElement.querySelector(".cm-editor");
        if (editorElement) {
          (editorElement as HTMLElement).focus();
          const textArea = editorElement.querySelector(".cm-content");
          if (textArea) {
            const range = document.createRange();
            const sel = window.getSelection();

            // Try to position at the end of this specific message's content
            if (textArea.lastChild) {
              range.setStartAfter(textArea.lastChild);
              range.collapse(true);

              if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }
          }
        }
      }, 50); // Small delay to ensure component has updated
    }
  }, [isEditingID]);

  // Memoize message list rendering to prevent unnecessary recalculations
  // Include the streamingTimestamp in the dependency array to re-render during streaming
  const messageListItems = useMemo(() => {
    return renderMessages
      .map((message, index) => {
        // Find the actual index in the full messages array
        const actualIndex = messages.findIndex((m) => m.id === message.id);
        if (actualIndex === -1) {
          return null; // Skip if message not found
        }

        // Check if message is the last one for UI purposes
        const isLastMessage = actualIndex === messages.length - 1 || message.type === "system";
        // Check if this message is currently streaming
        const isStreaming = streamingMessageId === message.id;
        // Check if this message has reasoning data
        const hasReasoningData = hasReasoning(message.id);
        // Get reasoning content if available
        const reasoningContent = messageReasonings[message.id] || "";

        // Mid-message layer control for messages that aren't first or disabled
        // We need to check against the actual index, not the visible index
        const showMidLayer =
          actualIndex > 0 && !message.disabled && actualIndex > 0 && messages[actualIndex - 1] && !messages[actualIndex - 1].disabled;

        return (
          <div key={`message-wrapper-${message.id}`} className={MESSAGE_GROUP_STYLES}>
            {/* Add MidMessageLayerControl before each message except the first */}
            {showMidLayer && index > 0 && (
              <MidMessageLayerWrapper messageBefore={messages[actualIndex - 1]} messageAfter={message} onSummarize={handleSummarizeMessages} />
            )}

            <MessageItem
              message={message}
              index={actualIndex}
              isContextCut={false}
              isLastMessage={isLastMessage}
              isStreaming={isStreaming}
              hasReasoningData={hasReasoningData}
              reasoningContent={reasoningContent}
              isEditingID={isEditingID}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
              handleCancelEdit={handleCancelEdit}
              handleSaveEdit={handleSaveEdit}
              handleSwipe={handleSwipe}
              handleMessageSelection={handleMessageSelection}
              onRegenerateMessage={onRegenerateMessage}
              setIsEditingID={setIsEditingID}
            />
          </div>
        );
      })
      .filter(Boolean); // Remove any null entries
  }, [
    renderMessages,
    messages,
    streamingMessageId,
    messageReasonings,
    isEditingID,
    editedContent,
    handleCancelEdit,
    handleSaveEdit,
    handleSwipe,
    handleMessageSelection,
    setIsEditingID,
    hasReasoning,
    handleSummarizeMessages,
    streamingTimestamp, // Important! Add this to re-render during streaming
  ]);

  if (messages.length === 0) {
    return <NoMessagePlaceholder />;
  }

  return (
    <div className={MESSAGE_CONTAINER_STYLES}>
      <div ref={scrollRef} className={MESSAGES_LIST_STYLES} onScroll={onChatScroll}>
        <div ref={contentRef}>
          {/* Show loading indicator when loading more messages */}
          {isLoadingMore && (
            <div className="flex justify-center py-2 text-sm text-muted-foreground">
              <div className="bg-muted rounded-lg px-3 py-1 animate-pulse">Loading more messages...</div>
            </div>
          )}

          {/* Show indicator when there are more messages to load */}
          {renderMessages.length < messages.length && !isLoadingMore && (
            <div className="flex justify-center py-2 text-sm text-muted-foreground">
              <div className="bg-muted rounded-lg px-3 py-1">{messages.length - renderMessages.length} earlier messages</div>
            </div>
          )}

          {messageListItems}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <Button variant="outline" size="icon" className={SCROLL_BUTTON_STYLES} onClick={() => scrollToBottom()} title="Scroll to latest messages">
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default WidgetMessages;
