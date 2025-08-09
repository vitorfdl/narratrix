import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Extracted VersionControls component
export const VersionControls = ({
  messageId,
  messageType,
  currentIndex,
  totalVersions,
  onSwipe,
  isLastMessage,
  isStreaming,
}: {
  messageId: string;
  messageType: string;
  currentIndex: number;
  totalVersions: number;
  isLastMessage: boolean;
  isStreaming: boolean;
  onSwipe: (id: string, direction: "left" | "right") => void;
}) => {
  const [isProcessingSwipe, setIsProcessingSwipe] = useState(false);

  const handleSwipe = async (direction: "left" | "right") => {
    setIsProcessingSwipe(true);
    try {
      await onSwipe(messageId, direction);
    } finally {
      // Reset state after a short delay
      setTimeout(() => setIsProcessingSwipe(false), 500);
    }
  };

  // Determine if buttons should be disabled based on combined state
  const isLeftDisabled = currentIndex === 0 || isStreaming || isProcessingSwipe;
  const isRightDisabled = (currentIndex === totalVersions - 1 && !isLastMessage) || isStreaming || isProcessingSwipe;

  return (
    <div className={cn("flex items-center gap-1", messageType === "character" ? "order-1" : "order-2")}>
      <span className="text-xs text-muted-foreground ml-1">
        {currentIndex + 1}/{totalVersions}
      </span>
      <Button
        variant="ghost"
        size="icon"
        disabled={isLeftDisabled}
        className={cn("h-6 w-6 opacity-0 group-hover/message:opacity-100 transition-opacity", isLeftDisabled && "group-hover/message:opacity-40 disabled:opacity-0")}
        onClick={() => handleSwipe("left")}
        title="Previous Version"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={isRightDisabled}
        className={cn("h-6 w-6 opacity-0 group-hover/message:opacity-100 transition-opacity", isRightDisabled && "group-hover/message:opacity-40 disabled:opacity-0")}
        onClick={() => handleSwipe("right")}
        title="Next Version"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
};
