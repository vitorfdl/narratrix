import { Engine } from "@/schema/model-manifest-schema";
import { Model } from "@/schema/models-schema";

function parseAnthropicParameters(rawParameters: Record<string, any>) {
  const newParameters = structuredClone(rawParameters);
  if (newParameters.reasoning_budget) {
    newParameters.thinking = {
      budget_tokens: newParameters.reasoning_budget,
      type: "enabled",
    };
  }

  // Remove incompatible parameters
  if (newParameters.reasoning_temperature) {
    delete newParameters.reasoning_temperature;
  }

  return newParameters;
}

function parseOpenRouterParameters(rawParameters: Record<string, any>) {
  const parameters = structuredClone(rawParameters);
  const { reasoning_temperature, reasoning_budget } = parameters;

  // OpenRouter parameters
  if (reasoning_budget || reasoning_temperature) {
    const temperatureLabel = reasoning_temperature === 1 ? "low" : reasoning_temperature === 2 ? "medium" : "high";
    parameters.reasoning = {
      effort: temperatureLabel,
      max_tokens: reasoning_budget,
      exclude: true,
    };
  }

  return parameters;
}

function parseOpenAIParameters(rawParameters: Record<string, any>, { model }: Model["config"]) {
  const newParameters: any = {};

  const { reasoning_temperature } = rawParameters;

  // Reasoning Models
  if (model?.startsWith("o3-") || model?.startsWith("o4-")) {
    const temperatureLabel = reasoning_temperature === 3 ? "high" : reasoning_temperature === 2 ? "medium" : "low";
    if (model?.startsWith("o3")) {
      newParameters.reasoning = {
        effort: temperatureLabel,
      };
    }

    if (model?.startsWith("o4")) {
      newParameters.reasoning_effort = temperatureLabel;
    }

    const { max_tokens } = rawParameters;
    if (max_tokens) {
      newParameters.max_completion_tokens = max_tokens;
    }

    return newParameters;
  }

  // Other Models
  const { temperature, top_p } = rawParameters;
  if (temperature) {
    newParameters.temperature = temperature;
  }
  if (top_p) {
    newParameters.top_p = top_p;
  }

  const { frequency_penalty, presence_penalty } = rawParameters;
  if (frequency_penalty) {
    newParameters.frequency_penalty = frequency_penalty;
  }
  if (presence_penalty) {
    newParameters.presence_penalty = presence_penalty;
  }

  return newParameters;
}

export function parseEngineParameters(engine: Engine, modelConfig: Model["config"], parameters: Record<string, any>) {
  let newParameters = structuredClone(parameters);

  // Fix Dynamic Temperature
  if ("dynatemp_high" in newParameters) {
    const { dynatemp_high, dynatemp_low } = newParameters;

    newParameters = {
      ...newParameters,
      dynatemp_range: (dynatemp_high - dynatemp_low) / 2,
    };
  }

  delete newParameters.max_context;
  delete newParameters.max_depth;
  delete newParameters.max_response;

  switch (engine) {
    case "anthropic":
      return parseAnthropicParameters(newParameters);
    case "openai":
      return parseOpenAIParameters(newParameters, modelConfig || {});
    // case "google":
    //   return parameters;
    case "openrouter":
      return parseOpenRouterParameters(newParameters);
    // case "runpod":
    //   return parameters;
    // case "aws_bedrock":
    //   return parameters;
    default:
      return newParameters;
  }
}
