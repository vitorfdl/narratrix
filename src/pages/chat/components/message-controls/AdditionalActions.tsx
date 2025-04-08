import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BookmarkMinus, Flag, Image, Languages, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";

export const MessageActions = ({
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
