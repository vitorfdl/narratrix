import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, ChevronDown, ChevronUp, Merge, Settings, Split, User } from "lucide-react";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Pagination constants for PayloadTab
const PAYLOAD_PAGE_SIZE = 15; // Number of messages per page
const PAYLOAD_RENDER_BUFFER_MULTIPLIER = 3; // Render 2 pages worth at once

interface PayloadProps {
  selectedRequest: any;
  activeTab: string;
  selectedRequestId: string;
}

export const Payload: React.FC<PayloadProps> = ({ selectedRequest, activeTab, selectedRequestId }) => {
  const payloadScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());
  const [systemPromptCollapsed, setSystemPromptCollapsed] = useState(true);
  const [viewMode, setViewMode] = useState<"split" | "concatenated">("split");

  // Message pagination state
  const [msgRenderIndex, setMsgRenderIndex] = useState<number>(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [shouldScrollToTop, setShouldScrollToTop] = useState<boolean>(false);

  const isCompletion = selectedRequest.modelSpecs.model_type === "completion";

  // Handle scroll events to detect when user scrolls up or down and implement pagination
  const handleScroll = useCallback(() => {
    if (payloadScrollRef.current) {
      const scrollContainer = payloadScrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer as HTMLDivElement;
        const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
        const isScrolledDown = scrollTop > 200;

        setUserScrolled(isScrolledUp);
        setShowScrollButton(isScrolledUp);
        setShowScrollTopButton(isScrolledDown);

        // Disable auto-scroll if user manually scrolled
        if (isScrolledUp && autoScrollEnabled) {
          setAutoScrollEnabled(false);
        }

        // Re-enable auto-scroll if user scrolled back to bottom
        if (!isScrolledUp && !autoScrollEnabled) {
          setAutoScrollEnabled(true);
        }

        // More aggressive pagination logic - load earlier messages when scrolling up
        const topThreshold = scrollHeight * 0.25; // Load when within 25% of content height from top
        if (scrollTop < topThreshold && msgRenderIndex > 0 && !isLoadingMore) {
          const newIndex = Math.max(0, msgRenderIndex - PAYLOAD_PAGE_SIZE);
          if (newIndex !== msgRenderIndex) {
            setIsLoadingMore(true);
            // Use setTimeout to make the transition smoother
            setTimeout(() => {
              setMsgRenderIndex(newIndex);
              setIsLoadingMore(false);
            }, 50);
          }
        }

        // Load more recent messages when scrolling down
        const bottomThreshold = scrollHeight * 0.75; // Load when past 75% of content height
        if (scrollTop > bottomThreshold && selectedRequest.messages && !isLoadingMore) {
          const maxMessages = selectedRequest.messages.length;
          const currentEndIndex = msgRenderIndex + PAYLOAD_RENDER_BUFFER_MULTIPLIER * PAYLOAD_PAGE_SIZE;
          if (currentEndIndex < maxMessages) {
            const maxPossibleIndex = Math.max(0, maxMessages - PAYLOAD_RENDER_BUFFER_MULTIPLIER * PAYLOAD_PAGE_SIZE);
            const newIndex = Math.min(msgRenderIndex + PAYLOAD_PAGE_SIZE, maxPossibleIndex);
            if (newIndex !== msgRenderIndex && newIndex >= 0) {
              setIsLoadingMore(true);
              setTimeout(() => {
                setMsgRenderIndex(newIndex);
                setIsLoadingMore(false);
              }, 50);
            }
          }
        }
      }
    }
  }, [selectedRequestId, msgRenderIndex, selectedRequest.messages, autoScrollEnabled, isLoadingMore]);

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
      // Reset pagination to show latest messages
      if (selectedRequest.messages && selectedRequest.messages.length > 0) {
        const messageCount = selectedRequest.messages.length;
        const newIndex = Math.max(0, messageCount - PAYLOAD_RENDER_BUFFER_MULTIPLIER * PAYLOAD_PAGE_SIZE);
        setMsgRenderIndex(newIndex);
      }

      // Re-enable auto-scroll
      setAutoScrollEnabled(true);

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
    [payloadScrollRef, selectedRequest.messages],
  );

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    // Set pagination to show earliest messages and flag for scroll
    setMsgRenderIndex(0);
    setAutoScrollEnabled(false);
    setShouldScrollToTop(true);
  }, []);

  // Effect to handle scroll to top after render
  useLayoutEffect(() => {
    if (shouldScrollToTop && payloadScrollRef.current) {
      const scrollContainer = payloadScrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        setShouldScrollToTop(false);
      }
    }
  }, [shouldScrollToTop, msgRenderIndex]); // Trigger after msgRenderIndex changes

  // Scroll to bottom of payload when tab is active or request changes
  useEffect(() => {
    if (activeTab === "payload" && payloadScrollRef.current && !userScrolled) {
      scrollToBottom("auto");
    }
  }, [activeTab, selectedRequestId, scrollToBottom, userScrolled]);

  // Toggle message collapse
  const toggleMessageCollapse = (index: number) => {
    const newCollapsed = new Set(collapsedMessages);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedMessages(newCollapsed);
  };

  // Get message preview for collapsed state
  const getMessagePreview = (text: string, maxLength = 100) => {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.substring(0, maxLength)}...`;
  };

  // Reset pagination state when request changes
  useEffect(() => {
    setMsgRenderIndex(0);
    setAutoScrollEnabled(true);
    setUserScrolled(false);
    setShowScrollButton(false);
    setShowScrollTopButton(false);
    setIsLoadingMore(false);
    setShouldScrollToTop(false);
  }, [selectedRequestId]);

  // Update render index when messages change and auto-scroll is enabled
  useEffect(() => {
    if (selectedRequest.messages && selectedRequest.messages.length > 0 && autoScrollEnabled) {
      const messageCount = selectedRequest.messages.length;
      const newIndex = Math.max(0, messageCount - PAYLOAD_RENDER_BUFFER_MULTIPLIER * PAYLOAD_PAGE_SIZE);
      setMsgRenderIndex(newIndex);
    }
  }, [selectedRequest.messages, autoScrollEnabled]);

  // Initialize collapsed state for all messages when request changes
  useEffect(() => {
    const allMessageIndices: Set<number> = new Set(selectedRequest.messages.map((_: any, index: number) => index));
    setCollapsedMessages(allMessageIndices);
  }, [selectedRequest.messages]);

  // Calculate which messages to render based on pagination
  const getVisibleMessages = () => {
    if (!selectedRequest.messages) {
      return [];
    }
    const startIndex = msgRenderIndex;
    const endIndex = Math.min(selectedRequest.messages.length, msgRenderIndex + PAYLOAD_RENDER_BUFFER_MULTIPLIER * PAYLOAD_PAGE_SIZE);
    return selectedRequest.messages.slice(startIndex, endIndex);
  };

  // Generate concatenated content for completion requests
  const getConcatenatedContent = () => {
    const systemPrompt = selectedRequest.systemPrompt || "";
    const messagesText = selectedRequest.messages.map((message: any) => message.text || "").join("\n\n");
    return systemPrompt ? `${systemPrompt}\n\n${messagesText}` : messagesText;
  };

  return (
    <div className="h-full p-0 m-0 relative bg-background">
      <ScrollArea ref={payloadScrollRef} className="h-full custom-scrollbar">
        <div className="p-6 space-y-6">
          {/* Completion View Mode Tabs */}
          {isCompletion ? (
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "split" | "concatenated")} className="w-full">
              <div className="flex justify-center mb-4">
                <TabsList className="grid w-auto grid-cols-2">
                  <TabsTrigger value="split" className="flex items-center gap-2">
                    <Split className="h-4 w-4" />
                    Split View
                  </TabsTrigger>
                  <TabsTrigger value="concatenated" className="flex items-center gap-2">
                    <Merge className="h-4 w-4" />
                    Concatenated
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="concatenated" className="mt-0">
                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Merge className="h-4 w-4" />
                      </div>
                      <span>Concatenated Content</span>
                      <Badge variant="secondary" className="text-xs font-normal">
                        System + Messages
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <MarkdownTextArea useEditorOnly={true} editable={false} className="text-sm font-mono bg-transparent border-0 p-0 min-h-0" initialValue={getConcatenatedContent()} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="split" className="mt-0 space-y-6">
                {/* System Prompt Section */}
                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Settings className="h-4 w-4" />
                        </div>
                        <span>System Prompt</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSystemPromptCollapsed(!systemPromptCollapsed)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                          {systemPromptCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {!systemPromptCollapsed ? (
                      <MarkdownTextArea
                        editable={false}
                        useEditorOnly={true}
                        className="text-sm font-mono bg-transparent border-0 p-0 min-h-0"
                        initialValue={selectedRequest.systemPrompt || "No system prompt provided"}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground italic">{getMessagePreview(selectedRequest.systemPrompt || "No system prompt provided", 150)}</div>
                    )}
                  </CardContent>
                </Card>

                {/* Messages Section */}
                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-3">
                        <span>Conversation Messages</span>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {selectedRequest.messages.length} messages
                        </Badge>
                        {selectedRequest.messages.length > PAYLOAD_RENDER_BUFFER_MULTIPLIER * PAYLOAD_PAGE_SIZE && (
                          <Badge variant="outline" className="text-xs font-normal">
                            Showing {getVisibleMessages().length} of {selectedRequest.messages.length}
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {/* Show indicator when there are earlier messages */}
                    {msgRenderIndex > 0 && (
                      <div className="flex justify-center py-2 text-sm text-muted-foreground">
                        <div className="bg-muted rounded-lg px-3 py-1 text-center">
                          {isLoadingMore ? <span className="text-xs">Loading earlier messages...</span> : <span className="text-xs">Scroll up to load earlier messages</span>}
                        </div>
                      </div>
                    )}

                    {getVisibleMessages().map((message: any, visibleIndex: number) => {
                      const actualIndex = msgRenderIndex + visibleIndex;
                      const isUser = message.role === "user";
                      const isCollapsed = collapsedMessages.has(actualIndex);
                      const messageText = message.text || "";
                      const shouldShowCollapse = messageText.length > 200;

                      return (
                        <div key={actualIndex} className="space-y-2">
                          {visibleIndex > 0 && <Separator className="my-4" />}

                          {/* Message Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-lg ${!isUser ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
                                {isUser ? <User className="h-4 w-4 text-muted-foreground" /> : <Bot className="h-4 w-4" />}
                              </div>
                              <Badge variant={isUser ? "secondary" : "default"} className="text-xs font-medium capitalize">
                                {message.role}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              {shouldShowCollapse && (
                                <Button variant="ghost" size="sm" onClick={() => toggleMessageCollapse(actualIndex)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                  {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Message Content */}
                          <div className={`rounded-lg border ${isCollapsed ? "p-4" : "p-0"} ${isUser ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"}`}>
                            {!isCollapsed ? (
                              <MarkdownTextArea editable={false} useEditorOnly={true} className="text-sm font-mono bg-transparent border-0 p-0 min-h-0" initialValue={messageText} />
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                {getMessagePreview(messageText, 200)}
                                <Button variant="link" size="sm" onClick={() => toggleMessageCollapse(actualIndex)} className="ml-2 h-auto p-0 text-xs text-primary hover:text-primary/80">
                                  Show more
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Show indicator when there are later messages */}
                    {msgRenderIndex + getVisibleMessages().length < selectedRequest.messages.length && (
                      <div className="flex justify-center py-2 text-sm text-muted-foreground">
                        <div className="bg-muted rounded-lg px-3 py-1 text-center">
                          {isLoadingMore ? <span className="text-xs">Loading more recent messages...</span> : <span className="text-xs">Scroll down to load more recent messages</span>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {/* Non-completion requests - original layout */}
              {/* System Prompt Section */}
              <Card className="border border-border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Settings className="h-4 w-4" />
                      </div>
                      <span>System Prompt</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSystemPromptCollapsed(!systemPromptCollapsed)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                        {systemPromptCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {!systemPromptCollapsed ? (
                    <MarkdownTextArea
                      editable={false}
                      useEditorOnly={true}
                      className="text-sm font-mono bg-transparent border-0 p-0 min-h-0"
                      initialValue={selectedRequest.systemPrompt || "No system prompt provided"}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground italic">{getMessagePreview(selectedRequest.systemPrompt || "No system prompt provided", 150)}</div>
                  )}
                </CardContent>
              </Card>

              {/* Messages Section */}
              <Card className="border border-border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-3">
                      <span>Conversation Messages</span>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {selectedRequest.messages.length} messages
                      </Badge>
                      {selectedRequest.messages.length > PAYLOAD_RENDER_BUFFER_MULTIPLIER * PAYLOAD_PAGE_SIZE && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Showing {getVisibleMessages().length} of {selectedRequest.messages.length}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {/* Show indicator when there are earlier messages */}
                  {msgRenderIndex > 0 && (
                    <div className="flex justify-center py-2 text-sm text-muted-foreground">
                      <div className="bg-muted rounded-lg px-3 py-1 text-center">
                        {isLoadingMore ? <span className="text-xs">Loading earlier messages...</span> : <span className="text-xs">Scroll up to load earlier messages</span>}
                      </div>
                    </div>
                  )}

                  {getVisibleMessages().map((message: any, visibleIndex: number) => {
                    const actualIndex = msgRenderIndex + visibleIndex;
                    const isUser = message.role === "user";
                    const isCollapsed = collapsedMessages.has(actualIndex);
                    const messageText = message.text || "";
                    const shouldShowCollapse = messageText.length > 200;

                    return (
                      <div key={actualIndex} className="space-y-2">
                        {visibleIndex > 0 && <Separator className="my-4" />}

                        {/* Message Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${!isUser ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
                              {isUser ? <User className="h-4 w-4 text-muted-foreground" /> : <Bot className="h-4 w-4" />}
                            </div>
                            <Badge variant={isUser ? "secondary" : "default"} className="text-xs font-medium capitalize">
                              {message.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {shouldShowCollapse && (
                              <Button variant="ghost" size="sm" onClick={() => toggleMessageCollapse(actualIndex)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Message Content */}
                        <div className={`rounded-lg border ${isCollapsed ? "p-4" : "p-0"} ${isUser ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"}`}>
                          {!isCollapsed ? (
                            <MarkdownTextArea editable={false} useEditorOnly={true} className="text-sm font-mono bg-transparent border-0 p-0 min-h-0" initialValue={messageText} />
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {getMessagePreview(messageText, 200)}
                              <Button variant="link" size="sm" onClick={() => toggleMessageCollapse(actualIndex)} className="ml-2 h-auto p-0 text-xs text-primary hover:text-primary/80">
                                Show more
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Show indicator when there are later messages */}
                  {msgRenderIndex + getVisibleMessages().length < selectedRequest.messages.length && (
                    <div className="flex justify-center py-2 text-sm text-muted-foreground">
                      <div className="bg-muted rounded-lg px-3 py-1 text-center">
                        {isLoadingMore ? <span className="text-xs">Loading more recent messages...</span> : <span className="text-xs">Scroll down to load more recent messages</span>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Scroll to top button */}
      {showScrollTopButton && (
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 right-4 rounded-full shadow-lg bg-background/95 backdrop-blur-sm z-10 border-border hover:bg-accent"
          onClick={scrollToTop}
          title="Scroll to top"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full shadow-lg bg-background/95 backdrop-blur-sm z-10 border-border hover:bg-accent"
          onClick={() => scrollToBottom()}
          title="Scroll to bottom"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
