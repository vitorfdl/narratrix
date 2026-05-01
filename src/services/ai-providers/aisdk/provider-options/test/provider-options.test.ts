import { describe, expect, it } from "vitest";
import { getAnthropicProviderOptions } from "../anthropic";
import { getAWSBedrockProviderOptions } from "../aws-bedrock";

const OPUS_4_7 = "us.anthropic.claude-opus-4-7";
const OPUS_4_6 = "us.anthropic.claude-opus-4-6-v1";
const SONNET_4_5 = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

describe("getAWSBedrockProviderOptions", () => {
  it("uses adaptive with mapped effort and summarized display for Opus 4.7", () => {
    const opts = getAWSBedrockProviderOptions({ reasoning_temperature: 2 }, OPUS_4_7);
    expect(opts.reasoningConfig).toEqual({ type: "adaptive", maxReasoningEffort: "medium", display: "summarized" });
  });

  it("defaults adaptive effort to high when only budget is set", () => {
    const opts = getAWSBedrockProviderOptions({ reasoning_budget: 4000 }, OPUS_4_7);
    expect(opts.reasoningConfig).toEqual({ type: "adaptive", maxReasoningEffort: "high", display: "summarized" });
  });

  it("keeps enabled + budgetTokens for Opus 4.6 (boundary)", () => {
    const opts = getAWSBedrockProviderOptions({ reasoning_budget: 4000 }, OPUS_4_6);
    expect(opts.reasoningConfig).toEqual({ type: "enabled", budgetTokens: 4000 });
  });

  it("emits no reasoningConfig when reasoning is disabled", () => {
    const opts = getAWSBedrockProviderOptions({ reasoning_temperature: -1, reasoning_budget: 0 }, OPUS_4_7);
    expect(opts.reasoningConfig).toBeUndefined();
  });

  it("treats reasoning_temperature -1 as off even when a budget is left over", () => {
    const opts = getAWSBedrockProviderOptions({ reasoning_temperature: -1, reasoning_budget: 4000 }, OPUS_4_7);
    expect(opts.reasoningConfig).toBeUndefined();
  });
});

describe("getAnthropicProviderOptions", () => {
  it("uses adaptive thinking with summarized display and sibling effort for Opus 4.7", () => {
    const opts = getAnthropicProviderOptions({ reasoning_temperature: 3 }, OPUS_4_7);
    expect(opts.thinking).toEqual({ type: "adaptive", display: "summarized" });
    expect(opts.effort).toBe("high");
  });

  it("uses enabled + budgetTokens for older models with budget", () => {
    const opts = getAnthropicProviderOptions({ reasoning_budget: 2000 }, SONNET_4_5);
    expect(opts.thinking).toEqual({ type: "enabled", budgetTokens: 2000 });
    expect(opts.effort).toBeUndefined();
  });

  it("uses enabled (no budget) for older models with effort only", () => {
    const opts = getAnthropicProviderOptions({ reasoning_temperature: 1 }, SONNET_4_5);
    expect(opts.thinking).toEqual({ type: "enabled" });
  });

  it("treats reasoning_temperature -1 as off on adaptive models even when a budget is left over", () => {
    const opts = getAnthropicProviderOptions({ reasoning_temperature: -1, reasoning_budget: 4000 }, OPUS_4_7);
    expect(opts.thinking).toBeUndefined();
    expect(opts.effort).toBeUndefined();
  });
});
