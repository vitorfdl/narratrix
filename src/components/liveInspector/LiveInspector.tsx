import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConsoleStoreActions, useConsoleStoreRequests } from "@/hooks/consoleStore";
import { useModels } from "@/hooks/modelsStore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Inbox, SearchX, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Separator } from "../ui/separator";
import { Parameters } from "./tabs/ParametersTab";
import { Payload } from "./tabs/PayloadTab";
// Import new tab components
import { Response } from "./tabs/ResponseTab";
import { Stats } from "./tabs/StatsTab";

interface LiveInspectorProps {
  maxHeight?: string;
}

export const formatMarkdownValue = (value: string) => {
  return `\`\`\`\`\`markdown\n${value}\n\`\`\`\`\``;
};
export const markdownClass = cn("p-3 rounded text-xs font-mono w-auto max-w-[90vw]");

export const LiveInspector: React.FC<LiveInspectorProps> = ({ maxHeight = "100%" }) => {
  const requests = useConsoleStoreRequests();
  const { clearHistory } = useConsoleStoreActions();
  const modelList = useModels();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(requests.length > 0 ? requests[0].id : null);
  const [activeTab, setActiveTab] = useState("payload");

  // Update selected request when requests change
  useEffect(() => {
    if (requests.length > 0 && !requests.some((r) => r.id === selectedRequestId)) {
      setSelectedRequestId(requests[0].id);
    }
  }, [requests, selectedRequestId]);

  const selectedRequest = requests.find((req) => req.id === selectedRequestId);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

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
          <div className="flex flex-col h-full">
            <div className="p-2 flex justify-end border-b">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                onClick={() => clearHistory()}
                disabled={requests.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear History
              </Button>
            </div>
            <ScrollArea className="h-full custom-scrollbar">
              <div className="p-2">
                {requests.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground p-4 text-center">
                    <Inbox className="w-10 h-10 mb-3" />
                    <span className="text-sm">No requests captured yet.</span>
                  </div>
                )}
                {requests.map((request) => (
                  <React.Fragment key={request.id}>
                    <Separator className="my-2" />
                    <div
                      className={`px-3 py-2.5 cursor-pointer transition-colors rounded-md hover:bg-accent ${
                        selectedRequestId === request.id ? "bg-accent text-accent-foreground font-semibold border-l-2 border-primary" : "border-l-2 border-transparent"
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
                      <div className="text-xs text-muted-foreground/80 mt-1 italic">{formatDistanceToNow(new Date(request.timestamp), { addSuffix: true })}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70}>
          <div className="h-full flex flex-col">
            {selectedRequest ? (
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  setActiveTab(value);
                }}
                className="flex flex-col h-full"
              >
                <div className="px-4 py-2 border-b">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="payload">Payload</TabsTrigger>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="response">Response</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="payload" className="h-full p-0 m-0 relative">
                    <Payload selectedRequest={selectedRequest} activeTab={activeTab} selectedRequestId={selectedRequestId!} />
                  </TabsContent>

                  <TabsContent value="parameters" className="h-full p-0 m-0">
                    <Parameters selectedRequest={selectedRequest} />
                  </TabsContent>

                  <TabsContent value="response" className="h-full p-0 m-0">
                    <Response selectedRequest={selectedRequest} />
                  </TabsContent>

                  <TabsContent value="stats" className="h-full p-0 m-0">
                    <Stats selectedRequest={selectedRequest} />
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
