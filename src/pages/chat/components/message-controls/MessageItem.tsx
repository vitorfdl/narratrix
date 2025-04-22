import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useImageUrl } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/schema/chat-message-schema";
import React, { memo, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ContextCutDivider, EditControls, MessageActions, StreamingIndicator } from "./AdditionalActions";
import { MessageAvatar } from "./MessageAvatar";
import { ReasoningSection } from "./ReasoningCollapsible";
import { VersionControls } from "./VersionButtons";

// Class name lookup tables
const MESSAGE_BASE_CLASSES = {
  container: "group relative flex gap-4 p-4 rounded-lg border-b-2 border-secondary hover:shadow-md",
  content: "flex-grow relative pb-6 text-justify",
  markdown: "select-text text-sm text-white text-sans",
  controlsContainer: "absolute bottom-0 w-full flex justify-between items-center translate-y-3",
  scriptTag:
    "px-3 py-1 text-xs font-semibold font-mono rounded-full bg-primary/20 text-primary-foreground border border-primary/30 capitalize tracking-wider shadow-sm",
};

const TYPE_CLASSES = {
  user: "flex-row-reverse",
  character: "",
  system: "bg-muted mx-5 @md:mx-10 @lg:mx-35",
};

const STATE_CLASSES = {
  streaming: "border-primary border-b-2 animate-pulse transition-all",
  editing: "text-left ring-1 ring-border rounded-lg h-auto",
  disabled: "border-dashed border-muted-foreground opacity-60 bg-chart-5/20",
};

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  isContextCut: boolean;
  isLastMessage: boolean;
  isStreaming: boolean;
  hasReasoningData: boolean;
  reasoningContent?: string;
  isEditingID: string | null;
  editedContent: string;
  setEditedContent: (content: string) => void;
  handleCancelEdit: () => void;
  handleSaveEdit: (messageId: string) => Promise<void>;
  handleSwipe: (messageId: string, direction: "left" | "right") => void;
  handleMessageSelection: (characterId: string | undefined) => void;
  onRegenerateMessage: (messageId: string) => Promise<void>;
  setIsEditingID: (id: string | null) => void;
}

const MessageItem = ({
  message,
  isContextCut,
  isLastMessage,
  isStreaming,
  hasReasoningData,
  reasoningContent,
  isEditingID,
  editedContent,
  setEditedContent,
  handleCancelEdit,
  handleSaveEdit,
  handleSwipe,
  handleMessageSelection,
  onRegenerateMessage,
  setIsEditingID,
}: MessageItemProps) => {
  // Inside MessageItem.tsx
  const characters = useCharacters();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();
  const currentProfile = useCurrentProfile();
  const { url: currentProfileAvatarUrl } = useImageUrl(currentProfile?.avatar_path);
  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const { updateChatMessage, deleteChatMessage } = useChatActions();

  const isEditing = isEditingID === message.id;
  const isDisabled = !!message.disabled;

  // State to track the displayed content, separate from the message's content
  // This helps with smoother streaming updates
  const [displayContent, setDisplayContent] = useState<string>("");

  // Update the displayed content when the message content changes
  useEffect(() => {
    const content = message.messages[message.message_index] || "...";
    setDisplayContent(content);
  }, [message.messages, message.message_index]);

  // When entering edit mode, initialize edited content with the current message
  useEffect(() => {
    if (isEditing) {
      setEditedContent(displayContent);
    }
  }, [isEditing, displayContent, setEditedContent]);

  const onExcludeFromPrompt = useCallback(async () => {
    try {
      await updateChatMessage(message.id, { disabled: !isDisabled });
      toast.success("Message excluded from future context");
    } catch (error) {
      console.error("Failed to exclude message:", error);
      toast.error("Failed to exclude message from context");
    }
  }, [message.id, isDisabled]);

  const onDeleteMessage = useCallback(async () => {
    try {
      await deleteChatMessage(message.id);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  }, [message.id]);

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

  // Memoize computed values
  const avatarPath = React.useMemo(() => {
    if (message.type === "user") {
      if (currentChatUserCharacterID) {
        const userCharacter = characters.find((c) => c.id === currentChatUserCharacterID);
        return avatarUrlMap[userCharacter?.id || ""] || currentProfileAvatarUrl;
      }
      return avatarUrlMap[currentChatUserCharacterID || ""] || currentProfileAvatarUrl;
    }

    if (message.type === "character" && message.character_id) {
      const character = characters.find((c) => c.id === message.character_id);
      return avatarUrlMap[character?.id || ""] || null;
    }

    return null;
  }, [message.type, message.character_id, avatarUrlMap, characters, currentChatUserCharacterID, currentProfileAvatarUrl]);

  // Compute class names just once
  const containerClassName = React.useMemo(() => {
    return cn(
      MESSAGE_BASE_CLASSES.container,
      TYPE_CLASSES[message.type],
      !isDisabled && message.type === "character" && "bg-card",
      !isDisabled && message.type === "user" && "bg-primary/5",
      isStreaming && STATE_CLASSES.streaming,
      isDisabled && STATE_CLASSES.disabled,
    );
  }, [message.type, isStreaming, isDisabled]);

  const contentClassName = React.useMemo(() => {
    return cn(MESSAGE_BASE_CLASSES.content, message.type === "user" && isEditingID !== message.id && "flex justify-end");
  }, [message.type, isEditingID, message.id]);

  const markdownClassName = React.useMemo(() => {
    return cn(
      MESSAGE_BASE_CLASSES.markdown,
      isEditingID !== message.id ? "bg-transparent border-none" : STATE_CLASSES.editing,
      isStreaming && "animate-pulse duration-500",
    );
  }, [isEditingID, message.id, isStreaming]);

  // Handle local save to ensure updated content is passed to parent
  const handleSave = async () => {
    await handleSaveEdit(message.id);
  };

  return (
    <>
      {isContextCut && <ContextCutDivider />}

      <div data-message-id={message.id} className={containerClassName}>
        {/* Avatar section */}
        {(message.type === "user" || message.type === "character") && (
          <MessageAvatar avatarPath={avatarPath || "/avatars/default.jpg"} messageType={message.type} isStreaming={isStreaming} />
        )}

        {/* Message content */}
        <div onMouseUp={() => handleMessageSelection(message.character_id || undefined)} className={contentClassName}>
          {isStreaming && <StreamingIndicator />}

          {/* Reasoning section if available */}
          {hasReasoningData && message.type === "character" && <ReasoningSection content={reasoningContent || ""} />}

          {message.extra?.script && (
            <div className="flex justify-center items-center mb-2">
              <div className={MESSAGE_BASE_CLASSES.scriptTag}>{message.extra.script.replace("_", " ")}</div>
            </div>
          )}

          <MarkdownTextArea
            autofocus={isEditing}
            initialValue={isEditing ? editedContent : displayContent}
            editable={isEditing && !isStreaming}
            placeholder="Edit message..."
            className={markdownClassName}
            onChange={(newContent) => {
              if (isEditing) {
                setEditedContent(newContent);
              }
            }}
          />

          {/* Bottom controls container */}
          <div className={MESSAGE_BASE_CLASSES.controlsContainer}>
            {isEditing ? (
              <EditControls onCancel={handleCancelEdit} onSave={handleSave} />
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
    </>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(MessageItem, (prevProps, nextProps) => {
  // Only re-render when specific props change
  if (prevProps.isStreaming && prevProps.message.id === nextProps.message.id) {
    // Always re-render when streaming the same message to ensure updates are visible
    return false;
  }

  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.message_index === nextProps.message.message_index &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isEditingID === nextProps.isEditingID &&
    prevProps.message.disabled === nextProps.message.disabled &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    prevProps.hasReasoningData === nextProps.hasReasoningData &&
    (prevProps.hasReasoningData === false || prevProps.reasoningContent === nextProps.reasoningContent) &&
    JSON.stringify(prevProps.message.messages) === JSON.stringify(nextProps.message.messages) &&
    (prevProps.isEditingID !== prevProps.message.id || prevProps.editedContent === nextProps.editedContent)
  );
});
