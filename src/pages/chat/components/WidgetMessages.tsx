import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/ProfileContext";
import { useChatActions, useCurrentChatMessages, useCurrentChatTemplateID, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useExpressionStore } from "@/hooks/expressionStore";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, Scissors, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useChatTemplate } from "@/hooks/chatTemplateStore";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { CharacterUnion } from "@/schema/characters-schema";
import { ChatMessage } from "@/schema/chat-message-schema";
import { MessageActions } from "./message-controls/AdditionalActions";
import { MessageAvatar } from "./message-controls/MessageAvatar";
import { ReasoningSection } from "./message-controls/ReasoningCollapsible";
import { VersionControls } from "./message-controls/VersionButtons";

// Extracted EditControls component
const EditControls = ({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) => (
  <div className="flex gap-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 ml-auto shadow-sm">
    <Button variant="outline" size="sm" onClick={onCancel}>
      <X className="!w-4 !h-4" />
      Cancel
    </Button>
    <Button variant="default" size="sm" onClick={onSave}>
      <Check className="!w-4 !h-4" />
      Save
    </Button>
  </div>
);

// Extracted ContextCutDivider component
const ContextCutDivider = () => (
  <div className="flex items-center justify-center w-full my-4">
    <div className="flex-grow border-t-2 border-dashed border-border" />
    <div className="mx-4 text-muted-foreground flex items-center gap-2">
      <Scissors className="w-4 h-4" />
      Context Cut
    </div>
    <div className="flex-grow border-t-2 border-dashed border-border" />
  </div>
);

// Extracted StreamingIndicator component
const StreamingIndicator = () => (
  <div className="absolute right-0 top-[-1rem] flex items-center gap-2 p-1 bg-background/80 backdrop-blur-sm rounded-md animate-pulse">
    <Loader2 className="w-4 h-4 animate-spin text-primary" />
    <span className="text-xs text-primary font-medium">Thinking...</span>
  </div>
);

const WidgetMessages: React.FC = () => {
  const inferenceService = useInferenceServiceFromContext();
  const { currentProfileAvatarUrl } = useProfile();

  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const characters = useCharacters();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();
  const messages = useCurrentChatMessages();
  const { updateChatMessage, deleteChatMessage } = useChatActions();
  const setSelectedText = useExpressionStore((state) => state.setSelectedText);

  const [isEditingID, setIsEditingID] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [streamingMessages, setStreamingMessages] = useState<Record<string, boolean>>({});
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
      // Find the message to regenerate
      const message = messages.find((m) => m.id === messageId);
      if (!message || message.type !== "character" || !message.character_id) {
        return;
      }

      // Get the character settings
      const character = characters.find((c) => c.id === message.character_id);

      if (!character) {
        console.error("Character not found");
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

      // Mark this message as streaming
      setStreamingMessages((prev) => ({ ...prev, [messageId]: true }));
      console.log("Regenerating message", messageId, targetIndex);
      // Use the inference service to regenerate the message
      await inferenceService.regenerateMessage(messageId, {
        characterId: message.character_id,
        messageIndex: targetIndex !== undefined ? targetIndex : message.message_index,
        onStreamingStateChange: (state) => {
          // When streaming stops or errors out, remove from streaming messages
          if (!state) {
            setStreamingMessages((prev) => {
              const newState = { ...prev };
              delete newState[messageId];
              return newState;
            });
          }
        },
      });
    } catch (error) {
      console.error("Failed to regenerate message:", error);
      // Remove from streaming messages if there was an error
      setStreamingMessages((prev) => {
        const newState = { ...prev };
        delete newState[messageId];
        return newState;
      });
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

  const isMessageStreaming = useCallback(
    (messageId: string) => {
      return !!streamingMessages[messageId];
    },
    [streamingMessages],
  );

  // Sync streaming state with the inference service and capture reasoning
  const syncStreamingState = useCallback(() => {
    const streamingState = inferenceService.getStreamingState();

    if (streamingState.messageId) {
      setStreamingMessages((prev) => {
        if (prev[streamingState.messageId as string]) {
          return prev;
        }
        return {
          ...prev,
          [streamingState.messageId as string]: true,
        };
      });

      if (streamingState.accumulatedReasoning && streamingState.accumulatedReasoning.trim() !== "") {
        setMessageReasonings((prev) => ({
          ...prev,
          [streamingState.messageId as string]: streamingState.accumulatedReasoning,
        }));
      }
    } else {
      // If no message is currently streaming according to the service,
      // but we have tracked streaming messages, we need to check if they're really done
      if (Object.keys(streamingMessages).length > 0) {
        // Create a new empty state - we'll repopulate with only active streaming messages
        const newStreamingState: Record<string, boolean> = {};

        // Keep only messages that are actually still being streamed
        for (const msgId of Object.keys(streamingMessages)) {
          // If the message no longer exists or its content isn't a placeholder,
          // it's probably done streaming
          const message = messages.find((m) => m.id === msgId);
          if (message && message.messages[0] === "...") {
            newStreamingState[msgId] = true;
          }
        }

        // Only update state if something changed
        if (Object.keys(newStreamingState).length !== Object.keys(streamingMessages).length) {
          setStreamingMessages(newStreamingState);
        }
      }
    }
  }, [inferenceService, messages, streamingMessages]);

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

  // Scroll to bottom when new messages are added or streaming state changes
  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled up
    if (!userScrolled) {
      scrollToBottom();
    }
  }, [messages, streamingMessages, userScrolled, scrollToBottom]);

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

  const renderMessage = (message: ChatMessage & { totalChars: number }, index: number, isContextCut: boolean) => {
    const avatarPath = getAvatarForMessage(message);
    const isStreaming = isMessageStreaming(message.id);
    const isLastMessage = index === messagesWithCharCount.length - 1;
    const hasReasoningData = hasReasoning(message.id);
    const isDisabled = !!message.disabled;

    return (
      <div key={message.id}>
        {isContextCut && <ContextCutDivider />}

        <div
          className={cn(
            "group relative flex gap-4 p-4 rounded-lg border-b-2 border-secondary hover:shadow-md transition-all",
            // Apply base card background unless disabled
            !isDisabled && (message.type === "user" || message.type === "character") && "bg-card",
            message.type === "user" && "flex-row-reverse",
            message.type === "system" && "bg-muted justify-center",
            isStreaming && "border-primary border-b-2 animate-pulse",
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
            className={cn(
              "flex-grow relative pb-6 text-justify",
              message.type === "user" && isEditingID !== message.id && "flex justify-end",
              message.type === "system" && "text-center max-w-2xl",
            )}
          >
            {isStreaming && <StreamingIndicator />}

            {/* Reasoning section if available */}
            {hasReasoningData && message.type === "character" && <ReasoningSection content={messageReasonings[message.id]} />}

            <MarkdownTextArea
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
                  <MessageActions
                    messageId={message.id}
                    messageType={message.type}
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

                  {message.type === "character" && (
                    <VersionControls
                      messageId={message.id}
                      messageType={message.type}
                      currentIndex={message.message_index}
                      totalVersions={message.messages.length}
                      onSwipe={handleSwipe}
                      isLastMessage={isLastMessage}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (messagesWithCharCount.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground text-center">
          No messages yet. Add participants to start the conversation.
          <br />
          View the live request console by pressing <strong>Ctrl</strong> + <strong>'</strong> (or <strong>Cmd</strong> + <strong>'</strong> on Mac)
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      <div ref={messagesContainerRef} className="flex flex-col gap-2 p-1 overflow-y-auto h-full" onScroll={handleScroll}>
        {messagesWithCharCount.map((message, index) => {
          const isContextCut = index === contextCutIndex;
          return renderMessage(message, index, isContextCut);
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
