import { Bot, CalendarClock, GitBranch, Heart, Network, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AgentType } from "@/schema/agent-schema";

interface AgentCardProps {
  agent: AgentType;
  cardSize: "small" | "medium" | "large";
  onEdit: (agent: AgentType) => void;
  onDelete: (agent: AgentType) => void;
  onToggleFavorite: (agent: AgentType) => void;
}

const cardSizeClasses: Record<AgentCardProps["cardSize"], { body: string; title: string; description: string; tagLimit: number }> = {
  small: {
    body: "p-4",
    title: "text-sm",
    description: "line-clamp-2",
    tagLimit: 3,
  },
  medium: {
    body: "p-5",
    title: "text-base",
    description: "line-clamp-2",
    tagLimit: 4,
  },
  large: {
    body: "p-6",
    title: "text-lg",
    description: "line-clamp-3",
    tagLimit: 6,
  },
};

export function AgentCard({ agent, cardSize, onEdit, onDelete, onToggleFavorite }: AgentCardProps) {
  const tags = agent.tags || [];
  const sizeClass = cardSizeClasses[cardSize];
  const visibleTags = tags.slice(0, sizeClass.tagLimit);
  const hiddenTagsCount = Math.max(tags.length - visibleTags.length, 0);
  const updatedDate = new Date(agent.updated_at).toLocaleDateString();

  return (
    <Card
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/75 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      onClick={() => onEdit(agent)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(agent);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardContent className={cn("flex min-h-48 flex-1 flex-col gap-3", sizeClass.body)}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={cn("truncate font-semibold leading-tight text-foreground", sizeClass.title)} title={agent.name}>
              {agent.name}
            </h3>
            {agent.version && <p className="mt-0.5 text-xs text-muted-foreground">v{agent.version}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(agent);
              }}
              title="Delete Agent"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {agent.description && <p className={cn("text-sm leading-relaxed text-muted-foreground", sizeClass.description)}>{agent.description}</p>}

        <div className="flex min-h-[1.5rem] flex-wrap gap-1 overflow-hidden">
          {visibleTags.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="max-w-28 shrink-0 truncate rounded-full bg-muted/70 px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {tag}
            </Badge>
          ))}
          {hiddenTagsCount > 0 && (
            <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] text-muted-foreground">
              +{hiddenTagsCount}
            </Badge>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center">
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
            Updated {updatedDate}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1">
              <Network className="h-3.5 w-3.5" />
              {agent.nodes.length}
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" />
              {agent.edges.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(agent);
            }}
            title={agent.favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("h-4 w-4", agent.favorite ? "fill-primary text-primary" : "")} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
