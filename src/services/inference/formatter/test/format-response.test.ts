import { describe, expect, it } from "vitest";
import { FormatTemplate } from "@/schema/template-format-schema";
import { formatFinalText } from "../format-response";

describe("formatFinalText", () => {
  const fullTemplate: FormatTemplate = {
    config: {
      settings: {
        trim_assistant_incomplete: true,
        collapse_consecutive_lines: true,
        trim_double_spaces: true,
      },
    },
  } as FormatTemplate;

  it("should trim to end of sentence and collapse newlines by default if no template is provided", () => {
    const input = "Hello world incomplete\n\n\n\nAnother line.";
    const expected = "Hello world incomplete\n\nAnother line.";
    expect(formatFinalText(input).text).toBe(expected);
  });

  it("should apply all formatting options when enabled in the template", () => {
    const input = "Hello  world incomplete\n\n\n\nAnother   line.";
    const expected = "Hello world incomplete\n\nAnother line.";
    expect(formatFinalText(input, fullTemplate).text).toBe(expected);
  });

  it("should only apply enabled formatting options in the template", () => {
    const template: FormatTemplate = {
      config: {
        settings: {
          trim_assistant_incomplete: false,
          collapse_consecutive_lines: true,
          trim_double_spaces: false,
        },
      },
    } as FormatTemplate;

    const input = "Hello  world incomplete\n\n\n\nAnother   line.";
    const expected = "Hello  world incomplete\n\nAnother   line.";
    expect(formatFinalText(input, template).text).toBe(expected);
  });

  it("should trim end of sentence only if enabled in the template", () => {
    const template: FormatTemplate = {
      config: {
        settings: { trim_assistant_incomplete: true },
      },
    } as FormatTemplate;

    const input = "Hello world.\n\nThis isncomplete sentence";
    const expected = "Hello world.";
    expect(formatFinalText(input, template).text).toBe(expected);
  });

  it("should remove reasoning blocks if prefix and suffix are defined", () => {
    const template: FormatTemplate = {
      config: {
        settings: { trim_assistant_incomplete: true },
        reasoning: { prefix: "<think>", suffix: "</think>" },
      },
    } as FormatTemplate;

    const input = "Hello world.\n\n<think>This is thinking text</think>";
    const expected = "Hello world.";

    const result = formatFinalText(input, template);
    expect(result.text).toBe(expected);
    expect(result.reasoning).toBe("This is thinking text");
  });
});
