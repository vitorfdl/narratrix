import { InferenceMessage } from "@/schema/inference-engine-schema";
import { describe, expect, it } from "vitest";
import { collapseConsecutiveLines, mergeMessagesOnUser, mergeSubsequentMessages } from "./format-template-utils";

describe("collapseConsecutiveLines", () => {
  it("should collapse 3 or more consecutive line breaks into 2", () => {
    const messages: Partial<InferenceMessage>[] = [
      { role: "user", text: "Line 1\n\n\nLine 2\n\n\n\nLine 3" },
      { role: "assistant", text: "Response 1\n\n\n\n\nResponse 2" },
    ] as InferenceMessage[];

    const result = collapseConsecutiveLines(messages);

    expect(result).toEqual([
      { role: "user", text: "Line 1\n\nLine 2\n\nLine 3" },
      { role: "assistant", text: "Response 1\n\nResponse 2" },
    ]);
  });

  it("should not modify messages with less than 3 consecutive line breaks", () => {
    const messages: Partial<InferenceMessage>[] = [
      { role: "user", text: "Line 1\n\nLine 2" },
      { role: "assistant", text: "Response 1\nResponse 2" },
    ] as InferenceMessage[];

    const result = collapseConsecutiveLines(messages);

    expect(result).toEqual(messages);
  });

  it("should handle messages with empty or undefined text", () => {
    const messages: Partial<InferenceMessage>[] = [
      { role: "user", text: "" },
      { role: "assistant", text: undefined },
    ] as InferenceMessage[];

    const result = collapseConsecutiveLines(messages);

    expect(result).toEqual(messages);
  });
});

describe("mergeMessagesOnUser", () => {
  it("should merge all messages into a single user message", () => {
    const messages: Partial<InferenceMessage>[] = [
      { role: "user", text: "Message 1" },
      { role: "assistant", text: "Response 1" },
      { role: "user", text: "Message 2" },
    ] as InferenceMessage[];

    const result = mergeMessagesOnUser(messages);

    expect(result).toEqual([{ role: "user", text: "Message 1\n\nResponse 1\n\nMessage 2" }]);
  });

  it("should return empty array for empty input", () => {
    const messages: InferenceMessage[] = [];

    const result = mergeMessagesOnUser(messages);

    expect(result).toEqual([]);
  });

  it("should use custom separator when provided", () => {
    const messages: Partial<InferenceMessage>[] = [
      { role: "user", text: "Message 1" },
      { role: "assistant", text: "Response 1" },
    ] as InferenceMessage[];

    const result = mergeMessagesOnUser(messages, " --- ");

    expect(result).toEqual([{ role: "user", text: "Message 1 --- Response 1" }]);
  });
});

describe("mergeSubsequentMessages", () => {
  it("should merge adjacent messages from the same role", () => {
    const messages: Partial<InferenceMessage>[] = [
      { role: "user", text: "User message 1" },
      { role: "user", text: "User message 2" },
      { role: "assistant", text: "Assistant response 1" },
      { role: "assistant", text: "Assistant response 2" },
      { role: "user", text: "User message 3" },
    ] as InferenceMessage[];

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
    const messages: Partial<InferenceMessage>[] = [{ role: "user", text: "Single message" }] as InferenceMessage[];

    const result = mergeSubsequentMessages(messages);

    expect(result).toEqual(messages);
  });

  it("should use custom separator when provided", () => {
    const messages: Partial<InferenceMessage>[] = [
      { role: "user", text: "Message 1" },
      { role: "user", text: "Message 2" },
    ] as InferenceMessage[];

    const result = mergeSubsequentMessages(messages, " | ");

    expect(result).toEqual([{ role: "user", text: "Message 1 | Message 2" }]);
  });

  it("should handle messages with undefined text", () => {
    const messages: Partial<InferenceMessage>[] = [
      { role: "user", text: "Message 1" },
      { role: "user", text: undefined },
      { role: "user", text: "Message 2" },
    ] as InferenceMessage[];

    const result = mergeSubsequentMessages(messages);

    expect(result).toEqual([{ role: "user", text: "Message 1\n\nMessage 2" }]);
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
