import { beforeEach, describe, expect, it } from "vitest";
import { replaceDateTimePattern } from "../replace-text";

describe("replaceDateTimePattern", () => {
  let mockDate: Date;

  beforeEach(() => {
    // Mock a specific date: January 15, 2024, 2:30:45 PM (Monday)
    mockDate = new Date("2024-01-15T14:30:45.123Z");
  });

  it("should replace {{time}} with 12-hour format time", () => {
    const input = "Current time is {{time}}";
    const result = replaceDateTimePattern(input, mockDate);

    // Should be in 12-hour format with AM/PM and not contain the original pattern
    expect(result).toMatch(/Current time is \d{1,2}:\d{2} [AP]M/);
    expect(result).not.toContain("{{time}}");
  });

  it("should replace {{date}} with localized date format", () => {
    const input = "Today's date is {{date}}";
    const result = replaceDateTimePattern(input, mockDate);

    // Should contain the year, month, and day and not contain the original pattern
    expect(result).toContain("2024");
    expect(result).toContain("January");
    expect(result).toContain("15");
    expect(result).not.toContain("{{date}}");
  });

  it("should replace {{weekday}} with full weekday name", () => {
    const input = "Today is {{weekday}}";
    const result = replaceDateTimePattern(input, mockDate);

    // Should contain a valid weekday name and not contain the original pattern
    expect(result).toMatch(/Today is (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    expect(result).not.toContain("{{weekday}}");
  });

  it("should replace {{isotime}} with 24-hour ISO time format", () => {
    const input = "ISO time: {{isotime}}";
    const result = replaceDateTimePattern(input, mockDate);

    // Should be in HH:MM:SS format (24-hour) and not contain the original pattern
    expect(result).toMatch(/ISO time: \d{2}:\d{2}:\d{2}/);
    expect(result).not.toContain("{{isotime}}");
  });

  it("should replace {{isodate}} with YYYY-MM-DD format", () => {
    const input = "ISO date: {{isodate}}";
    const result = replaceDateTimePattern(input, mockDate);

    // Should be in YYYY-MM-DD format and not contain the original pattern
    expect(result).toBe("ISO date: 2024-01-15");
    expect(result).not.toContain("{{isodate}}");
  });

  it("should handle multiple date/time patterns in the same text", () => {
    const input = "On {{weekday}}, {{date}} at {{time}} ({{isotime}} / {{isodate}})";
    const result = replaceDateTimePattern(input, mockDate);

    // Verify all patterns are replaced and none remain
    expect(result).not.toContain("{{weekday}}");
    expect(result).not.toContain("{{date}}");
    expect(result).not.toContain("{{time}}");
    expect(result).not.toContain("{{isotime}}");
    expect(result).not.toContain("{{isodate}}");

    // Verify expected content is present
    expect(result).toContain("2024");
    expect(result).toContain("2024-01-15");
    expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/); // 12-hour time
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/); // ISO time pattern
  });

  it("should handle repeated patterns", () => {
    const input = "{{date}} - {{date}} - {{date}}";
    const result = replaceDateTimePattern(input, mockDate);

    // Should replace all instances and not contain any original patterns
    expect(result).not.toContain("{{date}}");
    expect(result).toContain("2024");
    expect(result).toContain("January");
    expect(result).toContain("15");

    // Should have three instances of the date
    const dateMatches = result.match(/2024/g);
    expect(dateMatches).toHaveLength(3);
  });

  it("should preserve non-date/time patterns", () => {
    const input = "Character {{char}} on {{date}} rolls {{roll:1d20}}";
    const result = replaceDateTimePattern(input, mockDate);

    // Should preserve {{char}} and {{roll:1d20}} but replace {{date}}
    expect(result).toContain("{{char}}");
    expect(result).toContain("{{roll:1d20}}");
    expect(result).not.toContain("{{date}}");
    expect(result).toContain("2024");
  });

  it("should handle text without any date/time patterns", () => {
    const input = "This is just regular text with no date/time patterns.";
    const result = replaceDateTimePattern(input, mockDate);

    expect(result).toBe(input);
  });

  it("should handle empty string", () => {
    const result = replaceDateTimePattern("", mockDate);
    expect(result).toBe("");
  });

  it("should handle case sensitivity correctly", () => {
    const input = "{{TIME}} {{Date}} {{WEEKDAY}} should not be replaced";
    const result = replaceDateTimePattern(input, mockDate);

    // Should not replace uppercase versions
    expect(result).toBe(input);
  });

  it("should handle partial matches correctly", () => {
    const input = "{{times}} {{dates}} {{weekdays}} should not be replaced";
    const result = replaceDateTimePattern(input, mockDate);

    // Should not replace partial matches
    expect(result).toBe(input);
  });

  it("should handle nested braces correctly", () => {
    const input = "{{{date}}} and {{{{time}}}} patterns";
    const result = replaceDateTimePattern(input, mockDate);

    // Should replace the inner patterns correctly
    expect(result).not.toContain("{{date}}");
    expect(result).not.toContain("{{time}}");
    expect(result).toContain("2024");
    expect(result).toMatch(/\{\{.*[AP]M.*\}\}/); // Should have {{TIME}} pattern
  });

  it("should work with different date scenarios", () => {
    // Test with a different date - December 31, 2023 (Sunday)
    const newMockDate = new Date("2023-12-31T23:59:59.999Z");

    const input = "{{weekday}} {{date}} {{isodate}}";
    const result = replaceDateTimePattern(input, newMockDate);

    // Verify patterns are replaced
    expect(result).not.toContain("{{weekday}}");
    expect(result).not.toContain("{{date}}");
    expect(result).not.toContain("{{isodate}}");

    // Verify expected content
    expect(result).toContain("2023");
    expect(result).toContain("December");
    expect(result).toContain("31");
    expect(result).toContain("2023-12-31");
  });

  it("should handle all patterns in a complex sentence", () => {
    const input = "Meeting scheduled for {{weekday}}, {{date}} at {{time}} ({{isotime}} UTC, reference: {{isodate}})";
    const result = replaceDateTimePattern(input, mockDate);

    // Verify all patterns are replaced and none remain
    expect(result).not.toContain("{{");
    expect(result).not.toContain("}}");

    // Verify expected content is present
    expect(result).toContain("2024");
    expect(result).toContain("2024-01-15");
    expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/); // 12-hour time
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/); // ISO time
  });

  it("should maintain text structure and spacing", () => {
    const input = "Start: {{time}}\nDate: {{date}}\n  Weekday: {{weekday}}";
    const result = replaceDateTimePattern(input, mockDate);

    // Should preserve newlines and spacing
    expect(result).toContain("\n");
    expect(result).toContain("  ");
    expect(result.split("\n")).toHaveLength(3);

    // Should not contain any original patterns
    expect(result).not.toContain("{{time}}");
    expect(result).not.toContain("{{date}}");
    expect(result).not.toContain("{{weekday}}");
  });

  it("should produce consistent results for the same input", () => {
    const input = "{{time}} {{date}} {{weekday}}";
    const result1 = replaceDateTimePattern(input, mockDate);
    const result2 = replaceDateTimePattern(input, mockDate);

    // Should produce identical results for the same date
    expect(result1).toBe(result2);
    expect(result1).not.toContain("{{");
    expect(result1).not.toContain("}}");
  });
});
