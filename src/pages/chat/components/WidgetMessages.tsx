import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { useProfile } from "@/hooks/ProfileContext";
import { useChatActions, useCurrentChatMessages, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { cn } from "@/lib/utils";
import {
  BookmarkMinus,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Image,
  Languages,
  Loader2,
  MoreHorizontal,
  Pencil,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useCharacterStore } from "@/hooks/characterStore";
import { CharacterUnion } from "@/schema/characters-schema";
import { ChatMessage } from "@/schema/chat-message-schema";

// Define context cut number
const contextCutNumber = 500; // Example value - adjust as needed

const WidgetMessages: React.FC = () => {
  const profile = useProfile();
  const avatar = profile.currentProfile?.avatar_path;

  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const characters = useCharacterStore((state) => state.characters);
  const messages = useCurrentChatMessages();
  const { updateChatMessage, deleteChatMessage } = useChatActions();

  const [contentIndices, setContentIndices] = useState<Record<string, number>>({});
  const [isEditingID, setIsEditingID] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [streamingMsgIds, setStreamingMsgIds] = useState<string[]>([]);

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
    return msg.totalChars > contextCutNumber;
  });

  const handleSwipe = (messageId: string, direction: "left" | "right") => {
    setContentIndices((prev) => {
      const currentIndex = prev[messageId] || 0;
      const message = messages.find((m) => m.id === messageId);
      if (!message) {
        return prev;
      }

      let newIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      newIndex = Math.max(0, Math.min(newIndex, message.messages.length - 1));

      return { ...prev, [messageId]: newIndex };
    });
  };

  const getCurrentContent = (message: ChatMessage) => {
    const currentIndex = contentIndices[message.id] || 0;
    return message.messages[currentIndex] || message.messages[0];
  };

  const getAvatarForMessage = (message: ChatMessage): string | undefined => {
    if (message.type === "user") {
      // Use the user's avatar unless they've selected a character
      if (currentChatUserCharacterID) {
        const userCharacter = characters.find((c: CharacterUnion) => c.id === currentChatUserCharacterID);
        return userCharacter?.avatar_path ? userCharacter.avatar_path : avatar;
      }
      return avatar;
    }

    if (message.type === "character" && message.character_id) {
      // Get the character's avatar from character list
      const character = characters.find((c: CharacterUnion) => c.id === message.character_id);
      return character?.avatar_path ? character.avatar_path : undefined;
    }

    return undefined;
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

      const currentIndex = contentIndices[messageId] || 0;
      const updatedMessages = [...message.messages];
      updatedMessages[currentIndex] = editedContent;

      await updateChatMessage(messageId, {
        messages: updatedMessages,
        message_index: currentIndex,
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

  const isMessageStreaming = (messageId: string) => {
    return streamingMsgIds.includes(messageId);
  };

  // Update the streaming status of messages when they change
  useEffect(() => {
    // Find messages with "..." content that are likely placeholder for streaming
    const streamingIds = messages.filter((msg) => msg.type === "character" && msg.messages[0] === "...").map((msg) => msg.id);

    setStreamingMsgIds(streamingIds);
  }, [messages]);

  return (
    <div className="flex flex-col gap-2 p-1">
      {messagesWithCharCount.map((message, index) => {
        const isContextCut = index === contextCutIndex;
        const currentIndex = contentIndices[message.id] || 0;
        const avatarPath = getAvatarForMessage(message);
        const isStreaming = isMessageStreaming(message.id);

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
                "group relative flex gap-4 p-4 rounded-lg border-b-2 border-secondary hover:shadow-md transition-all",
                (message.type === "user" || message.type === "character") && "bg-card",
                message.type === "user" && "flex-row-reverse",
                message.type === "system" && "bg-muted justify-center",
                isStreaming && "border-primary border-b-2 animate-pulse",
              )}
            >
              {/* Avatar section */}
              {(message.type === "user" || message.type === "character") && (
                <div className="flex-shrink-0 select-none">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="transition-transform rounded-lg" title="View Full Size Avatar">
                        <Avatar
                          className={cn(
                            "w-24 h-24 ring-2 ring-border overflow-hidden rounded-full hover:ring-primary",
                            isStreaming && "ring-primary",
                          )}
                        >
                          {avatarPath ? (
                            <img src={avatarPath} alt={`${message.type} avatar`} className="w-full h-full object-cover hover:cursor-pointer" />
                          ) : (
                            <div className="w-full h-full bg-secondary flex items-center justify-center text-secondary-foreground">
                              {message.type === "user" ? "U" : "C"}
                            </div>
                          )}
                        </Avatar>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl w-fit p-2">
                      {avatarPath && (
                        <img src={avatarPath} alt={`${message.type} avatar full size`} className="w-auto max-h-[80vh] object-contain rounded-lg" />
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* Message content */}
              <div
                className={cn(
                  "flex-grow relative pb-4",
                  message.type === "user" && "text-right",
                  message.type === "system" && "text-center max-w-2xl",
                )}
              >
                {isStreaming && (
                  <div className="absolute right-0 top-0 flex items-center gap-2 p-1 bg-background/80 backdrop-blur-sm rounded-md animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs text-primary font-medium">Thinking...</span>
                  </div>
                )}

                <TipTapTextArea
                  initialValue={getCurrentContent(message)}
                  editable={isEditingID === message.id}
                  disableRichText={isEditingID === message.id}
                  placeholder="Edit message..."
                  suggestions={[]}
                  className={cn(
                    "select-text",
                    isEditingID !== message.id ? "bg-transparent border:none border-b-0" : "text-left ring-1 ring-border rounded-lg",
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
                    // Edit mode controls
                    <div className="flex gap-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 ml-auto shadow-sm">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                        <X className="!w-4 !h-4" />
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={() => handleSaveEdit(message.id)}>
                        <Check className="!w-4 !h-4" />
                        Save
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Action buttons - Right side for character, Left side for user */}
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
                          onClick={() => setIsEditingID(message.id)}
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
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent" title="More Options">
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

                      {/* Version controls - Left side for character, hidden for user */}
                      {message.type === "character" && (
                        <div className={cn("flex items-center gap-1", message.type === "character" ? "order-1" : "order-2")}>
                          <span className="text-xs text-muted-foreground ml-1">
                            {currentIndex + 1}/{message.messages.length}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                              currentIndex === 0 && "group-hover:opacity-0 hidden",
                            )}
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
                    </>
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
