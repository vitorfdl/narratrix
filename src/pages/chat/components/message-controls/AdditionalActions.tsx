import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { BookmarkMinus, BookmarkPlus, Check, Copy, Flag, Image, Languages, Loader2, MoreHorizontal, Pencil, RefreshCw, Scissors, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getChatMessageById } from "@/services/chat-message-service";

export const MessageActions = ({
  messageId,
  messageType,
  isStreaming,
  isLastMessage,
  isDisabled,
  onEdit,
  onRegenerateMessage,
  onDeleteMessage,
  onTranslate,
  onCreateCheckpoint,
  onGenerateImage,
  onExcludeFromPrompt,
}: {
  messageId: string;
  messageType: string;
  isStreaming: boolean;
  isLastMessage: boolean;
  isDisabled: boolean;
  onEdit: (id: string) => void;
  onRegenerateMessage: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onTranslate: (id: string) => void;
  onCreateCheckpoint: (id: string) => void;
  onGenerateImage: (id: string) => void;
  onExcludeFromPrompt: (id: string) => void;
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerateMessage(messageId);
    } finally {
      // Reset after a short delay to ensure UI shows loading state
      setTimeout(() => setIsRegenerating(false), 500);
    }
  };

  // Determine the actual disabled state for regenerate button
  const isRegenerateDisabled = isStreaming || isRegenerating;

  return (
    <div className={cn("flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-lg p-1", isDropdownOpen && "opacity-100")}>
      <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent" onClick={() => onEdit(messageId)} title="Edit Message" disabled={isRegenerateDisabled}>
        <Pencil className="w-4 h-4" />
      </Button>
      {messageType === "character" && (
        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent" onClick={handleRegenerate} title="Regenerate Message" disabled={isRegenerateDisabled || !isLastMessage}>
          <RefreshCw className={cn("w-4 h-4", (isStreaming || isRegenerating) && "animate-spin")} />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => onDeleteMessage(messageId)}
        disabled={isRegenerateDisabled}
        title="Delete Message"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-accent"
        onClick={async () => {
          try {
            const message = await getChatMessageById(messageId);
            const messageContent = message?.messages[message.message_index];
            console.log(messageContent);
            await writeText(messageContent || "");
            toast.success("Content copied to clipboard");
          } catch (error) {
            toast.error("Failed to copy message content");
          }
        }}
        title="Copy Message"
        aria-label="Copy Message"
        disabled={isRegenerateDisabled}
      >
        <Copy className="w-4 h-4" />
      </Button>
      <DropdownMenu onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent" title="More Options">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={true} onClick={() => onTranslate(messageId)}>
            <Languages className="w-4 h-4 mr-2" />
            Translate
          </DropdownMenuItem>
          <DropdownMenuItem disabled={true} onClick={() => onCreateCheckpoint(messageId)}>
            <Flag className="w-4 h-4 mr-2" />
            Create Checkpoint
          </DropdownMenuItem>
          <DropdownMenuItem disabled={true} onClick={() => onGenerateImage(messageId)}>
            <Image className="w-4 h-4 mr-2" />
            Generate Image
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExcludeFromPrompt(messageId)}>
            {isDisabled ? <BookmarkPlus className="w-4 h-4 mr-2" /> : <BookmarkMinus className="w-4 h-4 mr-2" />}
            {isDisabled ? "Restore to history" : "Exclude from history"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Extracted EditControls component
export const EditControls = ({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) => (
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
export const ContextCutDivider = () => (
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
export const StreamingIndicator = () => (
  <div className="absolute right-0 top-[-1rem] flex items-center gap-2 p-1 bg-background/80 backdrop-blur-sm rounded-md animate-pulse">
    <Loader2 className="w-4 h-4 animate-spin text-primary" />
    <span className="text-xs text-primary font-medium">Thinking...</span>
  </div>
);
