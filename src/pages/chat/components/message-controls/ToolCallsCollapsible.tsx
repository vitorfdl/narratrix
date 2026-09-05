import { ChevronDown, Wrench } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { MessageToolCall } from "@/schema/chat-message-schema";

function formatArgs(args: MessageToolCall["arguments"]): string {
  if (typeof args === "string") {
    return args;
  }
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

/**
 * Renders the tool calls an assistant message made during generation. Mirrors the
 * ReasoningSection collapsible. Each entry shows the tool name, arguments, and the
 * resolved result (or error, or a running indicator while it is in flight).
 */
export const ToolCallsSection = ({ toolCalls }: { toolCalls: MessageToolCall[] }) => {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <Collapsible className="mt-4 px-3 pt-2 pb-1 bg-accent/40 rounded-lg border border-border text-sm relative animate-in fade-in duration-300">
      <CollapsibleTrigger className="w-full font-medium text-xs flex items-center gap-1.5 text-muted-foreground border-b border-border/50 pb-1.5 cursor-pointer hover:text-primary">
        <Wrench className="w-3 h-3 text-primary" />
        <span>
          Tool {toolCalls.length === 1 ? "Call" : "Calls"} ({toolCalls.length})
        </span>
        <ChevronDown className="w-4 h-4 ml-auto transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden transition-all data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="space-y-2 pt-2">
          {toolCalls.map((call, index) => (
            <div key={call.id ?? `${call.name}-${index}`} className="rounded-md border border-border/50 bg-background/40 p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Wrench className="w-3 h-3 text-primary" />
                <span className="text-xs font-semibold">{call.name}</span>
              </div>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono">{formatArgs(call.arguments)}</pre>
              {call.error ? (
                <p className="mt-1 text-[11px] text-destructive whitespace-pre-wrap break-words">Error: {call.error}</p>
              ) : call.result !== undefined ? (
                <div className="mt-1 border-t border-border/30 pt-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5">Result</p>
                  <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono">{call.result}</pre>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground italic">Running…</p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

/**
 * A single tool call rendered inline, at its position within the message text. Collapsed by
 * default; expands to show arguments and the result/error. Block-level so it separates the
 * text that came before it from the text that follows.
 */
export const ToolCallInline = ({ call }: { call: MessageToolCall }) => {
  return (
    <Collapsible className="my-2 rounded-md border border-border bg-accent/30 text-sm animate-in fade-in duration-300">
      <CollapsibleTrigger className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground cursor-pointer hover:text-primary">
        <Wrench className="w-3 h-3 text-primary shrink-0" />
        <span className="font-medium text-foreground">{call.name}</span>
        {call.error ? (
          <span className="text-destructive">· failed</span>
        ) : call.result !== undefined ? (
          <span className="text-green-600 dark:text-green-400">· done</span>
        ) : (
          <span className="italic">· running…</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden transition-all data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="px-2.5 pb-2 space-y-1">
          <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono">{formatArgs(call.arguments)}</pre>
          {call.error ? (
            <p className="text-[11px] text-destructive whitespace-pre-wrap break-words">Error: {call.error}</p>
          ) : call.result !== undefined ? (
            <div className="border-t border-border/30 pt-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5">Result</p>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono">{call.result}</pre>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
