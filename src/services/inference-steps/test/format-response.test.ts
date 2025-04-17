import { FormatTemplate } from "@/schema/template-format-schema";
import { describe, expect, it } from "vitest";
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
    expect(formatFinalText(input)).toBe(expected);
  });

  it("should apply all formatting options when enabled in the template", () => {
    const input = "Hello  world incomplete\n\n\n\nAnother   line.";
    const expected = "Hello world incomplete\n\nAnother line.";
    expect(formatFinalText(input, fullTemplate)).toBe(expected);
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
    expect(formatFinalText(input, template)).toBe(expected);
  });

  it("should trim end of sentence only if enabled in the template", () => {
    const template: FormatTemplate = {
      config: {
        settings: { trim_assistant_incomplete: true },
      },
    } as FormatTemplate;

    const input = "Hello world.\n\nThis isncomplete sentence";
    const expected = "Hello world.";
    expect(formatFinalText(input, template)).toBe(expected);
  });
});
