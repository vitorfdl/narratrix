import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/ProfileContext";
import {
  useChatActions,
  useCurrentChatActiveChapterID,
  useCurrentChatId,
  useCurrentChatMessages,
  useCurrentChatTemplateID,
  useCurrentChatUserCharacterID,
} from "@/hooks/chatStore";
import { useExpressionStore } from "@/hooks/expressionStore";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useChatTemplate } from "@/hooks/chatTemplateStore";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { CharacterUnion } from "@/schema/characters-schema";
import { ChatMessage } from "@/schema/chat-message-schema";
import { disableChatMessagesByFilter } from "@/services/chat-message-service";
import { ContextCutDivider, EditControls, MessageActions, StreamingIndicator } from "./message-controls/AdditionalActions";
import { MessageAvatar } from "./message-controls/MessageAvatar";
import { MidMessageLayerControl } from "./message-controls/MidMessageLayerControl";
import { NoMessagePlaceholder } from "./message-controls/NoMessagePlaceholder";
import { ReasoningSection } from "./message-controls/ReasoningCollapsible";
import { SummarySettings } from "./message-controls/SummaryDialog";
import { VersionControls } from "./message-controls/VersionButtons";

const WidgetMessages: React.FC = () => {
  const inferenceService = useInferenceServiceFromContext();
  const { currentProfileAvatarUrl, currentProfile } = useProfile();

  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const currentChatId = useCurrentChatId();
  const currentChatActiveChapterID = useCurrentChatActiveChapterID();
  const characters = useCharacters();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();
  const messages = useCurrentChatMessages();
  const { updateChatMessage, deleteChatMessage, addChatMessage } = useChatActions();
  const setSelectedText = useExpressionStore((state) => state.setSelectedText);

  const [isEditingID, setIsEditingID] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [messageReasonings, setMessageReasonings] = useState<Record<string, string>>({});
  const streamingCheckRef = useRef<number | null>(null);

  // Refs for scroll management
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const chatTemplateId = useCurrentChatTemplateID();
  const chatTemplate = useChatTemplate(chatTemplateId || "");

  // Ref for selection debounce timer
  const selectionTimeoutRef = useRef<number | null>(null);

  // Calculate total characters up to each message
  const messagesWithCharCount = messages.map((msg, index) => {
    const previousChars = messages.slice(0, index).reduce((acc, m) => acc + m.messages.join("").length, 0);
    return {
      ...msg,
      totalChars: previousChars + msg.messages.join("").length,
    };
  });

  // Find where to show the context cut line
  const contextCutIndex = messagesWithCharCount.findIndex((msg) => {
    return chatTemplate?.config.max_context ? msg.totalChars / 3 > chatTemplate.config.max_context - chatTemplate.config.max_tokens : false;
  });

  const handleSwipe = (messageId: string, direction: "left" | "right") => {
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
  };

  const getCurrentContent = (message: ChatMessage) => {
    return message.messages[message.message_index] || "...";
  };

  const getAvatarForMessage = (message: ChatMessage): string | null => {
    if (message.type === "user") {
      // Use the user's avatar unless they've selected a character
      if (currentChatUserCharacterID) {
        const userCharacter = characters.find((c: CharacterUnion) => c.id === currentChatUserCharacterID);
        return avatarUrlMap[userCharacter?.id || ""] || currentProfileAvatarUrl;
      }
      return avatarUrlMap[currentChatUserCharacterID || ""] || currentProfileAvatarUrl;
    }

    if (message.type === "character" && message.character_id) {
      // Get the character's avatar from character list
      const character = characters.find((c: CharacterUnion) => c.id === message.character_id);
      return avatarUrlMap[character?.id || ""] || null;
    }

    return null;
  };

  const handleCancelEdit = () => {
    setIsEditingID(null);
    setEditedContent("");
  };

  // Add a useEffect to handle focusing the editor after the editing state is updated
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

  const handleSaveEdit = async (messageId: string) => {
    if (editedContent.trim()) {
      await onEditMessage(messageId);
      setIsEditingID(null);
      setEditedContent("");
    }
  };

  const onEditMessage = async (messageId: string) => {
    try {
      const message = messages.find((m) => m.id === messageId);
      if (!message) {
        return;
      }

      const updatedMessages = [...message.messages];
      updatedMessages[message.message_index] = editedContent;

      await updateChatMessage(messageId, {
        messages: updatedMessages,
      });
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
  };

  const onDeleteMessage = async (messageId: string) => {
    try {
      await deleteChatMessage(messageId);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

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
      // Clear streaming message ID if there was an error
      setStreamingMessageId(null);
    }
  };

  const onExcludeFromPrompt = async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) {
      return;
    }

    try {
      await updateChatMessage(messageId, { disabled: !message.disabled });
      toast.success("Message excluded from future context");
    } catch (error) {
      console.error("Failed to exclude message:", error);
      toast.error("Failed to exclude message from context");
    }
  };

  const onCreateCheckpoint = (messageId: string) => {
    // TODO: Implement create checkpoint when Chapters are implemented
    console.log("Create checkpoint", messageId);
  };

  const onGenerateImage = (messageId: string) => {
    // TODO: Implement generate image when Image Models are implemented
    console.log("Generate image", messageId);
  };

  const onTranslate = (messageId: string) => {
    // TODO: Implement translate when Google Integration is implemented
    console.log("Translate", messageId);
  };

  // Sync streaming state with the inference service and capture reasoning
  const syncStreamingState = useCallback(() => {
    const streamingState = inferenceService.getStreamingState();

    if (streamingState.messageId) {
      setStreamingMessageId(streamingState.messageId as string);

      if (streamingState.accumulatedReasoning && streamingState.accumulatedReasoning.trim() !== "") {
        setMessageReasonings((prev) => ({
          ...prev,
          [streamingState.messageId as string]: streamingState.accumulatedReasoning,
        }));
      }
    } else if (streamingMessageId) {
      // Check if the message that was streaming is still in progress
      const message = messages.find((m) => m.id === streamingMessageId);
      if (!message || message.messages[0] !== "...") {
        // If the message no longer has a placeholder, it's done streaming
        setStreamingMessageId(null);
      }
    }
  }, [inferenceService, messages, streamingMessageId]);

  // Check if a message has reasoning data
  const hasReasoning = (messageId: string) => {
    return !!messageReasonings[messageId];
  };

  // Update streaming state when messages change
  useEffect(() => {
    // Initial sync when messages change
    syncStreamingState();

    // Set up interval to periodically check streaming state
    if (streamingCheckRef.current) {
      window.clearInterval(streamingCheckRef.current);
    }

    streamingCheckRef.current = window.setInterval(() => {
      syncStreamingState();
    }, 500);

    return () => {
      if (streamingCheckRef.current) {
        window.clearInterval(streamingCheckRef.current);
        streamingCheckRef.current = null;
      }
    };
  }, [messages, syncStreamingState]);

  // Handle scroll events to detect when user manually scrolls up
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // If we're more than 100px from the bottom, consider it a manual scroll
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
      setUserScrolled(isScrolledUp);
      setShowScrollButton(isScrolledUp);
    }
  }, []);

  // Scroll to the bottom of the messages
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    if (behavior === "auto") {
      // Reset user scroll state when we force scroll
      setUserScrolled(false);
      setShowScrollButton(false);
    }
  }, []);

  useEffect(() => {
    if (!userScrolled) {
      scrollToBottom();
    }
  }, [messages, streamingMessageId, userScrolled, scrollToBottom]);

  // Initial scroll to the bottom when component mounts
  useEffect(() => {
    // Use 'auto' for the initial scroll to avoid animation on page load
    scrollToBottom("auto");
  }, [scrollToBottom]);

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
      }, 300); // 300ms delay
    },
    [setSelectedText],
  );

  // New methods for mid-message layer actions
  const handleMergeMessages = (messageIdBefore: string, messageIdAfter: string) => {
    // Placeholder for the merge functionality
    console.log("Merge messages", messageIdBefore, messageIdAfter);
    toast.info("Merge functionality will be implemented soon");
  };

  const handleSummarizeMessages = (messageBefore: string, settings: SummarySettings) => {
    // Find the message with the given ID to get its position
    const targetMessage = messagesWithCharCount.find((m) => m.id === messageBefore);
    if (!targetMessage) {
      toast.error("Message not found");
      return;
    }

    // Find the last system message with summary script if any
    const lastSummaryIndex = messagesWithCharCount.findIndex(
      (msg) => msg.type === "system" && msg.extra?.script === "summary" && msg.position <= targetMessage.position,
    );

    // Determine the start position (either after the last summary or from the beginning)
    const startIndex = lastSummaryIndex !== -1 ? lastSummaryIndex + 1 : 0;
    const targetIndex = messagesWithCharCount.findIndex((m) => m.id === messageBefore);
    if (targetIndex <= startIndex) {
      toast.error("Cannot summarize. Target message must be after the selected range start.");
      return;
    }

    // Get all messages that need to be summarized
    const messagesToSummarize = messagesWithCharCount.slice(startIndex, targetIndex + 1);
    if (messagesToSummarize.length === 0) {
      toast.error("No messages to summarize");
      return;
    }

    // Create the summarization request
    const createSummary = async () => {
      try {
        await disableChatMessagesByFilter({
          chat_id: currentChatId,
          chapter_id: currentChatActiveChapterID!,
          position_lte: targetMessage.position,
          not_type: "system",
        });

        // Create a new system message for the summary
        const summaryMessage = await addChatMessage({
          character_id: null,
          type: "system",
          messages: ["Generating summary..."],
          position: targetMessage.position + 1,
          extra: {
            script: "summary",
            startPosition: startIndex,
            endPosition: targetMessage.position,
          },
        });

        // Generate a summary using the inference service
        try {
          // Start inference to generate the summary
          await inferenceService.generateMessage({
            existingMessageId: summaryMessage.id,
            messageIndex: 0,
            userMessage: settings.requestPrompt,
            chatTemplateID: settings.chatTemplateID || undefined,
            characterId: currentChatUserCharacterID || "",
            systemPromptOverride: settings.systemPrompt || undefined,
            quietUserMessage: true,
            extraSuggestions: {},
          });

          toast.success("Summary generated successfully");
        } catch (error) {
          console.error("Error generating summary:", error);
          toast.error("Failed to generate summary");

          // Update the summary message to show the error
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
  };

  const renderMessage = (message: ChatMessage & { totalChars: number }, index: number, isContextCut: boolean) => {
    const avatarPath = getAvatarForMessage(message);
    const isStreaming = streamingMessageId === message.id;
    const isLastMessage = index === messagesWithCharCount.length - 1 || message.type === "system";
    const hasReasoningData = hasReasoning(message.id);
    const isDisabled = !!message.disabled;

    return (
      <div key={message.id}>
        {isContextCut && <ContextCutDivider />}

        <div
          data-message-id={message.id}
          className={cn(
            "group relative flex gap-4 p-4 rounded-lg border-b-2 border-secondary hover:shadow-md",
            // Apply base card background unless disabled
            !isDisabled && (message.type === "user" || message.type === "character") && "bg-card",
            message.type === "user" && "flex-row-reverse",
            message.type === "system" && "bg-muted mx-5 @md:mx-10 @lg:mx-40",
            isStreaming && "border-primary border-b-2 animate-pulse transition-all",
            // Add styles for disabled messages
            isDisabled && "border-dashed border-muted-foreground opacity-60 bg-chart-5/20",
          )}
        >
          {/* Avatar section */}
          {(message.type === "user" || message.type === "character") && (
            <MessageAvatar avatarPath={avatarPath || "/avatars/default.jpg"} messageType={message.type} isStreaming={isStreaming} />
          )}

          {/* Message content */}
          <div
            onMouseUp={() => handleMessageSelection(message.character_id || undefined)}
            className={cn("flex-grow relative pb-6 text-justify", message.type === "user" && isEditingID !== message.id && "flex justify-end")}
          >
            {isStreaming && <StreamingIndicator />}

            {/* Reasoning section if available */}
            {hasReasoningData && message.type === "character" && <ReasoningSection content={messageReasonings[message.id]} />}
            {message.extra?.script && (
              <div className="flex justify-center items-center mb-2">
                <div className="px-3 py-1 text-xs font-semibold font-mono rounded-full bg-primary/20 text-primary-foreground border border-primary/30 uppercase tracking-wider shadow-sm">
                  {message.extra.script}
                </div>
              </div>
            )}
            <MarkdownTextArea
              autofocus={isEditingID === message.id}
              initialValue={getCurrentContent(message)}
              editable={isEditingID === message.id && !isStreaming}
              placeholder="Edit message..."
              className={cn(
                "select-text text-sm text-white text-sans",
                isEditingID !== message.id ? "bg-transparent border-none" : "text-left ring-1 ring-border rounded-lg h-auto",
                isStreaming && "animate-pulse duration-500",
              )}
              onChange={(newContent) => {
                if (isEditingID === message.id) {
                  setEditedContent(newContent);
                }
              }}
            />

            {/* Bottom controls container */}
            <div className="absolute bottom-0 w-full flex justify-between items-center translate-y-3">
              {isEditingID === message.id ? (
                <EditControls onCancel={handleCancelEdit} onSave={() => handleSaveEdit(message.id)} />
              ) : (
                <>
                  <div className="flex justify-start">
                    {message.type === "character" && (
                      <VersionControls
                        messageId={message.id}
                        messageType={message.type}
                        currentIndex={message.message_index}
                        totalVersions={message.messages.length}
                        onSwipe={handleSwipe}
                        isLastMessage={isLastMessage}
                        isStreaming={isStreaming}
                      />
                    )}
                  </div>
                  <div className="flex justify-end">
                    <MessageActions
                      messageId={message.id}
                      messageType={message.type}
                      isDisabled={isDisabled}
                      isStreaming={isStreaming}
                      onEdit={setIsEditingID}
                      onRegenerateMessage={onRegenerateMessage}
                      onDeleteMessage={onDeleteMessage}
                      onTranslate={onTranslate}
                      onCreateCheckpoint={onCreateCheckpoint}
                      onGenerateImage={onGenerateImage}
                      onExcludeFromPrompt={onExcludeFromPrompt}
                      isLastMessage={isLastMessage}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (messagesWithCharCount.length === 0) {
    return <NoMessagePlaceholder currentProfile={currentProfile} />;
  }

  console.log("messageList Re-render");

  return (
    <div className="relative flex flex-col h-full @container">
      <div ref={messagesContainerRef} className="messages-container flex flex-col gap-2 p-1 overflow-y-auto h-full" onScroll={handleScroll}>
        {messagesWithCharCount.map((message, index) => {
          const isContextCut = index === contextCutIndex;

          return (
            <div key={`message-wrapper-${message.id}`} className="message-group relative group/message transition-all">
              {/* Add MidMessageLayerControl before each message except the first */}
              {index > 0 && !message.disabled && !messagesWithCharCount[index - 1].disabled && (
                <MidMessageLayerControl
                  messageBefore={messagesWithCharCount[index - 1]}
                  messageAfter={message}
                  onMerge={() => handleMergeMessages(messagesWithCharCount[index - 1].id, message.id)}
                  onSummarize={(messageBefore, settings) => handleSummarizeMessages(messageBefore, settings)}
                />
              )}

              {renderMessage(message, index, isContextCut)}
            </div>
          );
        })}
        {/* This empty div is our scroll target */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full shadow-md bg-background z-10 opacity-80 hover:opacity-100"
          onClick={() => scrollToBottom()}
          title="Scroll to latest messages"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default WidgetMessages;
