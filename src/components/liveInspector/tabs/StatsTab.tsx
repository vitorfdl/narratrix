import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConsoleRequest } from "@/hooks/consoleStore";
import { USE_TOKENIZER, getTokenCount } from "@/services/inference-steps/apply-context-limit";
import { BarChart, Info } from "lucide-react";
import { useEffect, useState } from "react";

interface StatsProps {
  selectedRequest: ConsoleRequest;
}

export const Stats: React.FC<StatsProps> = ({ selectedRequest }) => {
  const [tokenStats, setTokenStats] = useState<{
    responseTokens: number;
    systemTokens: number;
    historyTokens: number;
    historyTokenEstimation: number;
    totalMessageCount: number;
  } | null>(null);

  useEffect(() => {
    const calculateTokens = async () => {
      const responseTokens = await getTokenCount(selectedRequest.fullResponse || "", USE_TOKENIZER);
      const systemTokens = await getTokenCount(selectedRequest.systemPrompt || "", USE_TOKENIZER);

      const historyMessages = selectedRequest.messages.map((m) => m.text).join("");
      const historyTokens = await getTokenCount(historyMessages, USE_TOKENIZER);
      const historyTokenEstimation = await getTokenCount(historyMessages);
      const totalMessageCount = selectedRequest.messages.length;
      setTokenStats({ responseTokens, systemTokens, historyTokens, historyTokenEstimation, totalMessageCount });
    };

    setTokenStats(null); // Reset stats when request changes
    if (selectedRequest.id && selectedRequest.fullResponse !== undefined) {
      calculateTokens();
    }
  }, [selectedRequest.id, selectedRequest.fullResponse, selectedRequest.systemPrompt, selectedRequest.messages]);

  if (!tokenStats) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
        <BarChart className="w-8 h-8 mb-2" />
        <span>Calculating token statistics...</span>
      </div>
    );
  }

  const { responseTokens, systemTokens, historyTokens, historyTokenEstimation, totalMessageCount } = tokenStats;
  const totalTokens = responseTokens + systemTokens + historyTokens;
  const maxContext = selectedRequest.parameters.max_context || 1; // Avoid division by zero
  const maxResponseTokens = selectedRequest.parameters.max_tokens || 1; // Avoid division by zero
  const contextUtilizationPercentage = Math.min((totalTokens / maxContext) * 100, 100); // Cap at 100%
  const avgTokensPerHistory = totalMessageCount > 0 ? Math.round(historyTokens / totalMessageCount) : 0;

  return (
    <TooltipProvider>
      <div className="h-full p-0 m-0">
        <ScrollArea className="h-full custom-scrollbar">
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart className="w-5 h-5 text-primary" />
                Token Usage Statistics
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
                {/* System Tokens */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>System Tokens</span>
                    <span className="font-mono">{systemTokens.toLocaleString()}</span>
                  </div>
                  <Progress value={(systemTokens / totalTokens) * 100} className="h-2 bg-muted" indicatorClassName="bg-[hsl(var(--chart-1))]" />
                </div>

                {/* History Tokens */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-1">
                      History Tokens
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Actual / Estimated (Internal)</p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span className="font-mono">
                      {historyTokens.toLocaleString()} / <span className="text-muted-foreground">{historyTokenEstimation.toLocaleString()}</span>
                    </span>
                  </div>
                  <Progress value={(historyTokens / totalTokens) * 100} className="h-2 bg-muted" indicatorClassName="bg-[hsl(var(--chart-2))]" />
                </div>

                {/* Response Tokens */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-1">
                      Response Tokens
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Actual / Reserved Maximum</p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span className="font-mono">
                      {responseTokens.toLocaleString()} / <span className="text-muted-foreground">{maxResponseTokens.toLocaleString()}</span>
                    </span>
                  </div>
                  <Progress value={(responseTokens / totalTokens) * 100} className="h-2 bg-muted" indicatorClassName="bg-[hsl(var(--chart-3))]" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Token Usage</span>
                    <span>{Math.min((responseTokens / maxResponseTokens) * 100, 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Total Tokens & Context Utilization */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Tokens Used</span>
                  <Badge variant="outline" className="text-base font-mono px-3 py-1">
                    {totalTokens.toLocaleString()} / {maxContext.toLocaleString()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Context Utilization</span>
                    <span>{contextUtilizationPercentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={contextUtilizationPercentage} className="h-3 bg-muted" />
                </div>
              </div>

              <Separator className="my-6" />

              {/* Message Metrics - Separated Section */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold">Message Statistics</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Total Messages */}
                  <div className="bg-muted/20 rounded-lg p-4 border">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Total Messages</span>
                      <span className="text-2xl font-mono mt-1">{totalMessageCount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Average Tokens per Message */}
                  <div className="bg-muted/20 rounded-lg p-4 border">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Avg Tokens / Message</span>
                      <span className="text-2xl font-mono mt-1">{avgTokensPerHistory.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg border text-sm text-muted-foreground">
                <p className="mb-2 font-medium">Token Usage Information</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>System tokens are used for the system prompt.</li>
                  <li>History tokens represent the conversation context (Actual / Estimated).</li>
                  <li>Response tokens show the model's output size.</li>
                  <li>Total Messages reflects the number of turns in the history.</li>
                  <li>Context Utilization shows the percentage of the maximum context window used.</li>
                </ul>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};
