import { InferenceMessage } from "@/schema/inference-engine-schema";
import { describe, expect, it } from "vitest";
import { applyContextLimit } from "../apply-context-limit";

describe("applyContextLimit", () => {
  it("Should be able to handle a system prompt and a response that exceeds the context limit", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "Line 1\n\n\nLine 2\n\n\n\nLine 1" },
      { role: "assistant", text: "Response 1\n\n\n\n\nResponse 2" },
      { role: "user", text: "Line 1\n\n\nLine 2\n\n\n\nLine 3" },
      { role: "assistant", text: "Response 1\n\nResponse 4" },
    ];

    const result = applyContextLimit(
      { inferenceMessages: messages, systemPrompt: "System prompt" },
      { config: { max_response: 100, max_tokens: 180, max_depth: 100 }, custom_prompts: [] },
    );

    expect(result).toEqual({
      inferenceMessages: [
        { role: "user", text: "Line 1\n\n\nLine 2\n\n\n\nLine 1" },
        { role: "assistant", text: "Response 1\n\n\n\n\nResponse 2" },
        { role: "user", text: "Line 1\n\n\nLine 2\n\n\n\nLine 3" },
        { role: "assistant", text: "Response 1\n\nResponse 4" },
      ],
      systemPrompt: "System prompt",
      max_tokens: 100,
      total_tokens: 35,
      frozen_tokens: 5,
      engine_max_tokens: {
        openai: 175,
        anthropic: 175,
      },
    });
  });

  it("Should handle missing context_size by falling back to max_tokens", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "Test message" },
      { role: "assistant", text: "Test response" },
    ];

    const systemPrompt = "System prompt is to big".repeat(20);

    const result = applyContextLimit(
      { inferenceMessages: messages, systemPrompt },
      { config: { max_response: 100, max_tokens: 260, max_depth: 100 }, custom_prompts: [] },
    );

    expect(result.inferenceMessages).toHaveLength(1);
    expect(result.inferenceMessages[0].text).toBe("Test response");

    expect(result.engine_max_tokens.openai).toBe(106);
    expect(result.engine_max_tokens.anthropic).toBe(106);
    expect(result.max_tokens).toBe(100);
    expect(result.frozen_tokens).toBe(154);
  });

  // it("Should handle zero or negative token calculations gracefully", () => {
  //   const messages: InferenceMessage[] = [{ role: "user", text: "Short message" }];

  //   // This case would normally result in negative tokens due to system prompt being large
  //   const longSystemPrompt = "A".repeat(3000); // Will be ~1000 tokens

  //   const result = applyContextLimit(
  //     { inferenceMessages: messages, systemPrompt: longSystemPrompt },
  //     { config: { max_response: 500, max_tokens: 1000 } },
  //   );

  //   // Should not have negative values
  //   expect(result.engine_max_tokens.openai).toBeGreaterThanOrEqual(0);
  //   expect(result.engine_max_tokens.anthropic).toBeGreaterThanOrEqual(0);
  //   expect(result.inferenceMessages).toHaveLength(0); // No messages should be included due to token limits
  // });
});
