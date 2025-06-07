import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { AgentType } from "@/schema/agent-schema";
import { Bot, Code2, GitBranch, Heart, HeartOff, Network, Trash2, Zap } from "lucide-react";

interface AgentCardProps {
  agent: AgentType;
  cardSize: "small" | "medium" | "large";
  onEdit: (agent: AgentType) => void;
  onDelete: (agent: AgentType) => void;
  onToggleFavorite: (agent: AgentType) => void;
}

export function AgentCard({ agent, onEdit, onDelete, onToggleFavorite }: AgentCardProps) {
  // Get tags with null check
  const tags = agent.tags || [];

  // Count nodes by type
  const nodeTypes = agent.nodes.reduce(
    (acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Get run trigger type
  const runTrigger = agent.settings?.run_on?.type || "manual";

  return (
    <Card
      className="group relative overflow-hidden flex flex-col h-full bg-gradient-to-br from-background to-accent/10 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 cursor-pointer"
      onClick={() => onEdit(agent)}
    >
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base line-clamp-1">{agent.name}</h3>
              {agent.version && <p className="text-xs text-muted-foreground">v{agent.version}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Run trigger badge */}
            <Badge variant={runTrigger === "every_message" ? "default" : "secondary"} className="text-xxs flex items-center text-primary-foreground">
              <Zap className="h-3 w-3 mr-1" />
              {runTrigger === "every_message" ? "Auto" : "Manual"}
            </Badge>

            {/* Favorite button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(agent);
              }}
              title={agent.favorite ? "Remove from favorites" : "Add to favorites"}
            >
              {agent.favorite ? <Heart className="h-4 w-4 fill-primary text-primary" /> : <HeartOff className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* Description */}
        {agent.description && <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>}

        {/* Node stats */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Network className="h-3 w-3" />
            <span>{agent.nodes.length} nodes</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            <span>{agent.edges.length} connections</span>
          </div>
        </div>

        {/* Node type indicators */}
        <div className="flex flex-wrap gap-1">
          {Object.entries(nodeTypes)
            .slice(0, 3)
            .map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-xxs py-0.5 px-1.5">
                <Code2 className="h-3 w-3 mr-1" />
                {type} {count > 1 && `(${count})`}
              </Badge>
            ))}
          {Object.keys(nodeTypes).length > 3 && (
            <Badge variant="outline" className="text-xxs py-0.5 px-1.5">
              +{Object.keys(nodeTypes).length - 3} more
            </Badge>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 4).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="!text-xxs py-0.5 px-1">
                {tag}
              </Badge>
            ))}
            {tags.length > 4 && <span className="text-xs text-muted-foreground font-semibold px-1">+{tags.length - 4}</span>}
          </div>
        )}
      </CardContent>

      {/* Action buttons - shown on hover */}
      <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="destructive"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(agent);
          }}
          title="Delete Agent"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CardFooter className="p-3 pt-0 text-xs text-muted-foreground mt-auto">
        <div className="flex items-center justify-between w-full">
          <span>Updated {new Date(agent.updated_at).toLocaleDateString()}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
