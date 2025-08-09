import { describe, expect, it } from "vitest";
import { InferenceMessage } from "@/schema/inference-engine-schema";
import { FormattedPromptResult } from "../../formatter";
import { collapseConsecutiveLines, mergeMessagesOnUser, mergeSubsequentMessages } from "../format-template-utils";

describe("collapseConsecutiveLines", () => {
  it("should collapse 3 or more consecutive line breaks into 2 in messages", () => {
    const result: FormattedPromptResult = {
      inferenceMessages: [
        { role: "user", text: "Line 1\n\n\nLine 2\n\n\n\nLine 3" },
        { role: "assistant", text: "Response 1\n\n\n\n\nResponse 2" },
      ],
    };

    const processedResult = collapseConsecutiveLines(result);

    expect(processedResult.inferenceMessages).toEqual([
      { role: "user", text: "Line 1\n\nLine 2\n\nLine 3" },
      { role: "assistant", text: "Response 1\n\nResponse 2" },
    ]);
  });

  it("should collapse 3 or more consecutive line breaks into 2 in system prompt", () => {
    const result: FormattedPromptResult = {
      inferenceMessages: [{ role: "user", text: "User message" }],
      systemPrompt: "System instruction\n\n\nWith multiple\n\n\n\nLine breaks",
    };

    const processedResult = collapseConsecutiveLines(result);

    expect(processedResult.systemPrompt).toBe("System instruction\n\nWith multiple\n\nLine breaks");
    expect(processedResult.inferenceMessages).toEqual([{ role: "user", text: "User message" }]);
  });

  it("should not modify messages with less than 3 consecutive line breaks", () => {
    const result: FormattedPromptResult = {
      inferenceMessages: [
        { role: "user", text: "Line 1\n\nLine 2" },
        { role: "assistant", text: "Response 1\nResponse 2" },
      ],
    };

    const processedResult = collapseConsecutiveLines(result);

    expect(processedResult.inferenceMessages).toEqual(result.inferenceMessages);
  });

  it("should handle messages with empty or undefined text", () => {
    const result: FormattedPromptResult = {
      inferenceMessages: [
        { role: "user", text: "" },
        { role: "assistant", text: "" },
      ],
    };

    const processedResult = collapseConsecutiveLines(result);

    expect(processedResult.inferenceMessages).toEqual(result.inferenceMessages);
  });

  it("should preserve all properties of FormattedPromptResult", () => {
    const result: FormattedPromptResult = {
      inferenceMessages: [{ role: "user", text: "Message\n\n\nwith breaks" }],
      systemPrompt: "System\n\n\nprompt",
      customStopStrings: ["stop1", "stop2"],
    };

    const processedResult = collapseConsecutiveLines(result);

    expect(processedResult.customStopStrings).toEqual(["stop1", "stop2"]);
    expect(processedResult.systemPrompt).toBe("System\n\nprompt");
    expect(processedResult.inferenceMessages[0].text).toBe("Message\n\nwith breaks");
  });

  it("should handle undefined system prompt", () => {
    const result: FormattedPromptResult = {
      inferenceMessages: [{ role: "user", text: "Message" }],
      systemPrompt: undefined,
    };

    const processedResult = collapseConsecutiveLines(result);

    expect(processedResult.systemPrompt).toBeUndefined();
  });
});

describe("mergeMessagesOnUser", () => {
  it("should merge all messages into a single user message", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "Message 1" },
      { role: "assistant", text: "Response 1" },
      { role: "user", text: "Message 2" },
    ];

    const result = mergeMessagesOnUser(messages);

    expect(result).toEqual([{ role: "user", text: "Message 1\n\nResponse 1\n\nMessage 2" }]);
  });

  it("should return empty array for empty input", () => {
    const messages: InferenceMessage[] = [];

    const result = mergeMessagesOnUser(messages);

    expect(result).toEqual([]);
  });

  it("should use custom separator when provided", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "Message 1" },
      { role: "assistant", text: "Response 1" },
    ];

    const result = mergeMessagesOnUser(messages, " --- ");

    expect(result).toEqual([{ role: "user", text: "Message 1 --- Response 1" }]);
  });
});

describe("mergeSubsequentMessages", () => {
  it("should merge adjacent messages from the same role", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "User message 1" },
      { role: "user", text: "User message 2" },
      { role: "assistant", text: "Assistant response 1" },
      { role: "assistant", text: "Assistant response 2" },
      { role: "user", text: "User message 3" },
    ];

    const result = mergeSubsequentMessages(messages);

    expect(result).toEqual([
      { role: "user", text: "User message 1\n\nUser message 2" },
      { role: "assistant", text: "Assistant response 1\n\nAssistant response 2" },
      { role: "user", text: "User message 3" },
    ]);
  });

  it("should handle empty array", () => {
    const messages: InferenceMessage[] = [];

    const result = mergeSubsequentMessages(messages);

    expect(result).toEqual([]);
  });

  it("should not modify array with single message", () => {
    const messages: InferenceMessage[] = [{ role: "user", text: "Single message" }];

    const result = mergeSubsequentMessages(messages);

    expect(result).toEqual(messages);
  });

  it("should use custom separator when provided", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "Message 1" },
      { role: "user", text: "Message 2" },
    ];

    const result = mergeSubsequentMessages(messages, " | ");

    expect(result).toEqual([{ role: "user", text: "Message 1 | Message 2" }]);
  });

  it("should handle messages with undefined text", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "Message 1" },
      { role: "user", text: "Message 1" },
      { role: "user", text: "Message 2" },
    ];

    const result = mergeSubsequentMessages(messages);

    expect(result).toEqual([{ role: "user", text: "Message 1\n\nMessage 1\n\nMessage 2" }]);
  });

  it("should handle messages with different roles including non-standard roles", () => {
    // For testing purposes only, in real usage the validation would prevent this
    const messages: any[] = [
      { role: "user", text: "User question" },
      { role: "assistant", text: "Assistant response" },
      { role: "system", text: "System message" },
    ];

    const result = mergeSubsequentMessages(messages as InferenceMessage[]);

    expect(result).toEqual(messages);
  });
});
