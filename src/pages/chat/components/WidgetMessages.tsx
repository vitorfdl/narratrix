import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  BookmarkMinus,
  ChevronLeft,
  ChevronRight,
  Flag,
  Image,
  Languages,
  MoreHorizontal,
  Pencil,
  Scissors,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export type MessageType = "user" | "assistant" | "system" | "app";

export interface Message {
  id: string;
  type: MessageType;
  content: string[];
  timestamp: Date;
  avatar?: string;
  expression?: string; // For custom character expressions
}

export interface MessageRendererProps {
  messages: Message[];
  contextCutNumber: number;
  onEditMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onCreateCheckpoint: (messageId: string) => void;
  onGenerateImage: (messageId: string) => void;
  onTranslate: (messageId: string) => void;
  onExcludeFromPrompt: (messageId: string) => void;
}

const WidgetMessages: React.FC<MessageRendererProps> = ({
  messages,
  contextCutNumber,
  onEditMessage,
  onDeleteMessage,
  onCreateCheckpoint,
  onGenerateImage,
  onTranslate,
  onExcludeFromPrompt,
}) => {
  const [, setHoveredMessageId] = useState<string | null>(null);
  const [contentIndices, setContentIndices] = useState<Record<string, number>>({});

  // Calculate total characters up to each message
  const messagesWithCharCount = messages.map((msg, index) => {
    const previousChars = messages
      .slice(0, index)
      .reduce((acc, m) => acc + m.content.join("").length, 0);
    return {
      ...msg,
      totalChars: previousChars + msg.content.join("").length,
    };
  });

  // Find where to show the context cut line
  const contextCutIndex = messagesWithCharCount.findIndex(
    (msg) => msg.totalChars > contextCutNumber,
  );

  const handleSwipe = (messageId: string, direction: "left" | "right") => {
    setContentIndices((prev) => {
      const currentIndex = prev[messageId] || 0;
      const message = messages.find((m) => m.id === messageId);
      if (!message) {
        return prev;
      }

      let newIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      newIndex = Math.max(0, Math.min(newIndex, message.content.length - 1));

      return { ...prev, [messageId]: newIndex };
    });
  };

  const getCurrentContent = (message: Message) => {
    const currentIndex = contentIndices[message.id] || 0;
    return message.content[currentIndex] || message.content[0];
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      {messagesWithCharCount.map((message, index) => {
        const isContextCut = index === contextCutIndex;
        const currentIndex = contentIndices[message.id] || 0;

        return (
          <div key={message.id}>
            {isContextCut && (
              <div className="flex items-center justify-center w-full my-4">
                <div className="flex-grow border-t-2 border-dashed border-border" />
                <div className="mx-4 text-muted-foreground flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Context Cut
                </div>
                <div className="flex-grow border-t-2 border-dashed border-border" />
              </div>
            )}

            <div
              className={cn(
                "group relative flex gap-4 p-4 rounded-lg border-b-2 border-secondary hover:shadow-md",
                // Both user and assistant now share the same background color
                (message.type === "user" || message.type === "assistant") && "bg-card",
                message.type === "user" && "flex-row-reverse",
                (message.type === "system" || message.type === "app") && "bg-muted justify-center",
              )}
              onMouseEnter={() => setHoveredMessageId(message.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {/* Updated Avatar section */}
              {(message.type === "user" || message.type === "assistant") && (
                <div className="flex-shrink-0 select-none">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="transition-transform rounded-lg"
                        title="View Full Size Avatar"
                      >
                        <Avatar className="w-24 h-24 ring-2 ring-border overflow-hidden rounded-full hover:ring-primary">
                          {message.avatar ? (
                            <img
                              src={message.avatar}
                              alt={`${message.type} avatar`}
                              className="w-full h-full object-cover hover:cursor-pointer"
                            />
                          ) : (
                            <div className="w-full h-full bg-secondary flex items-center justify-center text-secondary-foreground">
                              {message.type === "user" ? "U" : "A"}
                            </div>
                          )}
                        </Avatar>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl w-fit p-2">
                      {message.avatar && (
                        <img
                          src={message.avatar}
                          alt={`${message.type} avatar full size`}
                          className="w-auto max-h-[80vh] object-contain rounded-lg"
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* Message content */}
              <div
                className={cn(
                  "flex-grow relative pb-8",
                  message.type === "user" && "text-right",
                  (message.type === "system" || message.type === "app") && "text-center max-w-2xl",
                )}
              >
                <p className="text-foreground text-sm select-text">{getCurrentContent(message)}</p>

                {/* Bottom controls container */}
                <div className="absolute bottom-0 w-full flex justify-between items-center">
                  {/* Action buttons - Right side for assistant, Left side for user */}
                  <div
                    className={cn(
                      "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-lg p-1",
                      message.type === "user" ? "order-1" : "order-2",
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-accent"
                      onClick={() => onEditMessage(message.id)}
                      title="Edit Message"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => onDeleteMessage(message.id)}
                      title="Delete Message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-accent"
                          title="More Options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => onTranslate(message.id)}>
                          <Languages className="w-4 h-4 mr-2" />
                          Translate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCreateCheckpoint(message.id)}>
                          <Flag className="w-4 h-4 mr-2" />
                          Create Checkpoint
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onGenerateImage(message.id)}>
                          <Image className="w-4 h-4 mr-2" />
                          Generate Image
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExcludeFromPrompt(message.id)}>
                          <BookmarkMinus className="w-4 h-4 mr-2" />
                          Exclude from Prompt
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Version controls - Left side for assistant, hidden for user */}
                  {message.type === "assistant" && (
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        message.type === "assistant" ? "order-1" : "order-2",
                      )}
                    >
                      <span className="text-xs text-muted-foreground ml-1">
                        {currentIndex + 1}/{message.content.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleSwipe(message.id, "left")}
                        title="Previous Version"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleSwipe(message.id, "right")}
                        title="Next Version"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WidgetMessages;
