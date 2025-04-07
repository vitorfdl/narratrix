import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { useProfile } from "@/hooks/ProfileContext";
import { useChatActions, useCurrentChatMessages, useCurrentChatTemplateID, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { cn } from "@/lib/utils";
import {
  BookmarkMinus,
  Brain,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Image,
  Languages,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useChatTemplate } from "@/hooks/chatTemplateStore";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { CharacterUnion } from "@/schema/characters-schema";
import { ChatMessage } from "@/schema/chat-message-schema";
import { AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";

// Extracted MessageAvatar component
const MessageAvatar = ({ avatarPath, messageType, isStreaming }: { avatarPath?: string; messageType: string; isStreaming: boolean }) => (
  <div className="flex-shrink-0 select-none">
    <Dialog>
      <DialogTrigger asChild>
        <button className="transition-transform rounded-lg" title="View Full Size Avatar">
          <Avatar className={cn("w-24 h-24 ring-2 ring-border overflow-hidden rounded-full hover:ring-primary", isStreaming && "ring-primary")}>
            <AvatarImage src={avatarPath} alt={`${messageType} avatar`} className="hover:cursor-pointer" />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <AvatarImage src="/avatars/default.jpg" alt={`Default ${messageType} avatar`} />
            </AvatarFallback>
          </Avatar>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-fit p-2">
        {avatarPath && <img src={avatarPath} alt={`${messageType} avatar full size`} className="w-auto max-h-[80vh] object-contain rounded-lg" />}
      </DialogContent>
    </Dialog>
  </div>
);

// Extracted MessageActions component with added Reasoning button
const MessageActions = ({
  messageId,
  messageType,
  isStreaming,
  isLastMessage,
  onEdit,
  onRegenerateMessage,
  onDeleteMessage,
  onTranslate,
  onCreateCheckpoint,
  onGenerateImage,
  onExcludeFromPrompt,
  onToggleReasoning,
  hasReasoning,
  isShowingReasoning,
}: {
  messageId: string;
  messageType: string;
  isStreaming: boolean;
  isLastMessage: boolean;
  onEdit: (id: string) => void;
  onRegenerateMessage: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onTranslate: (id: string) => void;
  onCreateCheckpoint: (id: string) => void;
  onGenerateImage: (id: string) => void;
  onExcludeFromPrompt: (id: string) => void;
  onToggleReasoning: (id: string) => void;
  hasReasoning: boolean;
  isShowingReasoning: boolean;
}) => (
  <div
    className={cn(
      "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-lg p-1",
      messageType === "user" ? "order-1" : "order-2",
    )}
  >
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 hover:bg-accent"
      onClick={() => onEdit(messageId)}
      title="Edit Message"
      disabled={isStreaming}
    >
      <Pencil className="w-4 h-4" />
    </Button>
    {messageType === "character" && (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-accent"
        onClick={() => onRegenerateMessage(messageId)}
        title="Regenerate Message"
        disabled={isStreaming || !isLastMessage}
      >
        <RefreshCw className={cn("w-4 h-4", isStreaming && "animate-spin")} />
      </Button>
    )}
    {messageType === "character" && hasReasoning && (
      <Button
        variant={isShowingReasoning ? "default" : "ghost"}
        size="icon"
        className={cn("h-6 w-6 hover:bg-accent relative", isShowingReasoning && "bg-primary text-primary-foreground hover:bg-primary/90")}
        onClick={() => onToggleReasoning(messageId)}
        title="Toggle Reasoning View"
      >
        <Brain className="w-4 h-4" />
      </Button>
    )}
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
      onClick={() => onDeleteMessage(messageId)}
      disabled={isStreaming}
      title="Delete Message"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent" title="More Options">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onTranslate(messageId)}>
          <Languages className="w-4 h-4 mr-2" />
          Translate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCreateCheckpoint(messageId)}>
          <Flag className="w-4 h-4 mr-2" />
          Create Checkpoint
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onGenerateImage(messageId)}>
          <Image className="w-4 h-4 mr-2" />
          Generate Image
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExcludeFromPrompt(messageId)}>
          <BookmarkMinus className="w-4 h-4 mr-2" />
          Exclude from Prompt
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

// Extracted VersionControls component
const VersionControls = ({
  messageId,
  messageType,
  currentIndex,
  totalVersions,
  onSwipe,
  isLastMessage,
}: {
  messageId: string;
  messageType: string;
  currentIndex: number;
  totalVersions: number;
  isLastMessage: boolean;
  onSwipe: (id: string, direction: "left" | "right") => void;
}) => (
  <div className={cn("flex items-center gap-1", messageType === "character" ? "order-1" : "order-2")}>
    <span className="text-xs text-muted-foreground ml-1">
      {currentIndex + 1}/{totalVersions}
    </span>
    <Button
      variant="ghost"
      size="icon"
      disabled={currentIndex === 0}
      className={cn(
        "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
        currentIndex === 0 && "group-hover:opacity-40 disabled:opacity-0",
      )}
      onClick={() => onSwipe(messageId, "left")}
      title="Previous Version"
    >
      <ChevronLeft className="w-4 h-4" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      disabled={currentIndex === totalVersions - 1 && !isLastMessage}
      className={cn(
        "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
        currentIndex === totalVersions - 1 && !isLastMessage && "group-hover:opacity-40 disabled:opacity-0",
      )}
      onClick={() => onSwipe(messageId, "right")}
      title="Next Version"
    >
      <ChevronRight className="w-4 h-4" />
    </Button>
  </div>
);

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

// Add new ReasoningSection component
const ReasoningSection = ({ content, onToggle, isExpanded }: { content: string; onToggle: () => void; isExpanded: boolean }) => {
  return (
    <div className="mt-4 px-3 pt-2 pb-1 bg-accent/40 rounded-lg border border-border text-sm relative animate-in fade-in duration-300">
      <div
        className="font-medium text-xs flex items-center gap-1.5 text-muted-foreground border-b border-border/50 pb-1.5 cursor-pointer hover:text-primary"
        onClick={onToggle}
      >
        <Brain className="w-3 h-3 text-primary" />
        <span>AI Reasoning Process</span>
        <ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", isExpanded ? "" : "rotate-180")} />
      </div>
      <div className={cn("overflow-hidden transition-all", isExpanded ? "max-h-[500px]" : "max-h-0")}>
        <TipTapTextArea
          initialValue={content}
          editable={false}
          className="bg-transparent border-none p-0 text-sm text-muted-foreground leading-relaxed"
        />
      </div>
    </div>
  );
};

const WidgetMessages: React.FC = () => {
  const inferenceService = useInferenceServiceFromContext();
  const { currentProfileAvatarUrl } = useProfile();

  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const characters = useCharacters();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();
  const messages = useCurrentChatMessages();
  const { updateChatMessage, deleteChatMessage } = useChatActions();

  const [isEditingID, setIsEditingID] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [streamingMessages, setStreamingMessages] = useState<Record<string, boolean>>({});
  const [messageReasonings, setMessageReasonings] = useState<Record<string, string>>({});
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({});
  const [initializedReasoningIds, setInitializedReasoningIds] = useState<Record<string, boolean>>({});
  const streamingCheckRef = useRef<number | null>(null);

  // Refs for scroll management
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const chatTemplateId = useCurrentChatTemplateID();
  const chatTemplate = useChatTemplate(chatTemplateId || "");

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
    return chatTemplate?.config.max_tokens ? msg.totalChars / 3 > chatTemplate.config.max_tokens - chatTemplate.config.max_response : false;
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

  const onExcludeFromPrompt = (messageId: string) => {
    console.log("Exclude from prompt", messageId);
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
        // If already tracked, no need to update
        if (prev[streamingState.messageId as string]) {
          return prev;
        }

        // Add the new streaming message
        return {
          ...prev,
          [streamingState.messageId as string]: true,
        };
      });

      // Store reasoning data separately if it exists
      if (streamingState.accumulatedReasoning && streamingState.accumulatedReasoning.trim() !== "") {
        setMessageReasonings((prev) => ({
          ...prev,
          [streamingState.messageId as string]: streamingState.accumulatedReasoning,
        }));

        // Only auto-expand reasoning for new messages that haven't been initialized
        setInitializedReasoningIds((prev) => {
          // If we've already initialized this reasoning, don't update
          if (prev[streamingState.messageId as string]) {
            return prev;
          }

          // Mark this reasoning as initialized
          return {
            ...prev,
            [streamingState.messageId as string]: true,
          };
        });

        // Only set the expanded state if this reasoning was not previously initialized
        setExpandedReasoningIds((prev) => {
          if (!initializedReasoningIds[streamingState.messageId as string]) {
            return {
              ...prev,
              [streamingState.messageId as string]: true,
            };
          }
          return prev;
        });
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
  }, [inferenceService, messages, streamingMessages, initializedReasoningIds]);

  // Handle toggling reasoning display
  const handleToggleReasoning = (messageId: string) => {
    setExpandedReasoningIds((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

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

  const renderMessage = (message: ChatMessage & { totalChars: number }, index: number, isContextCut: boolean) => {
    const avatarPath = getAvatarForMessage(message);
    const isStreaming = isMessageStreaming(message.id);
    const isLastMessage = index === messagesWithCharCount.length - 1;
    const hasReasoningData = hasReasoning(message.id);
    const isReasoningExpanded = !!expandedReasoningIds[message.id]; // Default to collapsed if not set

    return (
      <div key={message.id}>
        {isContextCut && <ContextCutDivider />}

        <div
          className={cn(
            "group relative flex gap-4 p-4 rounded-lg border-b-2 border-secondary hover:shadow-md transition-all",
            (message.type === "user" || message.type === "character") && "bg-card",
            message.type === "user" && "flex-row-reverse",
            message.type === "system" && "bg-muted justify-center",
            isStreaming && "border-primary border-b-2 animate-pulse",
          )}
        >
          {/* Avatar section */}
          {(message.type === "user" || message.type === "character") && (
            <MessageAvatar avatarPath={avatarPath || "/avatars/default.jpg"} messageType={message.type} isStreaming={isStreaming} />
          )}

          {/* Message content */}
          <div
            className={cn(
              "flex-grow relative pb-6 text-justify",
              message.type === "user" && isEditingID !== message.id && "flex justify-end",
              message.type === "system" && "text-center max-w-2xl",
            )}
          >
            {isStreaming && <StreamingIndicator />}

            {/* Reasoning section if available */}
            {hasReasoningData && message.type === "character" && (
              <ReasoningSection
                content={messageReasonings[message.id]}
                onToggle={() => handleToggleReasoning(message.id)}
                isExpanded={isReasoningExpanded}
              />
            )}

            <TipTapTextArea
              initialValue={getCurrentContent(message)}
              editable={isEditingID === message.id && !isStreaming}
              placeholder="Edit message..."
              className={cn(
                "select-text text-md",
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
                    onToggleReasoning={handleToggleReasoning}
                    hasReasoning={hasReasoningData}
                    isShowingReasoning={isReasoningExpanded}
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
