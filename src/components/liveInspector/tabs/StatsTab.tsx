import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConsoleRequest } from "@/hooks/consoleStore";
import { USE_TOKENIZER, getTokenCount } from "@/services/inference-steps/apply-context-limit";
import { BarChart, Info, PieChart as PieChartIcon, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Label, Pie, PieChart } from "recharts";

interface StatsProps {
  selectedRequest: ConsoleRequest;
}

// Define Chart Configuration using theme colors
const chartConfig = {
  systemTokens: {
    label: "System",
    color: "hsl(var(--chart-7))",
  },
  historyTokens: {
    label: "History",
    color: "hsl(var(--chart-8))",
  },
  responseTokens: {
    label: "Response",
    color: "hsl(var(--chart-3))",
  },
  contextUtilization: {
    label: "Context",
    color: "hsl(var(--chart-4))",
  },
  responseUtilization: {
    label: "Response Limit",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

// Custom CircularProgress component
const CircularProgress = ({
  percentage,
  size = 150,
  strokeWidth = 10,
  color,
  sublabel,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        {/* Background circle */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold text-foreground">{percentage.toFixed(1)}%</span>
        <span className="text-xs text-muted-foreground mt-1">{sublabel}</span>
      </div>
    </div>
  );
};

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

  // Memoize chart data calculations
  const chartData = useMemo(() => {
    if (!tokenStats) {
      return {
        tokenBreakdown: [],
        contextUtilization: [],
        responseUtilization: [],
        totalTokens: 0,
        contextUtilizationPercentage: 0,
        responseUtilizationPercentage: 0,
        avgTokensPerHistory: 0,
        totalMessageCount: 0,
      };
    }

    const { responseTokens, systemTokens, historyTokens, totalMessageCount } = tokenStats;
    const totalTokens = responseTokens + systemTokens + historyTokens;
    const maxContext = selectedRequest.parameters.max_context || 1; // Avoid division by zero
    const maxResponseTokens = selectedRequest.parameters.max_tokens || 1; // Avoid division by zero
    const contextUtilizationPercentage = Math.min((totalTokens / maxContext) * 100, 100);
    const responseUtilizationPercentage = Math.min((responseTokens / maxResponseTokens) * 100, 100);
    const avgTokensPerHistory = totalMessageCount > 0 ? Math.round(historyTokens / totalMessageCount) : 0;

    const tokenBreakdown = [
      { name: "systemTokens", value: systemTokens, fill: "hsl(var(--chart-7))" },
      { name: "historyTokens", value: historyTokens, fill: "hsl(var(--chart-8))" },
      { name: "responseTokens", value: responseTokens, fill: "hsl(var(--chart-3))" },
    ];

    // Data for radial charts (needs a 'value' for the bar and potentially 'fill')
    const contextUtilization = [{ name: "contextUtilization", value: contextUtilizationPercentage, fill: "var(--color-contextUtilization)" }];
    const responseUtilization = [{ name: "responseUtilization", value: responseUtilizationPercentage, fill: "var(--color-responseUtilization)" }];

    return {
      tokenBreakdown,
      contextUtilization,
      responseUtilization,
      totalTokens,
      contextUtilizationPercentage,
      responseUtilizationPercentage,
      avgTokensPerHistory,
      totalMessageCount,
    };
  }, [tokenStats, selectedRequest.parameters]);

  if (!tokenStats) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
        <BarChart className="w-10 h-10 mb-3 animate-pulse" />
        <span className="text-sm">Calculating token statistics...</span>
      </div>
    );
  }

  const { tokenBreakdown, totalTokens, contextUtilizationPercentage, responseUtilizationPercentage, avgTokensPerHistory, totalMessageCount } =
    chartData;

  const maxContext = selectedRequest.parameters.max_context || 1;
  const maxResponseTokens = selectedRequest.parameters.max_tokens || 1;

  return (
    <TooltipProvider>
      <div className="h-full p-0 m-0">
        <ScrollArea className="h-full custom-scrollbar">
          <div className="p-6 space-y-8">
            {/* Token Breakdown Chart */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-primary" />
                Token Breakdown
              </h3>
              <div className="flex items-center gap-8 max-w-[600px] mx-auto">
                {/* Pie Chart */}
                <div className="flex-shrink-0 w-[250px]">
                  <ChartContainer config={chartConfig} className="aspect-square max-h-[250px]">
                    <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Pie data={tokenBreakdown} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                                    {totalTokens.toLocaleString()}
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-sm">
                                    Tokens
                                  </tspan>
                                </text>
                              );
                            }
                          }}
                        />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>

                {/* Individual Token Counts - Side Layout */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-[hsl(var(--chart-7))]/50">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: chartConfig.systemTokens.color }} />
                      <span className="text-sm font-medium">System</span>
                    </span>
                    <span className="font-mono text-sm">{tokenStats.systemTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-[hsl(var(--chart-8))]/50">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: chartConfig.historyTokens.color }} />
                      <span className="text-sm font-medium">History</span>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>Actual / Estimated (Internal)</TooltipContent>
                      </Tooltip>
                    </span>
                    <span className="font-mono text-sm">
                      {tokenStats.historyTokens.toLocaleString()} /{" "}
                      <span className="text-xs text-muted-foreground">{tokenStats.historyTokenEstimation.toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-[hsl(var(--chart-3))]/50">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: chartConfig.responseTokens.color }} />
                      <span className="text-sm font-medium">Response</span>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>Actual / Reserved Maximum</TooltipContent>
                      </Tooltip>
                    </span>
                    <span className="font-mono text-sm">
                      {tokenStats.responseTokens.toLocaleString()} /{" "}
                      <span className="text-xs text-muted-foreground">{maxResponseTokens.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Utilization Gauges - REPLACED WITH CUSTOM SVG CIRCLES */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Utilization Metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Context Utilization Gauge - Custom SVG Circle */}
                <div className="flex flex-col items-center space-y-2">
                  <CircularProgress
                    percentage={contextUtilizationPercentage}
                    color={chartConfig.contextUtilization.color}
                    label={`${contextUtilizationPercentage.toFixed(1)}%`}
                    sublabel="Context Used"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {totalTokens.toLocaleString()} / {maxContext.toLocaleString()} Tokens
                  </span>
                </div>

                {/* Response Utilization Gauge - Custom SVG Circle */}
                <div className="flex flex-col items-center space-y-2">
                  <CircularProgress
                    percentage={responseUtilizationPercentage}
                    color={chartConfig.responseUtilization.color}
                    label={`${responseUtilizationPercentage.toFixed(1)}%`}
                    sublabel="Response Limit"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {tokenStats.responseTokens.toLocaleString()} / {maxResponseTokens.toLocaleString()} Tokens
                  </span>
                </div>
              </div>
            </div>

            {/* Message Metrics - Kept as Cards */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Message Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-muted/20 rounded-lg p-4 border">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Total Messages</span>
                    <span className="text-2xl font-mono mt-1">{totalMessageCount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="bg-muted/20 rounded-lg p-4 border">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Avg Tokens / Message</span>
                    <span className="text-2xl font-mono mt-1">{avgTokensPerHistory.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Information Box */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border text-sm text-muted-foreground">
              <p className="mb-2 font-medium">Token Usage Information</p>
              <ul className="list-disc list-inside space-y-1">
                <li>System tokens are used for the system prompt.</li>
                <li>History tokens represent the conversation context (Actual / Estimated).</li>
                <li>Response tokens show the model's output size vs. the reserved maximum.</li>
                <li>Context Utilization shows the percentage of the maximum context window used.</li>
                <li>Total Messages reflects the number of turns in the history.</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};
