import { useCallback, useEffect, useRef, useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatActiveChapterID, useCurrentChatId, useCurrentChatMessages, useCurrentChatParticipants, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useExpressionStore } from "@/hooks/expressionStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useInferenceServiceFromContext } from "@/hooks/useChatInference";
import { useImageUrl } from "@/hooks/useImageUrl";
import { chatEventBus } from "@/services/chat-event-bus";
import type { ChatMessage } from "@/services/chat-message-service";
import { updateChatMessagesUsingFilter } from "@/services/chat-message-service";
import MessageItem from "./message-controls/MessageItem";
import MidMessageLayerWrapper from "./message-controls/MidMessageLayerWrapper";
import { NoMessagePlaceholder } from "./message-controls/NoMessagePlaceholder";
import type { SummarySettings } from "./message-controls/SummaryDialog";

const MESSAGE_CONTAINER_STYLES = "relative flex flex-col h-full @container";
const MESSAGE_GROUP_STYLES = "message-group relative group/message";
const SCROLL_BUTTON_STYLES = "absolute bottom-4 right-4 rounded-full shadow-md bg-background z-10 opacity-80 hover:opacity-100";

// In column-reverse, scrollTop ~0 means the user is at the visual bottom
const AT_BOTTOM_THRESHOLD = 30;

const WidgetMessages: React.FC = () => {
  const inferenceService = useInferenceServiceFromContext();

  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const currentChatId = useCurrentChatId();
  const currentChatActiveChapterID = useCurrentChatActiveChapterID();
  const messages = useCurrentChatMessages();
  const { updateChatMessage, addChatMessage, fetchChatMessages, deleteChatMessage } = useChatActions();
  const setSelectedText = useExpressionStore((state) => state.setSelectedText);
  const currentChatParticipants = useCurrentChatParticipants();

  // Lifted from MessageItem -- computed once for all messages
  const characters = useCharacters();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();
  const currentProfile = useCurrentProfile();
  const { url: currentProfileAvatarUrl } = useImageUrl(currentProfile?.avatar_path);
  const showAvatars = currentProfile?.settings?.chat?.showAvatars ?? true;

  const [isEditingID, setIsEditingID] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [messageReasonings, setMessageReasonings] = useState<Record<string, string>>({});
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectionTimeoutRef = useRef<number | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

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
    [editedContent, onEditMessage],
  );

  const onRegenerateMessage = useCallback(
    async (messageId: string, targetIndex?: number) => {
      try {
        setStreamingMessageId(messageId);

        const message = messages.find((m) => m.id === messageId);
        if (!message || message.type !== "character" || !message.character_id) {
          setStreamingMessageId(null);
          return;
        }

        const character = characters.find((c) => c.id === message.character_id);
        if (!character) {
          console.error("Character not found");
          setStreamingMessageId(null);
          return;
        }

        if (messageReasonings[messageId]) {
          setMessageReasonings((prev) => {
            const newReasonings = { ...prev };
            delete newReasonings[messageId];
            return newReasonings;
          });
        }

        // Emit before_participant_message so agents with "before_character_message" / "before_any_message"
        // triggers can react to the regeneration. The trigger manager handles execution.
        chatEventBus.emit({
          type: "before_participant_message",
          chatId: currentChatId,
          participantId: message.character_id,
        });

        await inferenceService.regenerateMessage(messageId, {
          chatId: currentChatId,
          characterId: message.character_id,
          messageIndex: targetIndex !== undefined ? targetIndex : message.message_index,
          onStreamingStateChange: (state) => {
            if (!state) {
              setStreamingMessageId(null);
            }
          },
        });
        // after_participant_message is emitted by inference-service.ts onComplete (emitChatEvents defaults to true for regenerate)
      } catch (error) {
        console.error("Failed to regenerate message:", error);
        toast.error(error instanceof Error ? error.message : "An unknown error occurred");
        setStreamingMessageId(null);
      }
    },
    [messages, characters, messageReasonings, inferenceService, currentChatId],
  );

  const handleSwipe = useCallback(
    (messageId: string, direction: "left" | "right") => {
      if (streamingMessageId) {
        return;
      }

      const message = messages.find((m) => m.id === messageId);
      if (!message) {
        return;
      }

      const currentIndex = message.message_index;
      const newIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;

      if (newIndex >= message.messages.length && direction === "right") {
        setTimeout(() => {
          onRegenerateMessage(messageId, newIndex);
        }, 0);
        return;
      }

      const clampedIndex = Math.max(0, Math.min(newIndex, message.messages.length - 1));

      if (clampedIndex !== currentIndex) {
        updateChatMessage(messageId, {
          message_index: clampedIndex,
        });
      }
    },
    [messages, streamingMessageId, updateChatMessage, onRegenerateMessage],
  );

  useEffect(() => {
    const currentState = inferenceService.getStreamingState(currentChatId);
    const initialId = currentState.messageId || null;
    setStreamingMessageId(initialId);
    streamingMessageIdRef.current = initialId;

    const unsubscribe = inferenceService.subscribeToStateChanges((streamingState) => {
      if (streamingState.messageId) {
        setStreamingMessageId(streamingState.messageId as string);
        streamingMessageIdRef.current = streamingState.messageId as string;

        if (streamingState.accumulatedReasoning && streamingState.accumulatedReasoning.trim() !== "") {
          setMessageReasonings((prev) => ({
            ...prev,
            [streamingState.messageId as string]: streamingState.accumulatedReasoning,
          }));
        }
      } else if (streamingMessageIdRef.current) {
        setStreamingMessageId(null);
        streamingMessageIdRef.current = null;
      }
    }, currentChatId);

    return unsubscribe;
  }, [inferenceService, currentChatId]);

  const handleMessageSelection = useCallback(
    (characterId: string | undefined) => {
      if (selectionTimeoutRef.current) {
        window.clearTimeout(selectionTimeoutRef.current);
      }

      selectionTimeoutRef.current = window.setTimeout(() => {
        const selection = window.getSelection();
        if (selection?.toString().trim()) {
          setSelectedText(selection.toString().trim(), characterId || null);
        }
      }, 400);
    },
    [setSelectedText],
  );

  const handleSummarizeMessages = useCallback(
    async (messageBefore: string, settings: SummarySettings) => {
      const messageUpdatedList = await fetchChatMessages();
      const targetIndex = messageUpdatedList.findIndex((m) => m.id === messageBefore);
      if (targetIndex === -1) {
        toast.error("Message not found");
        return;
      }
      const targetMessage = messageUpdatedList[targetIndex];

      const lastSummaryIndex = structuredClone(messageUpdatedList).findIndex((msg) => msg.type === "system" && msg.extra?.script === "summary" && msg.position <= targetMessage.position);

      const startIndex = lastSummaryIndex !== -1 ? lastSummaryIndex + 1 : 0;
      if (targetIndex <= startIndex) {
        toast.error("Cannot summarize. Target message must be after the selected range start.");
        return;
      }

      const messagesToSummarize = messageUpdatedList.slice(startIndex, targetIndex + 1);
      if (messagesToSummarize.length === 0) {
        toast.error("No messages to summarize");
        return;
      }

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

          const summaryMessage = await addChatMessage({
            character_id: nextCharacterID || "",
            type: "system",
            messages: ["Generating summary..."],
            position: targetMessage.position + 1,
            extra,
          });

          try {
            await inferenceService.generateMessage({
              chatId: currentChatId,
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

            await updateChatMessage(summaryMessage.id, {
              messages: ["Failed to generate summary. Please try again."],
            });
          }
        } catch (error) {
          console.error("Error creating summary:", error);
          toast.error("Failed to create summary");
        }
      };

      createSummary();
    },
    [currentChatId, currentChatActiveChapterID, addChatMessage, updateChatMessage, inferenceService, currentChatUserCharacterID, currentChatParticipants, fetchChatMessages],
  );

  useEffect(() => {
    if (isEditingID) {
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
      }, 50);
    }
  }, [isEditingID]);

  // Reset scroll to bottom (scrollTop=0 in column-reverse) when switching chats.
  // currentChatId is read here so the linter correctly identifies it as a dependency.
  useEffect(() => {
    if (!currentChatId) {
      return;
    }
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = 0;
    }
    setIsAtBottom(true);
  }, [currentChatId]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const atBottom = Math.abs(el.scrollTop) <= AT_BOTTOM_THRESHOLD;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  if (messages.length === 0) {
    return <NoMessagePlaceholder />;
  }

  return (
    <div className={MESSAGE_CONTAINER_STYLES}>
      <div ref={scrollContainerRef} className="messages-container flex flex-col-reverse overflow-y-auto overflow-x-hidden h-full p-1" onScroll={handleScroll}>
        <div className="flex flex-col">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1 || message.type === "system";
            const isStreaming = streamingMessageId === message.id;
            const hasReasoningData = !!messageReasonings[message.id];
            const reasoningContent = messageReasonings[message.id] || "";
            const showMidLayer = index > 0 && !message.disabled && messages[index - 1] && !messages[index - 1].disabled;
            const isEditing = isEditingID === message.id;

            let avatarPath: string | null = null;
            if (message.type === "user") {
              if (currentChatUserCharacterID) {
                const userCharacter = characters.find((c) => c.id === currentChatUserCharacterID);
                avatarPath = avatarUrlMap[userCharacter?.id || ""] || currentProfileAvatarUrl || null;
              } else {
                avatarPath = currentProfileAvatarUrl || null;
              }
            } else if (message.type === "character" && message.character_id) {
              const character = characters.find((c) => c.id === message.character_id);
              avatarPath = avatarUrlMap[character?.id || ""] || null;
            }

            return (
              <div key={message.id}>
                {showMidLayer && <MidMessageLayerWrapper messageBefore={messages[index - 1]} messageAfter={message} onSummarize={handleSummarizeMessages} />}

                <div className={MESSAGE_GROUP_STYLES} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}>
                  <MessageItem
                    message={message}
                    index={index}
                    isContextCut={false}
                    isLastMessage={isLastMessage}
                    isStreaming={isStreaming}
                    hasReasoningData={hasReasoningData}
                    reasoningContent={reasoningContent}
                    isEditing={isEditing}
                    editedContent={editedContent}
                    avatarPath={avatarPath}
                    showAvatar={showAvatars}
                    setEditedContent={setEditedContent}
                    handleCancelEdit={handleCancelEdit}
                    handleSaveEdit={handleSaveEdit}
                    handleSwipe={handleSwipe}
                    handleMessageSelection={handleMessageSelection}
                    onRegenerateMessage={onRegenerateMessage}
                    setIsEditingID={setIsEditingID}
                    updateChatMessage={updateChatMessage}
                    deleteChatMessage={deleteChatMessage}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!isAtBottom && (
        <Button variant="outline" size="icon" className={SCROLL_BUTTON_STYLES} onClick={scrollToBottom} title="Scroll to latest messages">
          <LuChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default WidgetMessages;
