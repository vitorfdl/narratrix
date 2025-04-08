import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Extracted VersionControls component
export const VersionControls = ({
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
