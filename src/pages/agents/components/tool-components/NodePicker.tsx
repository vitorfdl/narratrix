import React from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { NodeRegistry } from "./node-registry";
import type { NodePickerProps } from "./types";

/** Node types that may only appear once per workflow */
const SINGLETON_NODE_TYPES = new Set(["trigger"]);

// Node picker component for selecting node types when creating new nodes
export const NodePicker: React.FC<NodePickerProps> = ({ position, onSelect, onCancel, existingNodeTypes }) => {
  // Get node options from registry, filtering out already-placed singleton nodes
  const nodeOptions = NodeRegistry.getNodeOptions().filter((option) => {
    if (SINGLETON_NODE_TYPES.has(option.value) && existingNodeTypes?.has(option.value)) {
      return false;
    }
    return true;
  });

  const comboboxItems = nodeOptions.map((option) => ({
    label: option.label,
    value: option.value,
    description: option.description,
  }));

  return (
    <div
      className="absolute z-50"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="bg-card border border-border rounded-md shadow-lg p-3 w-[250px]">
        <div className="text-sm font-medium mb-2">Select node type:</div>
        <Combobox
          items={comboboxItems}
          onChange={(value) => onSelect(value || "")}
          placeholder="Search node types..."
          trigger={
            <Button variant="outline" className="w-full justify-between">
              <span>Select node type</span>
            </Button>
          }
        />
        <Button variant="outline" size="sm" className="w-full mt-2 text-xs text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
