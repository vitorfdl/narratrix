/**
 * Interface for node configuration providers
 * Each node type should implement this to provide its default configuration
 */
export interface NodeConfigProvider {
  getDefaultConfig(): {
    label: string;
    config: Record<string, any>;
  };
}

/**
 * Registry for node configuration providers
 */
export class NodeConfigRegistry {
  private static providers = new Map<string, NodeConfigProvider>();

  static register(nodeType: string, provider: NodeConfigProvider): void {
    this.providers.set(nodeType, provider);
  }

  static getConfig(nodeType: string): { label: string; config: Record<string, any> } {
    const provider = this.providers.get(nodeType);
    if (!provider) {
      return {
        label: `${nodeType.charAt(0).toUpperCase()}${nodeType.slice(1)} Node`,
        config: {},
      };
    }
    return provider.getDefaultConfig();
  }

  static getAllRegisteredTypes(): string[] {
    return Array.from(this.providers.keys());
  }
} 