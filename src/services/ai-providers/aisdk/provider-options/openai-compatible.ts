import { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";

function getOpenAICompatibleProviderOptions(parameters: Record<string, any>): OpenAIResponsesProviderOptions {
  const providerOptions: Record<string, any> = structuredClone(parameters);

  // Remove default OpenAI/transformer params that should not be forwarded
  delete providerOptions.top_p;
  delete providerOptions.top_k;
  delete providerOptions.frequency_penalty;
  delete providerOptions.presence_penalty;
  delete providerOptions.temperature;
  delete providerOptions.max_tokens;
  delete providerOptions.stop;
  delete providerOptions.seed;

  if ("dynatemp_high" in parameters) {
    const { dynatemp_high, dynatemp_low } = parameters;

    providerOptions.dynatemp_range = (dynatemp_high - dynatemp_low) / 2;
  }

  return providerOptions;
}

export { getOpenAICompatibleProviderOptions };
