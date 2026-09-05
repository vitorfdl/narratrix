import { describe, expect, it } from "vitest";
import { InferenceMessage } from "@/schema/inference-engine-schema";
import { createSystemPrompt } from "../../formatter";
import { renderCharacterContext, replaceTextPlaceholders } from "../replace-text-placeholders";

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

describe("renderCharacterContext", () => {
  const content = "# Character\n{{character.name}}: {{character.personality}}";

  it("resolves the character-scoped macros for the given character", () => {
    const character: any = { name: "Bob", type: "character", custom: { personality: "Cunning" } };
    expect(renderCharacterContext(content, character)).toEqual("# Character\nBob: Cunning");
  });

  it("strips {{character.personality}} when the personality is empty so it cannot leak to the global pass", () => {
    const character: any = { name: "Bob", type: "character", custom: { personality: "" } };
    expect(renderCharacterContext(content, character)).toEqual("# Character\nBob: ");
  });

  it("treats a non-character type as having no personality", () => {
    const character: any = { name: "Bot", type: "agent", custom: { personality: "ignored" } };
    expect(renderCharacterContext(content, character)).toEqual("# Character\nBot: ");
  });

  it("leaves non-character macros untouched for the later global pass", () => {
    const character: any = { name: "Bob", type: "character", custom: { personality: "Friend of {{user}}" } };
    const result = renderCharacterContext("{{char}} ({{user}}): {{character.personality}} @ {{chapter.title}}", character);
    expect(result).toEqual("Bob ({{user}}): Friend of {{user}} @ {{chapter.title}}");
  });

  it("resolves {{char}} inside the personality to the same character", () => {
    const character: any = { name: "Bob", type: "character", custom: { personality: "{{char}} is brave" } };
    expect(renderCharacterContext(content, character)).toEqual("# Character\nBob: Bob is brave");
  });

  it("strips a self-referential {{character.personality}} so it cannot leak to the global pass", () => {
    const character: any = { name: "Bob", type: "character", custom: { personality: "I am {{character.personality}}" } };
    // The nested {{character.personality}} is removed (not carried into the block where the global
    // pass would substitute the generating character's personality).
    expect(renderCharacterContext(content, character)).toEqual("# Character\nBob: I am ");
  });

  it("treats $ sequences in the name and personality as literals", () => {
    const character: any = { name: "A$&B", type: "character", custom: { personality: "worth $100 ($1 each)" } };
    expect(renderCharacterContext("{{char}}: {{character.personality}}", character)).toEqual("A$&B: worth $100 ($1 each)");
  });
});

describe("createSystemPrompt — character-context repetition", () => {
  const characterContextSection = { type: "character-context" as const, content: "# Character\n{{character.name}}: {{character.personality}}", enabled: true };
  const alice: any = { name: "Alice", type: "character", custom: { personality: "Brave" } };
  const bob: any = { name: "Bob", type: "character", custom: { personality: "Cunning" } };

  const buildTemplate = (allEnabled: boolean): any => ({
    config: { settings: { character_context_all_enabled: allEnabled }, context_separator: "\n---\n" },
    prompts: [characterContextSection],
  });

  it("repeats the character-context section per enabled character when the setting is on", () => {
    const result = createSystemPrompt({
      systemPromptTemplate: buildTemplate(true),
      chatConfig: { character: alice, contextCharacters: [alice, bob] },
      contextSeparator: "\n---\n",
    });

    expect(result).toEqual("# Character\nAlice: Brave\n---\n# Character\nBob: Cunning");
  });

  it("leaves the single section with raw macros when the setting is off", () => {
    const result = createSystemPrompt({
      systemPromptTemplate: buildTemplate(false),
      chatConfig: { character: alice, contextCharacters: [alice, bob] },
      contextSeparator: "\n---\n",
    });

    // Off path is unchanged: macros are resolved later by the global placeholder pass.
    expect(result).toEqual("# Character\n{{character.name}}: {{character.personality}}");
  });

  it("renders a single block when only one character is enabled", () => {
    const result = createSystemPrompt({
      systemPromptTemplate: buildTemplate(true),
      chatConfig: { character: alice, contextCharacters: [alice] },
      contextSeparator: "\n---\n",
    });

    expect(result).toEqual("# Character\nAlice: Brave");
  });

  it("falls back to the unexpanded section when no contextCharacters are provided", () => {
    const result = createSystemPrompt({
      systemPromptTemplate: buildTemplate(true),
      chatConfig: { character: alice },
      contextSeparator: "\n---\n",
    });

    expect(result).toEqual("# Character\n{{character.name}}: {{character.personality}}");
  });

  it("still injects the cast when the generating slot has no resolved character", () => {
    // hasCharacter is false (no chatConfig.character), but the enabled cast must still be injected.
    const result = createSystemPrompt({
      systemPromptTemplate: buildTemplate(true),
      chatConfig: { contextCharacters: [alice, bob] },
      contextSeparator: "\n---\n",
    });

    expect(result).toEqual("# Character\nAlice: Brave\n---\n# Character\nBob: Cunning");
  });
});
