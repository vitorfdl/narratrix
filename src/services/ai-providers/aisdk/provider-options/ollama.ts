import type { OllamaChatSettings } from "ai-sdk-ollama";

function getOllamaModelSettings(parameters: Record<string, any>): OllamaChatSettings {
  const settings: OllamaChatSettings = {};
  const options: Record<string, any> = {};

  if ("repetition_penalty" in parameters && parameters.repetition_penalty != null) {
    options.repeat_penalty = parameters.repetition_penalty;
  }

  if ("num_ctx" in parameters && parameters.num_ctx != null) {
    options.num_ctx = parameters.num_ctx;
  }

  if (Object.keys(options).length > 0) {
    settings.options = options;
  }

  if ("reasoning_temperature" in parameters && parameters.reasoning_temperature !== -1) {
    settings.think = true;
  }

  return settings;
}

export { getOllamaModelSettings };
