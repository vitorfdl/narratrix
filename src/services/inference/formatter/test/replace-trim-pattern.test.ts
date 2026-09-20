import { describe, expect, it } from "vitest";
import { replaceCommentPattern, replaceStringPlaceholders, replaceTrimPattern } from "../replace-text-placeholders";

describe("replaceTrimPattern", () => {
  it("removes a bare {{trim}} marker", () => {
    expect(replaceTrimPattern("before{{trim}}after")).toBe("beforeafter");
  });

  it("consumes newlines immediately before and after the marker", () => {
    expect(replaceTrimPattern("before\n{{trim}}\nafter")).toBe("beforeafter");
  });

  it("collapses multiple consecutive blank lines around the marker", () => {
    expect(replaceTrimPattern("before\n\n\n{{trim}}\n\nafter")).toBe("beforeafter");
  });

  it("handles Windows CRLF line endings", () => {
    expect(replaceTrimPattern("before\r\n{{trim}}\r\nafter")).toBe("beforeafter");
  });

  it("preserves adjacent spaces and tabs (only newlines are consumed)", () => {
    expect(replaceTrimPattern("before {{trim}} after")).toBe("before  after");
    expect(replaceTrimPattern("before\t{{trim}}\tafter")).toBe("before\t\tafter");
  });

  it("is case-insensitive", () => {
    expect(replaceTrimPattern("a\n{{TRIM}}\nb")).toBe("ab");
    expect(replaceTrimPattern("a\n{{Trim}}\nb")).toBe("ab");
  });

  it("removes every occurrence", () => {
    expect(replaceTrimPattern("a{{trim}}b{{trim}}c")).toBe("abc");
  });

  it("leaves text without the marker untouched", () => {
    expect(replaceTrimPattern("no marker here\nsecond line")).toBe("no marker here\nsecond line");
  });

  it("handles empty string", () => {
    expect(replaceTrimPattern("")).toBe("");
  });

  it("clears the user's multi-line comment + trim header to nothing", () => {
    const input = "{{// custom header which grounds\nThe scene and affects\nThe entire roleplay}}{{trim}}";
    const result = replaceTrimPattern(replaceCommentPattern(input));

    expect(result).toBe("");
  });
});

describe("comment + trim stripping with no chat config (early-return path)", () => {
  it("strips a multi-line comment and {{trim}} even when config is undefined", () => {
    const input = "{{// custom header which grounds\nThe scene and affects\nThe entire roleplay}}{{trim}}Actual prompt.";
    const result = replaceStringPlaceholders(input, undefined);

    expect(result).toBe("Actual prompt.");
  });

  it("strips a comment when only an empty config object is provided", () => {
    const result = replaceStringPlaceholders("Keep {{// drop me}}this.", {});
    expect(result).toBe("Keep this.");
  });
});
