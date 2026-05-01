type EffortLevel = "none" | "minimal" | "low" | "medium" | "high";
type EnabledEffortLevel = Exclude<EffortLevel, "none">;

function mapReasoningEffort(value: number | undefined): EffortLevel;
function mapReasoningEffort(value: number | undefined, defaultLevel: EnabledEffortLevel): EnabledEffortLevel;
function mapReasoningEffort(value: number | undefined, defaultLevel: EffortLevel = "none"): EffortLevel {
  switch (value) {
    case 0:
      return defaultLevel;
    case 1:
      return "low";
    case 2:
      return "medium";
    case 3:
      return "high";
    default:
      return defaultLevel;
  }
}

function pickDefined(parameters: Record<string, any>, keys: readonly string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of keys) {
    if (key in parameters && parameters[key] != null) {
      result[key] = parameters[key];
    }
  }
  return result;
}

export type { EffortLevel, EnabledEffortLevel };
export { mapReasoningEffort, pickDefined };
