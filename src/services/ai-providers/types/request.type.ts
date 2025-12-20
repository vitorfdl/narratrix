import { AutoParseableTextFormat } from "openai/lib/parser.js";
import { ParsingToolFunction, RunnableToolFunction } from "openai/lib/RunnableFunction";
import { InferenceMessage } from "@/schema/inference-engine-schema";

type OpenAIToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
};

type ToolsList = ParsingToolFunction<any> | RunnableToolFunction<any> | OpenAIToolDefinition;

interface ToolSettings {
  force_tool?: boolean;
  tools: ToolsList[];
}

interface AIProviderParams {
  id: string;
  model_type: "chat" | "completion";
  engine: "openai" | "aws_bedrock" | "anthropic" | "google" | "openrouter" | "openai_compatible";
  config?: Record<string, any>;
}

interface InternalAIParameters {
  model?: string;
  parameters?: {
    presence_penalty?: number;
    frequency_penalty?: number;
    top_p?: number;
    temperature?: number;
    [key: string]: any;
  };
  max_response_tokens?: number;
  system_message?: string;
  messages: InferenceMessage[];
  stream: boolean;
  tool_settings?: ToolSettings;
  json_response?: AutoParseableTextFormat<any>;
}

interface AIProvider {
  generateEmbeddings?: (text: string, user_id?: string) => Promise<number[]>;
  startConversationRequest: (event: any, requestParams: InternalAIParameters) => Promise<string>;
}

export type { AIProvider, AIProviderParams, InternalAIParameters, ToolSettings, ToolsList, OpenAIToolDefinition };
