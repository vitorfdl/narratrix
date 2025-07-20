import { InferenceMessage } from "@/schema/inference-engine-schema";
import { InferenceTemplate } from "@/schema/template-inferance-schema";
import { describe, expect, it } from "vitest";
import { applyInferenceTemplate } from "../apply-inference-template";

// @ts-expect-error - Test template
const inferenceTemplate: InferenceTemplate = {
  id: "test-template",
  name: "Test Template",
  config: {
    systemPromptFormatting: { prefix: "<sys>", suffix: "</sys>\\n" },
    userMessageFormatting: { prefix: "<user>", suffix: "</user>\\n" },
    assistantMessageFormatting: {
      prefix: "<asst>",
      suffix: "</asst>\\n",
      prefill: "Assistant:",
      prefillOnlyCharacters: false,
    },
    agentMessageFormatting: {
      prefix: "",
      suffix: "",
      useSameAsUser: false,
      useSameAsSystemPrompt: false,
    }, // Default, not used in this test
    customStopStrings: [],
  },
};

describe("applyInferenceTemplate", () => {
  it("should correctly format system, user, and assistant messages with specified template", async () => {
    // Arrange
    const systemPrompt = "System instructions.";
    const messages: InferenceMessage[] = [
      { role: "user", text: "Hello there." },
      { role: "assistant", text: "Hi!" },
      { role: "user", text: "How are you doing?" },
    ];

    // Any \\n must be replaced by \n in the applyinferencetempalte.
    // The last string must always be the prefix of assistant, so LLM knows it must auto complete for the assistant.
    const expectedOutput =
      "<sys>System instructions.</sys>\n<user>Hello there.</user>\n<asst>Hi!</asst>\n<user>How are you doing?</user>\n<asst>Assistant:";

    const result = await applyInferenceTemplate({ systemPrompt, inferenceTemplate, messages, chatConfig: {} });

    // Combine system prompt and messages to get the full formatted text
    const formattedText = result.systemPrompt + result.messages.map((msg) => msg.text).join("");

    // Assert
    expect(formattedText).toBe(expectedOutput);
    expect(result.customStopStrings).toContain("</asst>\n");
    expect(result.customStopStrings).toContain("</user>\n");
    expect(result.customStopStrings).toHaveLength(2);
  });

  it("should allow prefilling if assistant's is the last message", async () => {
    // Arrange
    const systemPrompt = "System instructions.";
    const messages: InferenceMessage[] = [
      { role: "user", text: "Hello there." },
      { role: "assistant", text: "Hi!" },
    ];

    const result = await applyInferenceTemplate({ systemPrompt, inferenceTemplate, messages, chatConfig: {} });

    // Combine system prompt and messages to get the full formatted text
    const formattedText = result.systemPrompt + result.messages.map((msg) => msg.text).join("");

    // Assert
    expect(formattedText).toBe("<sys>System instructions.</sys>\n<user>Hello there.</user>\n<asst>Hi!");
  });
});
