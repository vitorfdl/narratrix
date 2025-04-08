import { Engine } from "@/schema/model-manifest-schema";

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

function parseOpenAIParameters(rawParameters: Record<string, any>) {
  const parameters = structuredClone(rawParameters);
  const { reasoning_temperature, reasoning_budget } = parameters;

  // OpenAI parameters
  if (reasoning_temperature) {
    const temperatureLabel = reasoning_temperature === 1 ? "low" : reasoning_temperature === 2 ? "medium" : "high";
    parameters.reasoning = {
      effort: temperatureLabel,
    };

    const { max_context, max_tokens } = parameters;
    if (max_context || max_tokens) {
      parameters.max_completion_tokens = max_context || max_tokens;
    }
  }

  return parameters;
}

export function parseEngineParameters(engine: Engine, parameters: Record<string, any>) {
  switch (engine) {
    case "anthropic":
      return parseAnthropicParameters(parameters);
    // case "openai_compatible":
    //   return parameters;
    // case "google":
    //   return parameters;
    case "openrouter":
      return parseOpenRouterParameters(parameters);
    // case "runpod":
    //   return parameters;
    // case "aws_bedrock":
    //   return parameters;
    default:
      return parseOpenAIParameters(parameters);
  }
}
