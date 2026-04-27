import { Bot, Hash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentType } from "@/schema/agent-schema";

interface AgentSidebarProps {
  agents: AgentType[];
  selectedTags: string[];
  onTagSelect: (tag: string) => void;
  onClearTags?: () => void;
}

export function AgentSidebar({
  agents,
  selectedTags,
  onTagSelect,
  onClearTags = () => {
    for (const tag of selectedTags) {
      onTagSelect(tag);
    }
  },
}: AgentSidebarProps) {
  const uniqueTags = Array.from(new Set(agents.flatMap((agent) => agent.tags ?? []).filter((tag): tag is string => Boolean(tag)))).sort((a, b) => a.localeCompare(b));

  const tagCounts = uniqueTags.reduce(
    (acc, tag) => {
      acc[tag] = agents.filter((agent) => agent.tags?.includes(tag)).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalAgents = agents.length;
  const filteredAgentsCount = selectedTags.length > 0 ? agents.filter((agent) => selectedTags.every((tag) => agent.tags?.includes(tag))).length : totalAgents;

  return (
    <aside className="w-56 shrink-0 border-r border-border/70 bg-card/35 backdrop-blur-sm max-lg:w-48">
      <ScrollArea className="h-full">
        <div className="space-y-4 px-3 py-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <span>All Agents</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                <div className="text-muted-foreground">Total</div>
                <div className="text-sm font-semibold">{totalAgents}</div>
              </div>
              <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                <div className="text-muted-foreground">Shown</div>
                <div className="text-sm font-semibold">{filteredAgentsCount}</div>
              </div>
            </div>
          </div>

          {selectedTags.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs">
              <span className="text-primary">
                {selectedTags.length} active {selectedTags.length === 1 ? "tag" : "tags"}
              </span>
              <Button variant="ghost" size="icon" onClick={onClearTags} className="h-6 w-6 rounded-full hover:bg-primary/15" title="Clear tag filters">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              Tags
            </div>

            {uniqueTags.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-background/40 px-3 py-4 text-center text-xs text-muted-foreground">No tags available</p>
            ) : (
              <div className="space-y-1">
                {uniqueTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        isSelected ? "bg-primary/15 text-primary ring-1 ring-primary/25" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                      onClick={() => onTagSelect(tag)}
                    >
                      <span className="min-w-0 flex-1 truncate">{tag}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{tagCounts[tag]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
