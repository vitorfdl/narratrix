import { describe, expect, it } from "vitest";
import { validateAndTransformChatTemplateData } from "../../import-chat-template";
import { transformSillyTavernTemplate, validateSillyTavernTemplate } from "../sillytavern_chat_template";

const PROFILE_ID = "00000000-0000-0000-0000-000000000000";

function buildSTPreset(overrides: Record<string, unknown> = {}) {
  return {
    name: "My ST Preset",
    temperature: 0.8,
    top_p: 0.95,
    openai_max_context: 8192,
    openai_max_tokens: 1024,
    prompts: [
      { identifier: "main", name: "Main Prompt", role: "system" as const, content: "You are {{char}}.", system_prompt: true },
      { identifier: "jailbreak", name: "Post-History Instructions", role: "system" as const, content: "Stay in character.", system_prompt: true },
      { identifier: "chatHistory", name: "Chat History", marker: true, system_prompt: true },
      { identifier: "abc12345-6789-4abc-9def-0123456789ab", name: "Custom Note", role: "system" as const, content: "Note: {{User}} likes coffee.", injection_position: 1, injection_depth: 4 },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "main", enabled: true },
          { identifier: "abc12345-6789-4abc-9def-0123456789ab", enabled: true },
          { identifier: "chatHistory", enabled: true },
          { identifier: "jailbreak", enabled: true },
        ],
      },
    ],
    ...overrides,
  };
}

describe("SillyTavern chat template import", () => {
  it("dispatcher routes SillyTavern presets even when they have a top-level `name`", () => {
    // Regression: a SillyTavern preset with a top-level "name" field used to silently pass
    // the internal Zod schema (which has defaults for every other field), producing an
    // empty template and discarding all prompts.
    const data = buildSTPreset();
    const result = validateAndTransformChatTemplateData(data, PROFILE_ID, "preset.json");

    expect(result.valid).toBe(true);
    expect(result.format).toBe("sillytavern");
    expect(result.data?.custom_prompts.length).toBeGreaterThan(0);
  });

  it("respects the 100001 prompt_order entry, not 100000", () => {
    const data = buildSTPreset({
      prompt_order: [
        // Legacy 100000 entry: built-ins only, no UUID custom prompts in the order.
        {
          character_id: 100000,
          order: [
            { identifier: "main", enabled: true },
            { identifier: "chatHistory", enabled: true },
            { identifier: "jailbreak", enabled: true },
          ],
        },
        // Active 100001 entry: includes the UUID prompt enabled.
        {
          character_id: 100001,
          order: [
            { identifier: "main", enabled: true },
            { identifier: "abc12345-6789-4abc-9def-0123456789ab", enabled: true },
            { identifier: "chatHistory", enabled: true },
            { identifier: "jailbreak", enabled: false },
          ],
        },
      ],
    });

    const transformed = transformSillyTavernTemplate(data, PROFILE_ID, "preset.json").template;
    const uuid = transformed.custom_prompts.find((p) => p.id === "abc12345-6789-4abc-9def-0123456789ab");
    const jailbreak = transformed.custom_prompts.find((p) => p.id === "jailbreak");

    expect(uuid?.enabled).toBe(true);
    expect(jailbreak?.enabled).toBe(false);
  });

  it("imports built-in non-marker prompts and skips structural markers", () => {
    const data = buildSTPreset();
    const transformed = transformSillyTavernTemplate(data, PROFILE_ID, "preset.json").template;

    const ids = transformed.custom_prompts.map((p) => p.id);
    expect(ids).toContain("main");
    expect(ids).toContain("jailbreak");
    expect(ids).not.toContain("chatHistory");
  });

  it("converts data markers to placeholder prompts in their order slot", () => {
    const data = buildSTPreset({
      prompts: [
        { identifier: "main", name: "Main Prompt", role: "system" as const, content: "You are {{char}}.", system_prompt: true },
        { identifier: "personaDescription", name: "User Persona", marker: true, system_prompt: true },
        { identifier: "charDescription", name: "Char Description", marker: true, system_prompt: true },
        { identifier: "scenario", name: "Scenario", marker: true, system_prompt: true },
        { identifier: "chatHistory", name: "Chat History", marker: true, system_prompt: true },
        { identifier: "jailbreak", name: "Post-History", role: "system" as const, content: "Stay in character.", system_prompt: true },
      ],
      prompt_order: [
        {
          character_id: 100001,
          order: [
            { identifier: "main", enabled: true },
            { identifier: "personaDescription", enabled: true },
            { identifier: "charDescription", enabled: true },
            { identifier: "scenario", enabled: false },
            { identifier: "chatHistory", enabled: true },
            { identifier: "jailbreak", enabled: true },
          ],
        },
      ],
    });

    const transformed = transformSillyTavernTemplate(data, PROFILE_ID, "preset.json").template;
    const ids = transformed.custom_prompts.map((p) => p.id);

    expect(ids).toEqual(["main", "personaDescription", "charDescription", "scenario", "jailbreak"]);

    const persona = transformed.custom_prompts.find((p) => p.id === "personaDescription")!;
    expect(persona.prompt).toBe("{{user.personality}}");
    expect(persona.enabled).toBe(true);
    expect(persona.position).toBe("top");

    const scenario = transformed.custom_prompts.find((p) => p.id === "scenario")!;
    expect(scenario.prompt).toBe("{{chapter.scenario}}");
    expect(scenario.enabled).toBe(false);
  });

  it("preserves the prompt_order arrangement exactly, appending unordered prompts last", () => {
    const data = buildSTPreset({
      prompts: [
        // File order intentionally scrambled vs the order list.
        { identifier: "jailbreak", name: "Post-History", role: "system" as const, content: "Stay in character.", system_prompt: true },
        { identifier: "ffffffff-0000-4000-8000-000000000001", name: "Orphan", role: "system" as const, content: "Not in order list." },
        { identifier: "chatHistory", name: "Chat History", marker: true, system_prompt: true },
        { identifier: "abc12345-6789-4abc-9def-0123456789ab", name: "Custom Note", role: "system" as const, content: "A note." },
        { identifier: "main", name: "Main Prompt", role: "system" as const, content: "You are {{char}}.", system_prompt: true },
      ],
      prompt_order: [
        {
          character_id: 100001,
          order: [
            { identifier: "main", enabled: true },
            { identifier: "abc12345-6789-4abc-9def-0123456789ab", enabled: true },
            { identifier: "chatHistory", enabled: true },
            { identifier: "jailbreak", enabled: true },
          ],
        },
      ],
    });

    const transformed = transformSillyTavernTemplate(data, PROFILE_ID, "preset.json").template;
    const ids = transformed.custom_prompts.map((p) => p.id);

    expect(ids).toEqual(["main", "abc12345-6789-4abc-9def-0123456789ab", "jailbreak", "ffffffff-0000-4000-8000-000000000001"]);

    const orphan = transformed.custom_prompts.find((p) => p.id === "ffffffff-0000-4000-8000-000000000001")!;
    expect(orphan.enabled).toBe(false);
  });

  it("maps injection_position 1 to depth, relative slots to top/bottom around chatHistory", () => {
    const data = buildSTPreset();
    const transformed = transformSillyTavernTemplate(data, PROFILE_ID, "preset.json").template;

    const main = transformed.custom_prompts.find((p) => p.id === "main")!;
    const jailbreak = transformed.custom_prompts.find((p) => p.id === "jailbreak")!;
    const customDepth = transformed.custom_prompts.find((p) => p.id === "abc12345-6789-4abc-9def-0123456789ab")!;

    expect(main.position).toBe("top");
    expect(jailbreak.position).toBe("bottom");
    expect(customDepth.position).toBe("depth");
    expect(customDepth.depth).toBe(4);
  });

  it("strips .json extension from the template name", () => {
    const data = buildSTPreset();
    const transformed = transformSillyTavernTemplate(data, PROFILE_ID, "Izumi 0503 (English).json").template;
    expect(transformed.name).toBe("Izumi 0503 (English)");
  });

  it("validates strictly — rejects payloads with no top-level prompts array", () => {
    const result = validateSillyTavernTemplate({ name: "not-a-preset" });
    expect(result.valid).toBe(false);
  });
});
