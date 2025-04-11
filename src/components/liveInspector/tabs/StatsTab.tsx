import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ConsoleRequest } from "@/hooks/consoleStore";
import { BarChart } from "lucide-react";
import React from "react";

interface StatsProps {
  selectedRequest: ConsoleRequest;
}

export const Stats: React.FC<StatsProps> = ({ selectedRequest }) => {
  const totalTokens =
    selectedRequest.statistics!.responseTokens + selectedRequest.statistics!.systemTokens + selectedRequest.statistics!.historyTokens;

  return (
    <div className="h-full p-0 m-0">
      <ScrollArea className="h-full custom-scrollbar">
        <div className="p-6 space-y-6">
          {selectedRequest.statistics ? (
            <>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-primary" />
                  Token Usage Statistics
                </h3>

                <div className="space-y-6 mt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>System Tokens</span>
                      <span className="font-mono">{selectedRequest.statistics.systemTokens.toLocaleString()}</span>
                    </div>
                    <Progress value={(selectedRequest.statistics.systemTokens / totalTokens) * 100} className="h-3 bg-muted" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>History Tokens</span>
                      <span className="font-mono">{selectedRequest.statistics.historyTokens.toLocaleString()}</span>
                    </div>
                    <Progress
                      value={(selectedRequest.statistics.historyTokens / totalTokens) * 100}
                      className="h-3 bg-muted"
                      indicatorClassName="bg-[hsl(var(--chart-2))]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Response Tokens</span>
                      <span className="font-mono">{(selectedRequest.statistics.responseTokens || totalTokens).toLocaleString()}</span>
                    </div>
                    <Progress
                      value={
                        ((selectedRequest.parameters.max_tokens ||
                          selectedRequest.statistics.responseTokens -
                            selectedRequest.statistics.systemTokens -
                            selectedRequest.statistics.historyTokens) /
                          totalTokens) *
                        100
                      }
                      className="h-3 bg-muted"
                      indicatorClassName="bg-[hsl(var(--chart-3))]"
                    />
                  </div>

                  <Separator className="my-4" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Tokens</span>
                    <Badge variant="outline" className="text-base font-mono px-3 py-1">
                      {totalTokens.toLocaleString()} / {selectedRequest.parameters.max_context}
                    </Badge>
                  </div>

                  <div className="mt-6 p-4 bg-muted/30 rounded-lg border text-sm text-muted-foreground">
                    <p className="mb-2 font-medium">Token Usage Information</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>System tokens are used for the system prompt</li>
                      <li>History tokens represent the conversation context</li>
                      <li>Response tokens show the model's output size</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <BarChart className="w-8 h-8 mb-2" />
              <span>No token statistics available</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
