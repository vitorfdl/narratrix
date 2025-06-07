import { InferenceMessage } from "@/schema/inference-engine-schema";
import { describe, expect, it } from "vitest";
import { replaceTextPlaceholders } from "../replace-text";

describe("replaceTextPlaceholders", () => {
  it("should return original messages and prompt when no replacements needed", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "Hello there" },
      { role: "assistant", text: "How can I help?" },
    ];
    const systemPrompt = "System instructions";

    const result = replaceTextPlaceholders(messages, systemPrompt, {});

    expect(result.inferenceMessages).toEqual(messages);
    expect(result.systemPrompt).toEqual(systemPrompt);
  });

  it("should replace character placeholders in messages", () => {
    const messages: InferenceMessage[] = [
      { role: "user", text: "Hi {{char}}, I'm {{user}}" },
      { role: "assistant", text: "Hello {{user}}, I'm {{character.name}}" },
    ];

    const config: any = {
      character: { name: "Alice", type: "character" },
      user_character: { name: "Bob" },
    };

    const result = replaceTextPlaceholders(messages, undefined, config);

    expect(result.inferenceMessages).toEqual([
      { role: "user", text: "Hi Alice, I'm Bob" },
      { role: "assistant", text: "Hello Bob, I'm Alice" },
    ]);
  });

  it("should replace all placeholders in system prompt", () => {
    const systemPrompt = `
      Character: {{char}}
      User: {{user}}
      Character Name: {{character.name}}
      User Name: {{user.name}}
      Title: {{chapter.title}}
      Scenario: {{chapter.scenario}}
      Character Personality: {{character.personality}}
      User Personality: {{user.personality}}
    `;

    const config: any = {
      character: {
        name: "Alice",
        type: "character",
        custom: { personality: "Friendly and helpful" },
      },
      user_character: {
        name: "Bob",
        custom: { personality: "Curious and determined" },
      },
      chapter: {
        title: "The Beginning",
        scenario: "A fantasy world",
      },
    };

    const result = replaceTextPlaceholders([], systemPrompt, config);

    expect(result.systemPrompt).toEqual(`
      Character: Alice
      User: Bob
      Character Name: Alice
      User Name: Bob
      Title: The Beginning
      Scenario: A fantasy world
      Character Personality: Friendly and helpful
      User Personality: Curious and determined
    `);
  });

  it("should handle missing values gracefully", () => {
    const messages: InferenceMessage[] = [{ role: "user", text: "Hi {{char}}, I'm {{user}}" }];

    const systemPrompt = "{{character.personality}} and {{user.personality}}";

    const config: any = {
      character: { name: "Alice", type: "character" },
      // Missing personality and user_character
    };

    const result = replaceTextPlaceholders(messages, systemPrompt, config);

    expect(result.inferenceMessages).toEqual([{ role: "user", text: "Hi Alice, I'm {{user}}" }]);
    expect(result.systemPrompt).toEqual("{{character.personality}} and {{user.personality}}");
  });

  it("should handle non-character type properly", () => {
    const systemPrompt = "{{character.personality}}";

    const config: any = {
      character: {
        name: "Alice",
        type: "bot", // Not "character" type
        custom: { personality: "This won't be used" },
      },
    };

    const result = replaceTextPlaceholders([], systemPrompt, config);

    // Should not replace personality since character type is not "character"
    expect(result.systemPrompt).toEqual("{{character.personality}}");
  });
});
