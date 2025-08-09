import React from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { NodeRegistry } from "./node-registry";
import { NodePickerProps } from "./types";

// Node picker component for selecting node types when creating new nodes
export const NodePicker: React.FC<NodePickerProps> = ({ position, onSelect, onCancel }) => {
  // Get node options from registry
  const nodeOptions = NodeRegistry.getNodeOptions();

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
