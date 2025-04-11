import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConsoleStoreRequests } from "@/hooks/consoleStore";
import { useModels } from "@/hooks/modelsStore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp, FileQuestion, Inbox, SearchX } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownTextArea } from "../markdownRender/markdown-textarea";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

interface LiveInspectorProps {
  maxHeight?: string;
}

export const LiveInspector: React.FC<LiveInspectorProps> = ({ maxHeight = "100%" }) => {
  const requests = useConsoleStoreRequests();
  const modelList = useModels();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(requests.length > 0 ? requests[0].id : null);
  const [activeTab, setActiveTab] = useState("payload");
  const payloadScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);

  // Update selected request when requests change
  useEffect(() => {
    if (requests.length > 0 && !requests.some((r) => r.id === selectedRequestId)) {
      setSelectedRequestId(requests[0].id);
    }
  }, [requests, selectedRequestId]);

  // Handle scroll events to detect when user scrolls up or down
  const handleScroll = useCallback(() => {
    if (payloadScrollRef.current && activeTab === "payload") {
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
  }, [activeTab]);

  // Attach scroll event listener
  useEffect(() => {
    const scrollContainer = payloadScrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, payloadScrollRef, activeTab]);

  // Scroll to bottom function
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
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
  }, []);

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
  }, []);

  // Scroll to bottom of payload when tab is active or request changes
  useEffect(() => {
    if (activeTab === "payload" && payloadScrollRef.current && !userScrolled) {
      scrollToBottom("auto");
    }
  }, [activeTab, selectedRequestId, scrollToBottom, userScrolled]);

  const selectedRequest = requests.find((req) => req.id === selectedRequestId);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatMarkdownValue = (value: string) => {
    return `\`\`\`\`\`markdown\n${value}\n\`\`\`\`\``;
  };
  const markdownClass = cn("p-3 rounded text-xs font-mono w-auto max-w-[90vw]");

  return (
    <Card className="w-full overflow-hidden border rounded-lg">
      <CardHeader className="p-4 bg-card border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Badge variant="outline" className="ml-2 text-xs font-normal">
            {requests.length} Requests
          </Badge>
        </CardTitle>
      </CardHeader>
      <ResizablePanelGroup direction="horizontal" className="min-h-[70vh]" style={{ maxHeight }}>
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <ScrollArea className="h-full custom-scrollbar">
            <div className="p-2">
              {requests.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground p-4 text-center">
                  <Inbox className="w-10 h-10 mb-3" />
                  <span className="text-sm">No requests captured yet.</span>
                </div>
              )}
              {requests.map((request) => (
                <>
                  <Separator key={request.id} className="my-2" />
                  <div
                    key={request.id}
                    className={`px-3 py-2.5 cursor-pointer transition-colors rounded-md hover:bg-accent ${
                      selectedRequestId === request.id
                        ? "bg-accent text-accent-foreground font-semibold border-l-2 border-primary"
                        : "border-l-2 border-transparent"
                    }`}
                    onClick={() => setSelectedRequestId(request.id)}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="text-sm font-medium truncate">{formatTimestamp(request.timestamp)}</div>
                      <Badge className="text-xs flex-shrink-0" variant="secondary">
                        {modelList.find((model) => model.id === request.modelSpecs.id)?.name}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{request.fullResponse}</div>
                    <div className="text-xs text-muted-foreground/80 mt-1 italic">
                      {formatDistanceToNow(new Date(request.timestamp), { addSuffix: true })}
                    </div>
                  </div>
                </>
              ))}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70}>
          <div className="h-full flex flex-col">
            {selectedRequest ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                <div className="px-4 py-2 border-b">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="payload">Payload</TabsTrigger>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="response">Response</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="payload" className="h-full p-0 m-0 relative">
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
                          {selectedRequest.messages.map((message, index) => (
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

                    {/* Scroll to top button */}
                    {showScrollTopButton && activeTab === "payload" && (
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

                    {/* Scroll to bottom button */}
                    {showScrollButton && activeTab === "payload" && (
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
                  </TabsContent>

                  <TabsContent value="parameters" className="h-full p-0 m-0">
                    <ScrollArea className="h-full custom-scrollbar">
                      <div className="p-4 space-y-4">
                        <div>
                          <div className="text-sm font-medium mb-1 text-foreground/80">Model Specs</div>
                          <MarkdownTextArea
                            editable={false}
                            className={markdownClass}
                            initialValue={formatMarkdownValue(JSON.stringify(selectedRequest.modelSpecs, null, 2))}
                          />
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-1 text-foreground/80">Parameters</div>
                          <MarkdownTextArea
                            editable={false}
                            className={markdownClass}
                            initialValue={formatMarkdownValue(JSON.stringify(selectedRequest.parameters, null, 2))}
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="response" className="h-full p-0 m-0">
                    <ScrollArea className="h-full custom-scrollbar">
                      <div className="p-4">
                        {selectedRequest.fullResponse ? (
                          <MarkdownTextArea
                            editable={false}
                            className={markdownClass}
                            initialValue={formatMarkdownValue(selectedRequest.fullResponse)}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <FileQuestion className="w-8 h-8 mb-2" />
                            <span>No response data available</span>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <SearchX className="w-10 h-10 mb-3" />
                <span className="text-sm">Select a request from the list</span>
                <span className="text-xs mt-1">to view its details here.</span>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Card>
  );
};
