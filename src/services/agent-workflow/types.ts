import { AgentNodeType, AgentType } from "@/schema/agent-schema";
import { PromptFormatterConfig } from "../inference/formatter";

export interface WorkflowExecutionContext {
  agentId: string;
  nodeValues: Map<string, any>;
  executedNodes: Set<string>;
  isRunning: boolean;
  currentNodeId?: string;
}

export interface NodeExecutionResult {
  success: boolean;
  value?: any;
  error?: string;
}

export interface WorkflowToolDefinition {
  name: string;
  description?: string;
  inputSchema?: any;
  invoke: (args: any) => Promise<any>;
}

export interface WorkflowDeps {
  // formatting and templates
  formatPrompt: (args: PromptFormatterConfig) => Promise<any>;
  removeNestedFields: (obj: Record<string, any>) => Record<string, any>;
  getChatTemplateById: (id: string) => Promise<any | null>;
  getModelById: (id: string) => Promise<any | null>;
  getInferenceTemplateById: (id: string) => Promise<any | null>;
  getFormatTemplateById: (id: string) => Promise<any | null>;
  // model manifests (engine string needed)
  getManifestById: (id: string) => any | null;
  // non-streaming inference
  runInference: (opts: {
    messages: any[];
    modelSpecs: { id: string; model_type: "chat" | "completion"; config: any; max_concurrent_requests: number; engine: string };
    systemPrompt?: string;
    parameters?: Record<string, any>;
    stream?: boolean;
  }) => Promise<string | null>;
}

export type NodeExecutor = (node: AgentNodeType, inputs: Record<string, any>, context: WorkflowExecutionContext, agent: AgentType, deps: WorkflowDeps) => Promise<NodeExecutionResult>;

export interface ExecutorRegistry {
  [nodeType: string]: NodeExecutor;
}

export interface WorkflowServices {}
