import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface PayloadProps {
  selectedRequest: any;
  activeTab: string;
  selectedRequestId: string;
  markdownClass: string;
  formatMarkdownValue: (value: string) => string;
}

export const Payload: React.FC<PayloadProps> = ({ selectedRequest, activeTab, selectedRequestId, markdownClass, formatMarkdownValue }) => {
  const payloadScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);

  // Handle scroll events to detect when user scrolls up or down
  const handleScroll = useCallback(() => {
    if (payloadScrollRef.current) {
      const scrollContainer = payloadScrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer as HTMLDivElement;
        // If we're more than 100px from the bottom, consider it a manual scroll
        const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
        // If we've scrolled down more than 200px, show the scroll-to-top button
        const isScrolledDown = scrollTop > 200;

        setUserScrolled(isScrolledUp);
        setShowScrollButton(isScrolledUp);
        setShowScrollTopButton(isScrolledDown);
      }
    }
  }, [selectedRequestId]);

  // Attach scroll event listener
  useEffect(() => {
    const scrollContainer = payloadScrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, payloadScrollRef]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (payloadScrollRef.current) {
        const scrollContainer = payloadScrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
        if (scrollContainer) {
          setTimeout(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            if (behavior === "auto") {
              setUserScrolled(false);
              setShowScrollButton(false);
            }
          }, 10);
        }
      }
    },
    [payloadScrollRef],
  );

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    if (payloadScrollRef.current) {
      const scrollContainer = payloadScrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = 0;
        }, 10);
      }
    }
  }, [payloadScrollRef]);

  // Scroll to bottom of payload when tab is active or request changes
  useEffect(() => {
    if (activeTab === "payload" && payloadScrollRef.current && !userScrolled) {
      scrollToBottom("auto");
    }
  }, [activeTab, selectedRequestId, scrollToBottom, userScrolled]);

  return (
    <div className="h-full p-0 m-0 relative">
      <ScrollArea ref={payloadScrollRef} className="h-full custom-scrollbar">
        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-medium mb-1 text-foreground/80">System Prompt</div>
            <MarkdownTextArea
              editable={false}
              className={markdownClass}
              initialValue={formatMarkdownValue(selectedRequest.systemPrompt || "No system prompt")}
            />
          </div>

          <div>
            <div className="text-sm font-medium mb-1 text-foreground/80">
              Messages <i className="text-xs text-muted-foreground/50">(Count:{selectedRequest.messages.length})</i>
            </div>
            {selectedRequest.messages.map((message: any, index: number) => (
              <div key={index} className="mb-3">
                <Badge className="mb-1" variant={message.role === "user" ? "default" : "secondary"}>
                  {message.role}
                </Badge>
                <MarkdownTextArea editable={false} className={markdownClass} initialValue={formatMarkdownValue(message.text)} />
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Scroll to top button - only visible in payload tab */}
      {showScrollTopButton && (
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 right-4 rounded-full shadow-md bg-background z-10 opacity-80 hover:opacity-100"
          onClick={scrollToTop}
          title="Scroll to top"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}

      {/* Scroll to bottom button - only visible in payload tab */}
      {showScrollButton && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full shadow-md bg-background z-10 opacity-80 hover:opacity-100"
          onClick={() => scrollToBottom()}
          title="Scroll to bottom"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
