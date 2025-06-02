import { LucideIcon } from "lucide-react";
import { ComponentType } from "react";
import { NodeInput, NodeOutput } from "./NodeBase";
import { ToolNodeData } from "./types";

// Node theme interface for custom styling
export interface NodeTheme {
  border: string;
  bg: string;
  header: string;
  hover: string;
  selected: string;
  icon: string;
}

// Utility function to create consistent node themes
export function createNodeTheme(color: string): NodeTheme {
  return {
    border: `border-${color}-400/60 dark:border-${color}-500/60`,
    bg: `bg-${color}-50/80 dark:bg-${color}-950/80`,
    header: `bg-${color}-100/70 dark:bg-${color}-900/30`,
    hover: `hover:border-${color}-500 dark:hover:border-${color}-400`,
    selected: `ring-2 ring-${color}-400 ring-offset-2 ring-offset-background dark:ring-${color}-500`,
    icon: `text-${color}-600 dark:text-${color}-400`,
  };
}

// Custom node props interface that matches our usage
export interface CustomNodeProps {
  data: ToolNodeData;
  selected: boolean;
  id: string;
  type: string;
}

// Node metadata interface
export interface NodeMetadata {
  type: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  category?: string;
  color?: string; // Legacy theme color - deprecated, use theme instead
  theme?: NodeTheme; // Custom theme configuration
  deletable?: boolean;
  inputs?: NodeInput[];
  outputs?: NodeOutput[];
  defaultConfig?: any;
}

// Node definition interface
export interface NodeDefinition {
  metadata: NodeMetadata;
  component: ComponentType<CustomNodeProps>;
  configProvider?: {
    getDefaultConfig: () => { label: string; config: any };
  };
}

// Node Registry namespace
export namespace NodeRegistry {
  const registry = new Map<string, NodeDefinition>();

  export function register(definition: NodeDefinition): void {
    if (registry.has(definition.metadata.type)) {
      console.warn(`Node type "${definition.metadata.type}" is already registered. Overwriting...`);
    }
    registry.set(definition.metadata.type, definition);
  }

  export function unregister(type: string): void {
    registry.delete(type);
  }

  export function get(type: string): NodeDefinition | undefined {
    return registry.get(type);
  }

  export function getAll(): NodeDefinition[] {
    return Array.from(registry.values());
  }

  export function getNodeTypes(): Record<string, ComponentType<CustomNodeProps>> {
    const nodeTypes: Record<string, ComponentType<CustomNodeProps>> = {};
    registry.forEach((definition, type) => {
      nodeTypes[type] = definition.component;
    });
    return nodeTypes;
  }

  export function getNodeOptions() {
    return Array.from(registry.values()).map((def) => ({
      value: def.metadata.type,
      label: def.metadata.label,
      description: def.metadata.description,
      icon: def.metadata.icon,
      category: def.metadata.category,
    }));
  }

  export function getDefaultConfig(type: string) {
    const definition = registry.get(type);
    if (!definition) {
      return { label: "Unknown Node", config: {} };
    }

    if (definition.configProvider) {
      return definition.configProvider.getDefaultConfig();
    }

    return {
      label: definition.metadata.label,
      config: definition.metadata.defaultConfig || {},
    };
  }

  export function getNodeMetadata(type: string): NodeMetadata | undefined {
    return registry.get(type)?.metadata;
  }

  export function clear(): void {
    registry.clear();
  }
}
