import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentType } from "@/schema/agent-schema";
import { X } from "lucide-react";

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
  // Get unique tags from all agents
  const uniqueTags = Array.from(new Set(agents.flatMap((agent) => agent.tags || []))).sort();

  // Count agents for each tag
  const tagCounts = uniqueTags.reduce(
    (acc, tag) => {
      if (tag) {
        acc[tag] = agents.filter((agent) => agent.tags?.includes(tag)).length;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalAgents = agents.length;
  const filteredAgentsCount = selectedTags.length > 0 ? agents.filter((agent) => selectedTags.every((tag) => agent.tags?.includes(tag))).length : totalAgents;

  return (
    <div className="w-44 border-r border-border bg-background/95">
      <ScrollArea className="h-[calc(100vh-4rem)]">
        {/* All Agents Header */}
        <div className="py-2 px-3 font-medium text-base flex items-center gap-2">
          <span>All Agents</span>
          <span className="text-muted-foreground ml-auto">({filteredAgentsCount})</span>
        </div>

        {/* Active Filters Indicator with Clear button */}
        {selectedTags.length > 0 && (
          <div className="px-3 py-1 flex justify-between items-center text-xs bg-primary/10 border-y border-border">
            <span className="text-muted-foreground">
              {selectedTags.length} {selectedTags.length === 1 ? "filter" : "filters"}
            </span>
            <Button variant="ghost" size="icon" onClick={onClearTags} className="h-5 w-5 rounded-full bg-accent/50 hover:bg-accent">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Tags List */}
        <div className="ml-1">
          <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</div>
          {uniqueTags.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No tags available</p>
          ) : (
            <>
              {uniqueTags
                .filter((tag) => tag !== null)
                .map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <div
                      key={tag}
                      className={`relative flex items-center py-0.5 pl-3 cursor-pointer hover:text-primary transition-colors ${isSelected ? "bg-primary/20" : ""}`}
                      onClick={() => onTagSelect(tag)}
                    >
                      {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-primary rounded-r-sm" />}
                      <span className="font-light text-sm truncate">
                        {tag} <span className="text-muted-foreground text-xs">({tagCounts[tag]})</span>
                      </span>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
