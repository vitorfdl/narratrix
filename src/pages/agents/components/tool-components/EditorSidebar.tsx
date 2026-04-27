import { useNodes, useReactFlow } from "@xyflow/react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeRegistry } from "./node-registry";
import { getNodeConfig, getNodeId } from "./node-utils";
import { ToolNodeData } from "./types";

export interface AgentSidebarProps {
  className?: string;
  onNodeAdd?: (nodeType: string) => void;
}

interface NodeOption {
  type: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  category: string;
}

interface CategoryGroup {
  category: string;
  nodes: NodeOption[];
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ className, onNodeAdd }) => {
  const { screenToFlowPosition, addNodes } = useReactFlow();
  const currentNodes = useNodes();
  const takeSnapshot = useTakeSnapshot();
  const allCategories = useMemo(() => {
    const nodeOptions = NodeRegistry.getNodeOptions();
    const categories = new Set<string>();
    for (const option of nodeOptions) {
      categories.add(option.category || "Other");
    }
    return categories;
  }, []);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(allCategories);

  // Track which singleton node types are already placed (only one allowed per workflow)
  const singletonNodeTypes = useMemo(() => new Set(["trigger"]), []);
  const placedNodeTypes = useMemo(() => new Set(currentNodes.map((n) => n.type).filter(Boolean) as string[]), [currentNodes]);

  // Get all node options grouped by category
  const categorizedNodes = useMemo(() => {
    const nodeOptions = NodeRegistry.getNodeOptions();
    const categories = new Map<string, NodeOption[]>();

    for (const option of nodeOptions) {
      const category = option.category || "Other";
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push({
        type: option.value,
        label: option.label,
        description: option.description,
        icon: option.icon,
        category,
      });
    }

    // Convert to array and sort categories
    const sortedCategories: CategoryGroup[] = Array.from(categories.entries())
      .map(([category, nodes]) => ({
        category,
        nodes: nodes.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => {
        // Prioritize certain categories — Trigger always comes first
        const priority = ["Trigger", "Chat", "Text Inference", "Code Runner"];
        const aIndex = priority.indexOf(a.category);
        const bIndex = priority.indexOf(b.category);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) {
          return -1;
        }
        if (bIndex !== -1) {
          return 1;
        }

        return a.category.localeCompare(b.category);
      });

    return sortedCategories;
  }, []);

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  // Handle node click to add to canvas
  const handleNodeClick = useCallback(
    (nodeType: string) => {
      if (singletonNodeTypes.has(nodeType) && placedNodeTypes.has(nodeType)) {
        return;
      }

      takeSnapshot();

      const centerPosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const id = `${nodeType}-${getNodeId()}`;
      const nodeData = getNodeConfig(nodeType);

      const newNode = {
        id,
        type: nodeType,
        position: centerPosition,
        data: nodeData as ToolNodeData,
        draggable: true,
        selectable: true,
        deletable: true,
      };

      addNodes([newNode]);
      onNodeAdd?.(nodeType);
    },
    [screenToFlowPosition, addNodes, onNodeAdd, singletonNodeTypes, placedNodeTypes, takeSnapshot],
  );

  return (
    <div className={cn("w-56 bg-background/95 border-r border-border flex flex-col", className)}>
      {/* Header */}
      <div className="p-2 border-b border-border flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <h3 className="font-semibold text-sm text-foreground">Node Library</h3>
          <HelpTooltip>Click a node to add it to your workflow canvas.</HelpTooltip>
        </div>
      </div>

      {/* Node Categories */}
      <ScrollArea className="flex-1">
        <div className="pr-3 space-y-1">
          {categorizedNodes.map(({ category, nodes }) => {
            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="space-y-1">
                {/* Category Header */}
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 px-2 text-xs font-medium hover:bg-accent/50 overflow-hidden gap-1.5" onClick={() => toggleCategory(category)}>
                  {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                  <span className="min-w-0 truncate text-left">{category}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">({nodes.length})</span>
                </Button>

                {/* Category Nodes */}
                {isExpanded && (
                  <div className="ml-2 space-y-0.5">
                    {nodes.map((node) => {
                      const Icon = node.icon;
                      const isDisabled = singletonNodeTypes.has(node.type) && placedNodeTypes.has(node.type);

                      return (
                        <div
                          key={node.type}
                          onClick={() => !isDisabled && handleNodeClick(node.type)}
                          className={cn(
                            "group relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border border-transparent py-0.5 pl-1 pr-8 transition-colors",
                            isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent/70 hover:border-border/50",
                          )}
                          title={isDisabled ? "Only one Trigger node allowed per workflow" : node.description}
                        >
                          {/* Node Icon */}
                          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                            {Icon ? <Icon className="h-4 w-4 text-primary" /> : <div className="w-3 h-3 rounded-full bg-primary/60" />}
                          </div>

                          {/* Node Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{node.label}</div>
                          </div>

                          {/* Add Button (visible on hover, hidden when disabled) */}
                          {!isDisabled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNodeClick(node.type);
                              }}
                              title="Add node to canvas"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">{categorizedNodes.reduce((total, cat) => total + cat.nodes.length, 0)} nodes available</div>
      </div>
    </div>
  );
};
