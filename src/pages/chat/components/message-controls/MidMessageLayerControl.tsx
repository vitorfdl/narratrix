import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Button } from "@/components/ui/button";
import { useChatActions, useCurrentChatActiveChapterID, useCurrentChatId } from "@/hooks/chatStore";
import { cn } from "@/lib/utils";
import { SummaryDialog, SummarySettings } from "@/pages/chat/components/message-controls/SummaryDialog";
import { ChatMessage, deleteChatMessagesByFilter } from "@/services/chat-message-service";
import { useLocalSummarySettings } from "@/utils/local-storage";
import { BookUp2, LinkIcon, MergeIcon, ScissorsIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface MidMessageLayerControlProps {
  messageBefore: ChatMessage;
  messageAfter: ChatMessage;
  onSummarize?: (lastMessageID: string, settings: SummarySettings) => void;
}

export const MidMessageLayerControl: React.FC<MidMessageLayerControlProps> = ({ messageBefore, messageAfter, onSummarize }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);

  const chatId = useCurrentChatId();
  const chapterID = useCurrentChatActiveChapterID();
  const { fetchChatMessages, updateChatMessage, deleteChatMessage } = useChatActions();

  const [, setLocalSummarySettings] = useLocalSummarySettings();
  const handleDelete = async () => {
    await deleteChatMessagesByFilter({
      chat_id: chatId,
      chapter_id: chapterID,
      position_gte: messageAfter.position,
    });

    setIsDeleteDialogOpen(false);
    fetchChatMessages();
  };

  useEffect(() => {
    setTimeout(() => {
      setIsHovered(false);
    }, 800); // Just a animation delay
  }, [isMergeDialogOpen, isSummaryDialogOpen, isDeleteDialogOpen]);

  const handleMerge = async () => {
    try {
      // Ensure both messages have content to merge
      if (
        !messageBefore.messages ||
        messageBefore.messages.length <= messageBefore.message_index ||
        !messageAfter.messages ||
        messageAfter.messages.length <= messageAfter.message_index
      ) {
        console.error("Cannot merge messages: Invalid message structure.");
        // Optionally show a toast notification here
        return;
      }

      const beforeContent = messageBefore.messages[messageBefore.message_index];
      const afterContent = messageAfter.messages[messageAfter.message_index];

      // Combine content with a separator
      const combinedContent = `${beforeContent}\n\n${afterContent}`;

      // Prepare the updated messages array for the 'before' message
      const updatedMessages = [...messageBefore.messages];
      updatedMessages[messageBefore.message_index] = combinedContent;

      // Update the 'before' message
      await updateChatMessage(messageBefore.id, { messages: updatedMessages });

      // Delete the 'after' message
      await deleteChatMessage(messageAfter.id);

      // Close dialog and reset hover state
      setIsMergeDialogOpen(false);

      // Refetch messages to update the UI (though store actions might already do this)
      fetchChatMessages();
    } catch (error) {
      console.error("Failed to merge messages:", error);
      // Optionally show a toast notification for the error
      // Consider how to handle potential partial success (e.g., update succeeded but delete failed)
    }
  };

  const handleSummarySettings = (settings: SummarySettings, runNow?: boolean) => {
    // Save settings to local storage
    setLocalSummarySettings(settings);

    // If runNow is true, execute the summarize operation
    if (runNow && onSummarize) {
      onSummarize(messageBefore.id, settings);
    }
  };

  return (
    <div
      className={cn("group relative flex justify-center items-center h-0 -mt-0 -mb-1 z-10", "transition-all duration-100")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Central dot indicator - always visible but more prominent on hover */}
      <div
        className={cn(
          "absolute top-[-1rem] w-4 h-4 rounded-full transition-all duration-100",
          "border border-border bg-background flex items-center justify-center",
          "hover:border-primary/50 hover:scale-110",
          // Make dot visible when widget is hovered too
          "group-hover/message:opacity-60",
          isHovered ? "opacity-100" : "opacity-0",
        )}
      >
        <LinkIcon className="h-2 w-2" />
      </div>

      {/* Control buttons that appear on hover */}
      <div
        className={cn(
          "absolute top-[-1.5rem] flex gap-1 bg-background border border-border rounded-md shadow-md p-1",
          "transition-all duration-200 transform",
          isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
        )}
      >
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMergeDialogOpen(true)} title="Combine with previous message">
          <MergeIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsSummaryDialogOpen(true)}
          title="Transform previous content into a summary"
        >
          <BookUp2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => setIsDeleteDialogOpen(true)}
          title="Remove all following messages"
        >
          <ScissorsIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Dialog */}
      <SummaryDialog isOpen={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen} onSave={handleSummarySettings} />

      <DestructiveConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        description="This action will permanently remove all messages following this point in the current chapter and cannot be undone."
      />

      <DestructiveConfirmDialog
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        onConfirm={handleMerge}
        confirmText="Merge"
        title="Combine with previous message?"
        description="This will permanently join this message with the one above it, creating a single message. This action cannot be undone."
      />
    </div>
  );
};
