import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { LuBot, LuEyeOff, LuFileText, LuPlay } from "react-icons/lu";
import { toast } from "sonner";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { useLazyRender } from "@/hooks/useLazyRender";
import { cn } from "@/lib/utils";
import type { ChatMessage, UpdateChatMessageParams } from "@/schema/chat-message-schema";
import { ContextCutDivider, EditControls, MessageActions, StreamingIndicator } from "./AdditionalActions";
import { MessageAvatar } from "./MessageAvatar";
import { ReasoningSection } from "./ReasoningCollapsible";
import { VersionControls } from "./VersionButtons";

// Script type configurations with icons and styling
const SCRIPT_CONFIGS = {
  agent: {
    icon: LuBot,
    label: "AI Agent",
    description: "Automated response",
    className: "bg-chart-2/15 text-chart-2 border-chart-2/30",
    iconClassName: "text-chart-2",
  },
  summary: {
    icon: LuFileText,
    label: "Summary",
    description: "Context summary",
    className: "bg-chart-4/15 text-chart-4 border-chart-4/30",
    iconClassName: "text-chart-4",
  },
  start_chapter: {
    icon: LuPlay,
    label: "Chapter Start",
    description: "New chapter begins",
    className: "bg-primary/15 text-primary border-primary/30",
    iconClassName: "text-primary",
  },
} as const;

// Class name lookup tables
const MESSAGE_BASE_CLASSES = {
  container: "group relative flex gap-4 p-4 my-1 rounded-xl border border-border/50 hover:border-border transition-colors duration-200 hover:shadow-sm",
  content: "flex-grow relative pb-6 text-justify",
  markdown: "select-text text-sm text-foreground leading-relaxed mt-2",
  controlsContainer: "absolute bottom-0 w-full flex justify-between items-center translate-y-3",
  scriptIndicator: "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border backdrop-blur-sm",
  scriptHeader: "flex items-center justify-between mb-3 pb-2 border-b border-border/70",
  disabledOverlay: "absolute inset-0 rounded-xl pointer-events-none",
};

const TYPE_CLASSES = {
  user: "flex-row-reverse bg-gradient-to-br from-primary/5 to-primary/10",
  character: "bg-gradient-to-br from-card to-card/80",
  system: "bg-gradient-to-br from-card to-card/80",
};

const STATE_CLASSES = {
  streaming: "border-primary/60 shadow-primary/20 shadow-md transition-all",
  editing: "text-left ring-2 ring-primary/30 rounded-xl h-auto bg-background/95",
  disabled: "border-dashed border-destructive/60 opacity-40 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/80",
};

// Module-scope sub-components to avoid re-creating references on every render

const DisabledIndicator = () => (
  <div className="absolute top-2 right-2 z-10">
    <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/90 text-destructive-foreground text-xs font-medium rounded-md shadow-sm backdrop-blur-sm">
      <LuEyeOff className="h-3 w-3" />
      <span className="hidden @sm:inline">Excluded</span>
    </div>
  </div>
);

const ScriptIndicator = ({ script }: { script: keyof typeof SCRIPT_CONFIGS }) => {
  const config = SCRIPT_CONFIGS[script];
  const Icon = config.icon;
  return (
    <div className={cn(MESSAGE_BASE_CLASSES.scriptIndicator, config.className)}>
      <Icon className={cn("h-3.5 w-3.5", config.iconClassName)} />
      <span className="font-semibold">{config.label}</span>
      <span className="text-xs opacity-75 hidden @sm:inline">• {config.description}</span>
    </div>
  );
};

const ScriptHeader = ({ script, createdAt, messageType, name }: { script: keyof typeof SCRIPT_CONFIGS; createdAt: Date | string; messageType: string; name?: string }) => {
  const config = SCRIPT_CONFIGS[script];
  const Icon = config.icon;
  const label = script === "agent" && name ? name : config.label;
  return (
    <div className={MESSAGE_BASE_CLASSES.scriptHeader}>
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-md border", config.className)}>
          <Icon className={cn("h-4 w-4", config.iconClassName)} />
        </div>
        <span className="font-semibold text-sm">{label}</span>
      </div>
      {messageType === "system" && (
        <div className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
          {new Date(createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  );
};

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  isContextCut: boolean;
  isLastMessage: boolean;
  isStreaming: boolean;
  hasReasoningData: boolean;
  reasoningContent?: string;
  /** Pre-computed: isEditingID === message.id -- avoids re-rendering all messages when edit state changes */
  isEditing: boolean;
  editedContent: string;
  avatarPath: string | null;
  showAvatar: boolean;
  setEditedContent: (content: string) => void;
  handleCancelEdit: () => void;
  handleSaveEdit: (messageId: string) => Promise<void>;
  handleSwipe: (messageId: string, direction: "left" | "right") => void;
  handleMessageSelection: (characterId: string | undefined) => void;
  onRegenerateMessage: (messageId: string) => Promise<void>;
  setIsEditingID: (id: string | null) => void;
  updateChatMessage: (messageId: string, message: Partial<UpdateChatMessageParams>, forceUpdate?: boolean) => Promise<ChatMessage>;
  deleteChatMessage: (messageId: string) => Promise<void>;
}

const MessageItem = ({
  message,
  isContextCut,
  isLastMessage,
  isStreaming,
  hasReasoningData,
  reasoningContent,
  isEditing,
  editedContent,
  avatarPath,
  showAvatar,
  setEditedContent,
  handleCancelEdit,
  handleSaveEdit,
  handleSwipe,
  handleMessageSelection,
  onRegenerateMessage,
  setIsEditingID,
  updateChatMessage,
  deleteChatMessage,
}: MessageItemProps) => {
  const isDisabled = !!message.disabled;

  // Lazy rendering: skip the expensive markdown pipeline until the item is near the viewport.
  // Always render immediately for streaming/editing messages since they are always visible.
  const { ref: lazyRef, hasBeenVisible } = useLazyRender<HTMLDivElement>();
  const shouldRenderFull = hasBeenVisible || isStreaming || isEditing;

  // State to track the displayed content, separate from the message's content
  const [displayContent, setDisplayContent] = useState<string>("");

  const isStreamingThisMessage = useRef(false);

  useEffect(() => {
    const content = message.messages[message.message_index] || "...";

    if (isStreaming) {
      isStreamingThisMessage.current = true;
      setDisplayContent(content);
    } else if (!isStreamingThisMessage.current) {
      setDisplayContent(content);
    } else {
      isStreamingThisMessage.current = false;
      setDisplayContent(content);
    }
  }, [message.messages, message.message_index, isStreaming]);

  const onExcludeFromPrompt = useCallback(async () => {
    try {
      await updateChatMessage(message.id, { disabled: !isDisabled });
      toast.success("Message excluded from future context");
    } catch (error) {
      console.error("Failed to exclude message:", error);
      toast.error("Failed to exclude message from context");
    }
  }, [message.id, isDisabled, updateChatMessage]);

  const onDeleteMessage = useCallback(async () => {
    try {
      await deleteChatMessage(message.id);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  }, [message.id, deleteChatMessage]);

  const onCreateCheckpoint = (messageId: string) => {
    console.log("Create checkpoint", messageId);
  };

  const onGenerateImage = (messageId: string) => {
    console.log("Generate image", messageId);
  };

  const onTranslate = (messageId: string) => {
    console.log("Translate", messageId);
  };

  const startEditing = useCallback(
    (messageId: string) => {
      setEditedContent(displayContent);
      setIsEditingID(messageId);
    },
    [displayContent, setEditedContent, setIsEditingID],
  );

  const containerClassName = React.useMemo(() => {
    return cn(
      MESSAGE_BASE_CLASSES.container,
      TYPE_CLASSES[message.type],
      !isDisabled && message.type === "character" && "shadow-sm",
      !isDisabled && message.type === "user" && "shadow-sm",
      message.type === "system" && "shadow-inner",
      isStreaming && STATE_CLASSES.streaming,
      isDisabled && STATE_CLASSES.disabled,
    );
  }, [message.type, isStreaming, isDisabled]);

  const contentClassName = React.useMemo(() => {
    return cn(MESSAGE_BASE_CLASSES.content, message.type === "user" && !isEditing && "flex justify-end", message.type === "system" && "text-center", isDisabled && "relative");
  }, [message.type, isEditing, isDisabled]);

  const markdownClassName = React.useMemo(() => {
    return cn(
      MESSAGE_BASE_CLASSES.markdown,
      !isEditing ? "bg-transparent border-none" : STATE_CLASSES.editing,
      isStreaming && "",
      message.type === "system" && "text-left",
      isDisabled && "line-through decoration-destructive decoration-2 text-muted-foreground/70",
    );
  }, [isEditing, isStreaming, message.type, isDisabled]);

  const handleSave = async () => {
    await handleSaveEdit(message.id);
  };

  return (
    <>
      {isContextCut && <ContextCutDivider />}

      <div ref={lazyRef} data-message-id={message.id} className={containerClassName}>
        {isDisabled && (
          <>
            <div className={MESSAGE_BASE_CLASSES.disabledOverlay} />
            <DisabledIndicator />
          </>
        )}

        {showAvatar && (message.type === "user" || message.type === "character") && (
          <MessageAvatar avatarPath={avatarPath || "/avatars/default.jpg"} messageType={message.type} isStreaming={isStreaming} />
        )}

        {shouldRenderFull ? (
          <div onMouseUp={() => handleMessageSelection(message.character_id || undefined)} className={contentClassName}>
            {isStreaming && <StreamingIndicator />}

            {hasReasoningData && message.type === "character" && <ReasoningSection content={reasoningContent || ""} />}

            {message.extra?.script &&
              (message.type === "system" ? (
                <ScriptHeader script={message.extra.script} createdAt={message.created_at} messageType={message.type} name={message.extra.name ?? undefined} />
              ) : (
                <div className={cn("flex mb-3", message.type === "user" ? "justify-end" : "justify-start")}>
                  <ScriptIndicator script={message.extra.script} />
                </div>
              ))}

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
                      onEdit={startEditing}
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
        ) : (
          // Lightweight placeholder rendered while the message is off-screen.
          // min-height keeps the scroll container's total height stable so
          // the user's scroll position doesn't jump when content loads in.
          <div className="flex-grow min-h-[6rem]" />
        )}
      </div>
    </>
  );
};

export default memo(MessageItem, (prevProps, nextProps) => {
  if (prevProps.isStreaming && prevProps.message.id === nextProps.message.id) {
    return false;
  }

  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.message_index === nextProps.message.message_index &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.message.disabled === nextProps.message.disabled &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    prevProps.hasReasoningData === nextProps.hasReasoningData &&
    (prevProps.hasReasoningData === false || prevProps.reasoningContent === nextProps.reasoningContent) &&
    prevProps.message.messages === nextProps.message.messages &&
    prevProps.avatarPath === nextProps.avatarPath &&
    prevProps.showAvatar === nextProps.showAvatar &&
    (!prevProps.isEditing || prevProps.editedContent === nextProps.editedContent)
  );
});
