import { formatDistanceToNow } from "date-fns";
import { Bot, ChevronRight, Cpu, Terminal, Wrench } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { LuInbox, LuSearchX, LuTrash2 } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ConsoleLogEntry, type ConsoleLogType, type NodeExecutionEntry, type ToolCallEntry, useConsoleStoreActions, useConsoleStoreLogs, useConsoleStoreRequests } from "@/hooks/consoleStore";
import { useModels } from "@/hooks/modelsStore";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { Parameters } from "./tabs/ParametersTab";
import { Payload } from "./tabs/PayloadTab";
import { Response } from "./tabs/ResponseTab";
import { Stats } from "./tabs/StatsTab";

interface LiveInspectorProps {
  maxHeight?: string;
}

export const formatMarkdownValue = (value: string) => {
  return `\`\`\`\`\`markdown\n${value}\n\`\`\`\`\``;
};
export const markdownClass = cn("p-3 rounded text-xs font-mono w-auto max-w-[90vw]");

const LOG_TYPE_CONFIG: Record<ConsoleLogType, { icon: React.ElementType; label: string; badgeClass: string }> = {
  "agent-run": { icon: Bot, label: "Agent", badgeClass: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  "tool-call": { icon: Wrench, label: "Tool", badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "node-execution": { icon: Cpu, label: "Node", badgeClass: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  "js-console": { icon: Terminal, label: "Console", badgeClass: "bg-green-500/20 text-green-400 border-green-500/30" },
};

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
  trigger: Bot,
  agent: Bot,
  javascript: Terminal,
  chatHistory: Cpu,
  chatOutput: Cpu,
  promptInjection: Cpu,
};

const ToolCallItem: React.FC<{ tc: ToolCallEntry }> = ({ tc }) => {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors text-left group">
        <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <Wrench className="h-3 w-3 flex-shrink-0 text-blue-400" />
        <span className="text-xs font-medium truncate">{tc.toolName}</span>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {tc.durationMs !== undefined && <span className="text-xs text-muted-foreground font-mono">{tc.durationMs}ms</span>}
          {tc.error && <span className="h-2 w-2 rounded-full bg-destructive flex-shrink-0" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-8 pr-3 pb-2 space-y-2">
          {tc.error && <pre className="text-xs font-mono bg-destructive/10 text-destructive border border-destructive/20 rounded p-2 whitespace-pre-wrap break-words max-h-60 overflow-auto">{tc.error}</pre>}
          {tc.input && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Input</p>
              <pre className="text-xs font-mono bg-muted/50 border border-border rounded p-2 whitespace-pre-wrap break-words max-h-60 overflow-auto">{tc.input}</pre>
            </div>
          )}
          {tc.output && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Output</p>
              <pre className="text-xs font-mono bg-muted/50 border border-border rounded p-2 whitespace-pre-wrap break-words max-h-60 overflow-auto">{tc.output}</pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const NodeExecutionItem: React.FC<{ ne: NodeExecutionEntry }> = ({ ne }) => {
  const NodeIcon = NODE_TYPE_ICONS[ne.nodeType] ?? Cpu;
  const toolCount = ne.toolCalls?.length ?? 0;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent transition-colors text-left group">
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <NodeIcon className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
        <span className="text-sm font-medium truncate">{ne.nodeLabel}</span>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {toolCount > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 bg-blue-500/20 text-blue-400 border-blue-500/30">
              {toolCount} tool{toolCount > 1 ? "s" : ""}
            </Badge>
          )}
          {ne.durationMs !== undefined && <span className="text-xs text-muted-foreground font-mono">{ne.durationMs}ms</span>}
          {ne.error && <span className="h-2 w-2 rounded-full bg-destructive flex-shrink-0" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-9 pr-3 pb-3 space-y-2">
          {ne.error && <pre className="text-xs font-mono bg-destructive/10 text-destructive border border-destructive/20 rounded p-2 whitespace-pre-wrap break-words">{ne.error}</pre>}
          {ne.output && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Output</p>
              <pre className="text-xs font-mono bg-muted/50 border border-border rounded p-2 whitespace-pre-wrap break-words max-h-60 overflow-auto">{ne.output}</pre>
            </div>
          )}
          {toolCount > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Tool Calls ({toolCount})</p>
              <div className="border border-border rounded-md divide-y divide-border">
                {ne.toolCalls!.map((tc) => (
                  <ToolCallItem key={tc.id} tc={tc} />
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const AgentRunDetailPane: React.FC<{ entry: ConsoleLogEntry }> = ({ entry }) => {
  const sortedNodes = useMemo(() => {
    return [...(entry.nodeExecutions ?? [])].sort((a, b) => {
      const aTrigger = a.nodeType === "trigger" ? 0 : 1;
      const bTrigger = b.nodeType === "trigger" ? 0 : 1;
      if (aTrigger !== bTrigger) {
        return aTrigger - bTrigger;
      }
      return a.timestamp - b.timestamp;
    });
  }, [entry.nodeExecutions]);
  const nodeCount = sortedNodes.length;

  return (
    <ScrollArea className="h-full custom-scrollbar">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Agent</p>
            <p className="text-sm font-semibold">{entry.title}</p>
          </div>
          {entry.durationMs !== undefined && (
            <div className="text-right space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Duration</p>
              <p className="text-sm font-mono">{entry.durationMs}ms</p>
            </div>
          )}
        </div>

        {entry.error && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Error</p>
            <pre className="text-xs font-mono bg-destructive/10 text-destructive border border-destructive/20 rounded p-3 whitespace-pre-wrap break-words">{entry.error}</pre>
          </div>
        )}

        {nodeCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-purple-400" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Node Executions ({nodeCount})</p>
            </div>
            <div className="border border-border rounded-md divide-y divide-border">
              {sortedNodes.map((ne) => (
                <NodeExecutionItem key={ne.id} ne={ne} />
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

const LegacyLogDetailPane: React.FC<{ entry: ConsoleLogEntry }> = ({ entry }) => {
  return (
    <ScrollArea className="h-full custom-scrollbar">
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Title</p>
          <p className="text-sm font-semibold">{entry.title}</p>
        </div>

        {entry.durationMs !== undefined && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Duration</p>
            <p className="text-sm font-mono">{entry.durationMs}ms</p>
          </div>
        )}

        {entry.nodeLabel && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Node</p>
            <p className="text-sm">{entry.nodeLabel}</p>
          </div>
        )}

        {entry.error && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Error</p>
            <pre className="text-xs font-mono bg-destructive/10 text-destructive border border-destructive/20 rounded p-3 whitespace-pre-wrap break-words">{entry.error}</pre>
          </div>
        )}

        {entry.input && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Input</p>
            <pre className="text-xs font-mono bg-muted/50 border border-border rounded p-3 whitespace-pre-wrap break-words">{entry.input}</pre>
          </div>
        )}

        {entry.output && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Output</p>
            <pre className="text-xs font-mono bg-muted/50 border border-border rounded p-3 whitespace-pre-wrap break-words">{entry.output}</pre>
          </div>
        )}

        {entry.toolCalls && entry.toolCalls.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Tool Calls ({entry.toolCalls.length})</p>
            </div>
            <div className="border border-border rounded-md divide-y divide-border">
              {entry.toolCalls.map((tc) => (
                <ToolCallItem key={tc.id} tc={tc} />
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

const LogDetailPane: React.FC<{ entry: ConsoleLogEntry }> = ({ entry }) => {
  if (entry.type === "agent-run") {
    return <AgentRunDetailPane entry={entry} />;
  }
  return <LegacyLogDetailPane entry={entry} />;
};

const LogsPanel: React.FC<{ maxHeight: string }> = ({ maxHeight }) => {
  const logs = useConsoleStoreLogs();
  const { clearLogs } = useConsoleStoreActions();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs.length > 0 ? logs[0].id : null);

  useEffect(() => {
    if (logs.length > 0 && !logs.some((l) => l.id === selectedLogId)) {
      setSelectedLogId(logs[0].id);
    }
  }, [logs, selectedLogId]);

  const selectedLog = logs.find((l) => l.id === selectedLogId);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-[70vh]" style={{ maxHeight }}>
      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
        <div className="flex flex-col h-full">
          <div className="p-2 flex justify-end border-b">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1" onClick={() => clearLogs()} disabled={logs.length === 0}>
              <LuTrash2 className="h-3.5 w-3.5" />
              Clear Logs
            </Button>
          </div>
          <ScrollArea className="h-full custom-scrollbar">
            <div className="p-2">
              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground p-4 text-center">
                  <LuInbox className="w-10 h-10 mb-3" />
                  <span className="text-sm">No logs captured yet.</span>
                </div>
              )}
              {logs.map((log) => {
                const typeConfig = LOG_TYPE_CONFIG[log.type];
                const Icon = typeConfig.icon;
                const nodeCount = log.nodeExecutions?.length ?? 0;
                return (
                  <React.Fragment key={log.id}>
                    <Separator className="my-2" />
                    <div
                      className={`px-3 py-2.5 cursor-pointer transition-colors rounded-md hover:bg-accent ${
                        selectedLogId === log.id ? "bg-accent text-accent-foreground font-semibold border-l-2 border-primary" : "border-l-2 border-transparent"
                      }`}
                      onClick={() => setSelectedLogId(log.id)}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">{log.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {log.durationMs !== undefined && <span className="text-xs text-muted-foreground font-mono">{log.durationMs}ms</span>}
                          {nodeCount > 0 && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                              {nodeCount} node{nodeCount > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 min-w-0 overflow-hidden">
                        <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{formatTimestamp(log.timestamp)}</span>
                        {log.error && <span className="text-xs text-destructive truncate">Error: {log.error}</span>}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={70}>
        <div className="h-full flex flex-col">
          {selectedLog ? (
            <LogDetailPane entry={selectedLog} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
              <LuSearchX className="w-10 h-10 mb-3" />
              <span className="text-sm">Select a log entry from the list</span>
              <span className="text-xs mt-1">to view its details here.</span>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export const LiveInspector: React.FC<LiveInspectorProps> = ({ maxHeight = "100%" }) => {
  const requests = useConsoleStoreRequests();
  const logs = useConsoleStoreLogs();
  const { clearHistory } = useConsoleStoreActions();
  const modelList = useModels();
  const [mode, setMode] = useState<"requests" | "logs">("requests");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(requests.length > 0 ? requests[0].id : null);
  const [activeTab, setActiveTab] = useState("payload");

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
      <CardHeader className="p-2 bg-card border-b">
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("requests")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${mode === "requests" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                Requests
              </button>
              <button
                type="button"
                onClick={() => setMode("logs")}
                className={`px-3 py-1 text-xs font-medium border-l border-border transition-colors ${mode === "logs" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                Agent Logs
              </button>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            {mode === "requests" ? `${requests.length} Requests` : `${logs.length} Logs`}
          </Badge>
        </CardTitle>
      </CardHeader>

      {mode === "logs" ? (
        <LogsPanel maxHeight={maxHeight} />
      ) : (
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
                  <LuTrash2 className="h-3.5 w-3.5" />
                  Clear History
                </Button>
              </div>
              <ScrollArea className="h-full custom-scrollbar">
                <div className="p-2">
                  {requests.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground p-4 text-center">
                      <LuInbox className="w-10 h-10 mb-3" />
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
                  <LuSearchX className="w-10 h-10 mb-3" />
                  <span className="text-sm">Select a request from the list</span>
                  <span className="text-xs mt-1">to view its details here.</span>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </Card>
  );
};
