import { CallSettings, LanguageModel, Prompt, ToolSet } from "ai";
import { InferenceParams } from "@/hooks/useInference";
import { Engine } from "@/schema/model-manifest-schema";
import { toCoreMessages } from "./aisdk/convert-messages";
import { generateResponse } from "./aisdk/non-streaming";
import { getAISDKModel } from "./aisdk/provider-factory";
import { getProviderOptions } from "./aisdk/provider-options";
import { streamResponse } from "./aisdk/streaming";
import type { AIEvent } from "./types/ai-event.type";

type FinalParams = CallSettings & Prompt & { tools?: ToolSet } & { providerOptions?: Record<string, any>; model: LanguageModel };

const DEFAULT_MAX_TOKENS = 4000;

/**
 * Generates a response to a given question using Vercel AI SDK.
 * @param event - The request object (for streaming callbacks).
 * @param modelProvider - The provider configuration (engine, auth, etc).
 * @param params - The inference parameters (messages, model name, tools, etc).
 * @returns A Promise that resolves to the generated response text.
 */
async function callProviderConverseEndpoint(event: AIEvent, params: InferenceParams) {
  // 1. Create Model Instance
  const model = await getAISDKModel(params.modelSpecs, params.parameters as Record<string, any>);
  const isChatModel = params.modelSpecs.model_type === "chat";

  // 2. Convert Messages
  // params.messages is InferenceMessage[]
  // params.system_message is string | undefined
  if (!params.messages) {
    throw new Error("No messages provided");
  }
  const messages = toCoreMessages(isChatModel ? params.systemPrompt : undefined, params.messages);
  // const tools = params.tools ? convertToolsToAISDK(params.tools) : undefined;

  // 3. Prepare Options
  // Extract provider specific options from params.parameters
  const providerOptions = getProviderOptions(params.modelSpecs.engine as Engine, params.parameters || {});

  const parameters = params.parameters as Record<string, any>;
  // Ensure defaults
  const finalParams: FinalParams = {
    model,
    messages,
    // tools,
    system: params.systemPrompt,
    providerOptions,
    maxOutputTokens: parameters.max_tokens || DEFAULT_MAX_TOKENS,
    temperature: parameters.temperature,
    topP: parameters.top_p,
    topK: parameters.top_k,
    seed: parameters.seed,
    stopSequences: parameters.stop?.[0] ? parameters.stop : undefined,
    frequencyPenalty: parameters.frequency_penalty,
    presencePenalty: parameters.presence_penalty,
  };

  // console.log("finalParams", finalParams);

  // 4. Execute
  if (params.stream) {
    return streamResponse(event, finalParams);
  } else {
    const response = await generateResponse(finalParams);
    event.finish({ fullResponse: response });
    return response;
  }
}

export { callProviderConverseEndpoint };
export type { FinalParams };
