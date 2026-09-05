import { useNodes, useReactFlow } from "@xyflow/react";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

const CATEGORY_PRIORITY = ["Trigger", "Chat", "Text Inference", "Code Runner"];

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ className, onNodeAdd }) => {
  const { screenToFlowPosition, addNodes } = useReactFlow();
  const currentNodes = useNodes();
  const takeSnapshot = useTakeSnapshot();

  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  const allCategories = useMemo(() => {
    const nodeOptions = NodeRegistry.getNodeOptions();
    const categories = new Set<string>();
    for (const option of nodeOptions) {
      categories.add(option.category || "Other");
    }
    return categories;
  }, []);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(allCategories);

  const singletonNodeTypes = useMemo(() => new Set(["trigger"]), []);
  const placedNodeTypes = useMemo(() => new Set(currentNodes.map((n) => n.type).filter(Boolean) as string[]), [currentNodes]);

  const categorizedNodes = useMemo<CategoryGroup[]>(() => {
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

    return Array.from(categories.entries())
      .map(([category, nodes]) => ({
        category,
        nodes: nodes.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => {
        const aIndex = CATEGORY_PRIORITY.indexOf(a.category);
        const bIndex = CATEGORY_PRIORITY.indexOf(b.category);
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
  }, []);

  const totalNodeCount = useMemo(() => categorizedNodes.reduce((total, cat) => total + cat.nodes.length, 0), [categorizedNodes]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCategories = useMemo<CategoryGroup[]>(() => {
    if (!normalizedQuery) {
      return categorizedNodes;
    }
    return categorizedNodes
      .map(({ category, nodes }) => ({
        category,
        nodes: nodes.filter((node) => {
          const haystack = `${node.label} ${node.description ?? ""} ${category}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.nodes.length > 0);
  }, [categorizedNodes, normalizedQuery]);

  const filteredNodeCount = useMemo(() => filteredCategories.reduce((total, cat) => total + cat.nodes.length, 0), [filteredCategories]);

  // Auto-expand all matching categories while searching so results stay visible.
  useEffect(() => {
    if (!normalizedQuery) {
      return;
    }
    setExpandedCategories(new Set(filteredCategories.map((c) => c.category)));
  }, [normalizedQuery, filteredCategories]);

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

  if (collapsed) {
    return (
      <div className={cn("w-10 bg-background/95 border-r border-border flex flex-col items-center py-2", className)}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Show node library" onClick={() => setCollapsed(false)}>
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("w-60 bg-background/95 border-r border-border flex flex-col", className)}>
      {/* Header */}
      <div className="px-2 pt-2 pb-1.5 border-b border-border space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">Node Library</h3>
            <HelpTooltip>Click a node to add it to your workflow canvas.</HelpTooltip>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" title="Hide node library" onClick={() => setCollapsed(true)}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="h-8 w-full rounded-md border border-border/60 bg-muted/20 pl-7 pr-7 font-sans text-xs outline-none transition-colors focus:border-primary/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              title="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Node Categories */}
      <ScrollArea className="flex-1">
        <div className="py-1.5 pr-3 pl-1 space-y-1">
          {filteredCategories.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No nodes match <span className="font-medium text-foreground">"{query}"</span>
            </div>
          )}

          {filteredCategories.map(({ category, nodes }) => {
            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="space-y-0.5">
                <Button variant="ghost" size="sm" className="w-full justify-start h-7 px-2 text-xs font-medium hover:bg-accent/50 overflow-hidden gap-1.5" onClick={() => toggleCategory(category)}>
                  {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                  <span className="min-w-0 truncate text-left">{category}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">({nodes.length})</span>
                </Button>

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
                            "group relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border border-transparent py-1 pl-1 pr-8 transition-colors",
                            isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent/70 hover:border-border/50",
                          )}
                          title={isDisabled ? "Only one Trigger node allowed per workflow" : node.description}
                        >
                          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                            {Icon ? <Icon className="h-4 w-4 text-primary" /> : <div className="w-3 h-3 rounded-full bg-primary/60" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{node.label}</div>
                          </div>

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
      <div className="px-3 py-2 border-t border-border">
        <div className="text-[11px] text-muted-foreground text-center tabular-nums">{normalizedQuery ? `${filteredNodeCount} of ${totalNodeCount} nodes` : `${totalNodeCount} nodes available`}</div>
      </div>
    </div>
  );
};
