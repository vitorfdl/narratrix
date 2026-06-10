import { describe, expect, it } from "vitest";
import type { InferenceMessage } from "@/schema/inference-engine-schema";
import { replaceTextPlaceholders, replaceVariablePatterns } from "../replace-text-placeholders";

describe("replaceVariablePatterns", () => {
  it("strips setvar and substitutes getvar within the same text", () => {
    const [result] = replaceVariablePatterns(["{{setvar::mood::cheerful}}The character feels {{getvar::mood}}."]);
    expect(result).toBe("The character feels cheerful.");
  });

  it("resolves getvar from a setvar declared in a later text (order independence)", () => {
    const [first, second] = replaceVariablePatterns(["Style guide: {{getvar::style}}", "{{setvar::style::concise and witty}}"]);
    expect(first).toBe("Style guide: concise and witty");
    expect(second).toBe("");
  });

  it("last setvar wins when the same name is set multiple times", () => {
    const [result] = replaceVariablePatterns(["{{setvar::x::one}}{{setvar::x::two}}{{getvar::x}}"]);
    expect(result).toBe("two");
  });

  it("handles multiline values and CJK content", () => {
    const input = "{{setvar::kx::\n注意:input内容为基底，需要**改动最少的情况下**扩写}}{{setvar::kx1::，也会最简扩写Master的输入的}}Use: {{getvar::kx}}{{getvar::kx1}}";
    const [result] = replaceVariablePatterns([input]);
    expect(result).toBe("Use: \n注意:input内容为基底，需要**改动最少的情况下**扩写，也会最简扩写Master的输入的");
  });

  it("replaces unset getvar with an empty string", () => {
    const [result] = replaceVariablePatterns(["Value: [{{getvar::missing}}]"]);
    expect(result).toBe("Value: []");
  });

  it("keeps local and global namespaces separate", () => {
    const [result] = replaceVariablePatterns(["{{setvar::name::local-value}}{{setglobalvar::name::global-value}}[{{getvar::name}}][{{getglobalvar::name}}]"]);
    expect(result).toBe("[local-value][global-value]");
  });

  it("is case-insensitive on macro names and trims variable names", () => {
    const [result] = replaceVariablePatterns(["{{SetVar:: mood ::happy}}{{GETVAR::mood}}"]);
    expect(result).toBe("happy");
  });

  it("resolves variable references nested inside stored values", () => {
    const [result] = replaceVariablePatterns(["{{setvar::base::core}}{{setvar::full::{{getvar::base}} extended}}{{getvar::full}}"]);
    expect(result).toBe("core extended");
  });

  it("passes through undefined texts and leaves unrelated placeholders intact", () => {
    const results = replaceVariablePatterns([undefined, "Hello {{char}}!"]);
    expect(results[0]).toBeUndefined();
    expect(results[1]).toBe("Hello {{char}}!");
  });
});

describe("replaceTextPlaceholders variable integration", () => {
  it("processes variables across system prompt and messages even without chat config", () => {
    const messages: InferenceMessage[] = [{ role: "user", text: "{{setvar::tone::dramatic}}Tell a story." }];
    const result = replaceTextPlaceholders(messages, "Write in a {{getvar::tone}} tone.", undefined);

    expect(result.systemPrompt).toBe("Write in a dramatic tone.");
    expect(result.inferenceMessages[0].text).toBe("Tell a story.");
  });

  it("does not leak variables between separate calls (ephemeral scope)", () => {
    const setterMessages: InferenceMessage[] = [{ role: "user", text: "{{setvar::leak::secret}}" }];
    replaceTextPlaceholders(setterMessages, undefined, undefined);

    const getterMessages: InferenceMessage[] = [{ role: "user", text: "[{{getvar::leak}}]" }];
    const result = replaceTextPlaceholders(getterMessages, undefined, undefined);
    expect(result.inferenceMessages[0].text).toBe("[]");
  });
});
