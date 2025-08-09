import { useReactFlow } from "@xyflow/react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Inference", "Chat"]));

  // Get all node options grouped by category
  const categorizedNodes = useMemo(() => {
    const nodeOptions = NodeRegistry.getNodeOptions();
    const categories = new Map<string, NodeOption[]>();

    nodeOptions.forEach((option) => {
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
    });

    // Convert to array and sort categories
    const sortedCategories: CategoryGroup[] = Array.from(categories.entries())
      .map(([category, nodes]) => ({
        category,
        nodes: nodes.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => {
        // Prioritize certain categories
        const priority = ["Chat", "Text Inference", "Code Runner"];
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
      // Create node at center of viewport
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
    [screenToFlowPosition, addNodes, onNodeAdd],
  );

  return (
    <div className={cn("w-44 bg-background/95 border-r border-border flex flex-col", className)}>
      {/* Header */}
      <div className="p-2 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">Node Library</h3>
        <p className="text-xxs text-muted-foreground">Click nodes to add to the canvas</p>
      </div>

      {/* Node Categories */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {categorizedNodes.map(({ category, nodes }) => {
            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="space-y-1">
                {/* Category Header */}
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 px-2 text-xs font-medium hover:bg-accent/50" onClick={() => toggleCategory(category)}>
                  {isExpanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                  {category}
                  <span className="ml-auto text-muted-foreground">({nodes.length})</span>
                </Button>

                {/* Category Nodes */}
                {isExpanded && (
                  <div className="ml-2 space-y-0.5">
                    {nodes.map((node) => {
                      const Icon = node.icon;

                      return (
                        <div
                          key={node.type}
                          onClick={() => handleNodeClick(node.type)}
                          className={cn(
                            "group flex items-center gap-2 px-1 py-0.5 rounded-md cursor-pointer",
                            "hover:bg-accent/70 transition-colors border border-transparent",
                            "hover:border-border/50",
                          )}
                          title={node.description}
                        >
                          {/* Node Icon */}
                          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                            {Icon ? <Icon className="h-4 w-4 text-primary" /> : <div className="w-3 h-3 rounded-full bg-primary/60" />}
                          </div>

                          {/* Node Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{node.label}</div>
                            {/* {node.description && <div className="text-xs text-muted-foreground truncate">{node.description}</div>} */}
                          </div>

                          {/* Add Button (visible on hover) */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 flex-shrink-0 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNodeClick(node.type);
                            }}
                            title="Add node to canvas"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
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
