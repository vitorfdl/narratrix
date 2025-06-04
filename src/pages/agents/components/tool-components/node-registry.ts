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
  // Use predefined themes instead of dynamic template strings to avoid Tailwind purging
  const predefinedThemes: Record<string, NodeTheme> = {
    blue: {
      border: "border-blue-400/60 dark:border-blue-500/60",
      bg: "bg-blue-50/80 dark:bg-blue-950/80",
      header: "bg-blue-100/70 dark:bg-blue-900/30",
      hover: "hover:border-blue-500 dark:hover:border-blue-400",
      selected: "ring-2 ring-blue-400 ring-offset-2 ring-offset-background dark:ring-blue-500",
      icon: "text-blue-600 dark:text-blue-400",
    },
    purple: {
      border: "border-purple-400/60 dark:border-purple-500/60",
      bg: "bg-purple-50/80 dark:bg-purple-950/80",
      header: "bg-purple-100/70 dark:bg-purple-900/30",
      hover: "hover:border-purple-500 dark:hover:border-purple-400",
      selected: "ring-2 ring-purple-400 ring-offset-2 ring-offset-background dark:ring-purple-500",
      icon: "text-purple-600 dark:text-purple-400",
    },
    green: {
      border: "border-green-400/60 dark:border-green-500/60",
      bg: "bg-green-50/80 dark:bg-green-950/80",
      header: "bg-green-100/70 dark:bg-green-900/30",
      hover: "hover:border-green-500 dark:hover:border-green-400",
      selected: "ring-2 ring-green-400 ring-offset-2 ring-offset-background dark:ring-green-500",
      icon: "text-green-600 dark:text-green-400",
    },
    orange: {
      border: "border-orange-400/60 dark:border-orange-500/60",
      bg: "bg-orange-50/80 dark:bg-orange-950/80",
      header: "bg-orange-100/70 dark:bg-orange-900/30",
      hover: "hover:border-orange-500 dark:hover:border-orange-400",
      selected: "ring-2 ring-orange-400 ring-offset-2 ring-offset-background dark:ring-orange-500",
      icon: "text-orange-600 dark:text-orange-400",
    },
    red: {
      border: "border-red-400/60 dark:border-red-500/60",
      bg: "bg-red-50/80 dark:bg-red-950/80",
      header: "bg-red-100/70 dark:bg-red-900/30",
      hover: "hover:border-red-500 dark:hover:border-red-400",
      selected: "ring-2 ring-red-400 ring-offset-2 ring-offset-background dark:ring-red-500",
      icon: "text-red-600 dark:text-red-400",
    },
    yellow: {
      border: "border-yellow-400/60 dark:border-yellow-500/60",
      bg: "bg-yellow-50/80 dark:bg-yellow-950/80",
      header: "bg-yellow-100/70 dark:bg-yellow-900/30",
      hover: "hover:border-yellow-500 dark:hover:border-yellow-400",
      selected: "ring-2 ring-yellow-400 ring-offset-2 ring-offset-background dark:ring-yellow-500",
      icon: "text-yellow-600 dark:text-yellow-400",
    },
    indigo: {
      border: "border-indigo-400/60 dark:border-indigo-500/60",
      bg: "bg-indigo-50/80 dark:bg-indigo-950/80",
      header: "bg-indigo-100/70 dark:bg-indigo-900/30",
      hover: "hover:border-indigo-500 dark:hover:border-indigo-400",
      selected: "ring-2 ring-indigo-400 ring-offset-2 ring-offset-background dark:ring-indigo-500",
      icon: "text-indigo-600 dark:text-indigo-400",
    },
    teal: {
      border: "border-teal-400/60 dark:border-teal-500/60",
      bg: "bg-teal-50/80 dark:bg-teal-950/80",
      header: "bg-teal-100/70 dark:bg-teal-900/30",
      hover: "hover:border-teal-500 dark:hover:border-teal-400",
      selected: "ring-2 ring-teal-400 ring-offset-2 ring-offset-background dark:ring-teal-500",
      icon: "text-teal-600 dark:text-teal-400",
    },
    pink: {
      border: "border-pink-400/60 dark:border-pink-500/60",
      bg: "bg-pink-50/80 dark:bg-pink-950/80",
      header: "bg-pink-100/70 dark:bg-pink-900/30",
      hover: "hover:border-pink-500 dark:hover:border-pink-400",
      selected: "ring-2 ring-pink-400 ring-offset-2 ring-offset-background dark:ring-pink-500",
      icon: "text-pink-600 dark:text-pink-400",
    },
    slate: {
      border: "border-slate-400/60 dark:border-slate-500/60",
      bg: "bg-slate-50/80 dark:bg-slate-950/80",
      header: "bg-slate-100/70 dark:bg-slate-900/30",
      hover: "hover:border-slate-500 dark:hover:border-slate-400",
      selected: "ring-2 ring-slate-400 ring-offset-2 ring-offset-background dark:ring-slate-500",
      icon: "text-slate-600 dark:text-slate-400",
    },
  };

  return predefinedThemes[color] || predefinedThemes.blue;
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
  category: string;
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
