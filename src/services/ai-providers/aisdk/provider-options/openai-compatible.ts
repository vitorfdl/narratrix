import { pickDefined } from "./shared";

const OPENAI_COMPATIBLE_PASSTHROUGH_KEYS = [
  "min_p",
  "top_a",
  "nsigma",
  "repetition_penalty",
  "smoothing_factor",
  "smoothing_curve",
  "dry_multiplier",
  "dry_base",
  "dry_allowed_length",
  "dry_penalty_last_n",
  "dry_sequence_breakers",
  "xtc_threshold",
  "xtc_probability",
  "dynatemp_low",
  "dynatemp_high",
  "dynatemp_exponent",
  "adaptive_target",
  "adaptive_decay",
  "sampling_order",
] as const;

function getOpenAICompatibleProviderOptions(parameters: Record<string, any>): Record<string, any> {
  const providerOptions = pickDefined(parameters, OPENAI_COMPATIBLE_PASSTHROUGH_KEYS);

  if ("dynatemp_high" in parameters && "dynatemp_low" in parameters) {
    providerOptions.dynatemp_range = (parameters.dynatemp_high - parameters.dynatemp_low) / 2;
  }

  return providerOptions;
}

export { getOpenAICompatibleProviderOptions };
