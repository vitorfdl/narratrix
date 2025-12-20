import { CallSettings, LanguageModel, Prompt, ToolSet } from "ai";
import { toCoreMessages } from "./aisdk/convert-messages";
import { convertToolsToAISDK } from "./aisdk/convert-tools";
import { generateResponse } from "./aisdk/non-streaming";
import { getAISDKModel } from "./aisdk/provider-factory";
import { getProviderOptions } from "./aisdk/provider-options";
import { streamResponse } from "./aisdk/streaming";
import type { AIEvent } from "./types/ai-event.type";
import type { AIProviderParams, InternalAIParameters } from "./types/request.type";

type FinalParams = CallSettings & Prompt & { tools?: ToolSet } & { providerOptions?: Record<string, any>; model: LanguageModel };

const DEFAULT_MAX_TOKENS = 4000;

/**
 * Generates a response to a given question using Vercel AI SDK.
 * @param event - The request object (for streaming callbacks).
 * @param modelProvider - The provider configuration (engine, auth, etc).
 * @param params - The inference parameters (messages, model name, tools, etc).
 * @returns A Promise that resolves to the generated response text.
 */
async function callProviderConverseEndpoint(event: AIEvent, modelProvider: AIProviderParams, params: Partial<InternalAIParameters> = {}) {
  // console.log("callProviderConverseEndpoint", event, modelProvider, params);

  // 1. Create Model Instance
  const model = await getAISDKModel(modelProvider, params.model);

  // 2. Convert Messages
  // params.messages is InferenceMessage[]
  // params.system_message is string | undefined
  if (!params.messages) {
    throw new Error("No messages provided");
  }
  const messages = toCoreMessages(modelProvider.model_type !== "chat" ? params.system_message : undefined, params.messages);
  const tools = params.tool_settings?.tools ? convertToolsToAISDK(params.tool_settings?.tools) : undefined;

  // 3. Prepare Options
  // Extract provider specific options from params.parameters
  const providerOptions = getProviderOptions(modelProvider.engine, params.parameters || {});

  // Ensure defaults
  const finalParams: FinalParams = {
    model,
    messages,
    tools,
    system: modelProvider.model_type === "chat" ? params.system_message : undefined,
    providerOptions,
    maxOutputTokens: params.max_response_tokens || DEFAULT_MAX_TOKENS,
    temperature: params.parameters?.temperature,
    topP: params.parameters?.top_p,
    topK: params.parameters?.top_k,
    seed: params.parameters?.seed,
    stopSequences: params.parameters?.stop[0] ? params.parameters?.stop : undefined,
    frequencyPenalty: params.parameters?.frequency_penalty,
    presencePenalty: params.parameters?.presence_penalty,
  };

  console.log("finalParams", finalParams);

  // 4. Execute
  if (params.stream) {
    return streamResponse(event, finalParams);
  } else {
    return generateResponse(finalParams);
  }
}

export { callProviderConverseEndpoint };
export type { FinalParams };
