import { CSSProperties } from "react";

// Edge type definition
export interface EdgeTypeDefinition {
  type: string;
  label: string;
  description?: string;
  color: string;
  strokeWidth?: number;
  animated?: boolean;
  strokeDasharray?: string;
  getStyle: (selected?: boolean) => CSSProperties;
}

// Edge Registry namespace
export namespace EdgeRegistry {
  const registry = new Map<string, EdgeTypeDefinition>();

  // Register default edge types
  function initializeDefaults() {
    register({
      type: "string",
      label: "String",
      description: "Text data connection",
      color: "#3b82f6", // blue-500
      strokeWidth: 2,
      getStyle: (selected) => ({
        stroke: selected ? "hsl(var(--primary))" : "#3b82f6",
        strokeWidth: selected ? 4 : 2,
        filter: selected ? "drop-shadow(0 0 8px hsl(var(--primary) / 0.8))" : undefined,
        zIndex: selected ? 1000 : 1,
      }),
    });

    register({
      type: "toolset",
      label: "Toolset",
      description: "Tool collection connection",
      color: "#eab308", // yellow-500
      strokeWidth: 2,
      getStyle: (selected) => ({
        stroke: selected ? "hsl(var(--primary))" : "#eab308",
        strokeWidth: selected ? 4 : 2,
        filter: selected ? "drop-shadow(0 0 8px hsl(var(--primary) / 0.8))" : undefined,
        zIndex: selected ? 1000 : 1,
      }),
    });

    register({
      type: "any",
      label: "Any",
      description: "Universal connection that accepts any edge type",
      color: "#6b7280", // gray-500
      strokeWidth: 2,
      getStyle: (selected) => ({
        stroke: selected ? "hsl(var(--primary))" : "#6b7280",
        strokeWidth: selected ? 4 : 2,
        filter: selected ? "drop-shadow(0 0 8px hsl(var(--primary) / 0.8))" : undefined,
        zIndex: selected ? 1000 : 1,
      }),
    });
  }

  export function register(definition: EdgeTypeDefinition): void {
    registry.set(definition.type, definition);
  }

  export function unregister(type: string): void {
    registry.delete(type);
  }

  export function get(type: string): EdgeTypeDefinition | undefined {
    return registry.get(type);
  }

  export function getAll(): EdgeTypeDefinition[] {
    return Array.from(registry.values());
  }

  export function getStyle(type: string, selected?: boolean): CSSProperties {
    const definition = registry.get(type);
    if (!definition) {
      // Default style for unknown edge types
      return {
        stroke: selected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
        strokeWidth: selected ? 4 : 2,
        filter: selected ? "drop-shadow(0 0 8px hsl(var(--primary) / 0.8))" : undefined,
        zIndex: selected ? 1000 : 1,
      };
    }
    return definition.getStyle(selected);
  }

  export function getColor(type: string): string {
    return registry.get(type)?.color || "hsl(var(--muted-foreground))";
  }

  export function isValidType(type: string): boolean {
    return registry.has(type);
  }

  export function clear(): void {
    registry.clear();
  }

  // Initialize default edge types on module load
  initializeDefaults();
}

// Export edge type as a union of registered types
export type EdgeType = "string" | "toolset" | "any";
