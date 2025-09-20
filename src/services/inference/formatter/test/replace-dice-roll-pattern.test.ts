import { describe, expect, it, vi } from "vitest";
import { replaceDiceRollPattern } from "../replace-text-placeholders";

describe("replaceDiceRollPattern", () => {
  it("should replace simple dice roll patterns", () => {
    const input = "Roll a {{roll:1d20}} for initiative!";
    const result = replaceDiceRollPattern(input);

    // Extract the rolled number
    const match = result.match(/Roll a (\d+) for initiative!/);
    expect(match).not.toBeNull();

    if (match) {
      const rolledValue = Number.parseInt(match[1], 10);
      expect(rolledValue).toBeGreaterThanOrEqual(1);
      expect(rolledValue).toBeLessThanOrEqual(20);
    }
  });

  it("should handle dice rolls with positive modifiers", () => {
    const input = "Attack roll: {{roll:1d20+5}}";
    const result = replaceDiceRollPattern(input);

    const match = result.match(/Attack roll: (\d+)/);
    expect(match).not.toBeNull();

    if (match) {
      const rolledValue = Number.parseInt(match[1], 10);
      expect(rolledValue).toBeGreaterThanOrEqual(6); // 1 + 5
      expect(rolledValue).toBeLessThanOrEqual(25); // 20 + 5
    }
  });

  it("should handle dice rolls with negative modifiers", () => {
    const input = "Damage roll: {{roll:2d6-1}}";
    const result = replaceDiceRollPattern(input);

    const match = result.match(/Damage roll: (-?\d+)/);
    expect(match).not.toBeNull();

    if (match) {
      const rolledValue = Number.parseInt(match[1], 10);
      expect(rolledValue).toBeGreaterThanOrEqual(1); // 2 - 1
      expect(rolledValue).toBeLessThanOrEqual(11); // 12 - 1
    }
  });

  it("should handle multiple dice rolls in the same text", () => {
    const input = "Roll {{roll:1d4}} for damage and {{roll:1d20}} for hit!";
    const result = replaceDiceRollPattern(input);

    const matches = result.match(/Roll (\d+) for damage and (\d+) for hit!/);
    expect(matches).not.toBeNull();

    if (matches) {
      const damageRoll = Number.parseInt(matches[1], 10);
      const hitRoll = Number.parseInt(matches[2], 10);

      expect(damageRoll).toBeGreaterThanOrEqual(1);
      expect(damageRoll).toBeLessThanOrEqual(4);
      expect(hitRoll).toBeGreaterThanOrEqual(1);
      expect(hitRoll).toBeLessThanOrEqual(20);
    }
  });

  it("should handle multiple dice (e.g., 3d6)", () => {
    const input = "Ability score: {{roll:3d6}}";
    const result = replaceDiceRollPattern(input);

    const match = result.match(/Ability score: (\d+)/);
    expect(match).not.toBeNull();

    if (match) {
      const rolledValue = Number.parseInt(match[1], 10);
      expect(rolledValue).toBeGreaterThanOrEqual(3); // 3 * 1
      expect(rolledValue).toBeLessThanOrEqual(18); // 3 * 6
    }
  });

  it("should handle large dice with modifiers", () => {
    const input = "Percentile roll: {{roll:1d100+10}}";
    const result = replaceDiceRollPattern(input);

    const match = result.match(/Percentile roll: (\d+)/);
    expect(match).not.toBeNull();

    if (match) {
      const rolledValue = Number.parseInt(match[1], 10);
      expect(rolledValue).toBeGreaterThanOrEqual(11); // 1 + 10
      expect(rolledValue).toBeLessThanOrEqual(110); // 100 + 10
    }
  });

  it("should return original text for invalid dice patterns", () => {
    const invalidPatterns = [
      "Invalid: {{roll:abc}}",
      "Invalid: {{roll:1d}}",
      "Invalid: {{roll:d20}}",
      "Invalid: {{roll:1d20+}}",
      "Invalid: {{roll:1d20+abc}}",
      "Invalid: {{roll:}}",
      "Invalid: {{roll:1d20+5+3}}",
    ];

    invalidPatterns.forEach((pattern) => {
      const result = replaceDiceRollPattern(pattern);
      expect(result).toBe(pattern);
    });
  });

  it("should handle edge case validation limits", () => {
    // Test dice count limits
    const tooManyDice = "{{roll:101d6}}";
    expect(replaceDiceRollPattern(tooManyDice)).toBe(tooManyDice);

    const zeroDice = "{{roll:0d6}}";
    expect(replaceDiceRollPattern(zeroDice)).toBe(zeroDice);

    // Test sides limits
    const tooManySides = "{{roll:1d1001}}";
    expect(replaceDiceRollPattern(tooManySides)).toBe(tooManySides);

    const zeroSides = "{{roll:1d0}}";
    expect(replaceDiceRollPattern(zeroSides)).toBe(zeroSides);
  });

  it("should handle valid edge cases at limits", () => {
    const maxDice = "{{roll:100d6}}";
    const result1 = replaceDiceRollPattern(maxDice);
    expect(result1).not.toBe(maxDice);

    const maxSides = "{{roll:1d1000}}";
    const result2 = replaceDiceRollPattern(maxSides);
    expect(result2).not.toBe(maxSides);
  });

  it("should preserve non-dice roll patterns", () => {
    const input = "Character name: {{char}} rolls {{roll:1d20}} against {{user}}";
    const result = replaceDiceRollPattern(input);

    // Should preserve {{char}} and {{user}} but replace {{roll:1d20}}
    expect(result).toContain("{{char}}");
    expect(result).toContain("{{user}}");
    expect(result).not.toContain("{{roll:1d20}}");
  });

  it("should handle case insensitive dice notation", () => {
    const input = "Roll: {{roll:1D20+5}}";
    const result = replaceDiceRollPattern(input);

    const match = result.match(/Roll: (\d+)/);
    expect(match).not.toBeNull();

    if (match) {
      const rolledValue = Number.parseInt(match[1], 10);
      expect(rolledValue).toBeGreaterThanOrEqual(6);
      expect(rolledValue).toBeLessThanOrEqual(25);
    }
  });

  it("should handle whitespace in roll expressions", () => {
    const input = "Roll: {{roll: 1d20 + 5 }}";
    const result = replaceDiceRollPattern(input);

    const match = result.match(/Roll: (\d+)/);
    expect(match).not.toBeNull();

    if (match) {
      const rolledValue = Number.parseInt(match[1], 10);
      expect(rolledValue).toBeGreaterThanOrEqual(6);
      expect(rolledValue).toBeLessThanOrEqual(25);
    }
  });

  it("should handle text without any dice roll patterns", () => {
    const input = "This is just regular text with no dice rolls.";
    const result = replaceDiceRollPattern(input);
    expect(result).toBe(input);
  });

  it("should handle empty string", () => {
    const result = replaceDiceRollPattern("");
    expect(result).toBe("");
  });

  it("should produce consistent results with mocked random", () => {
    // Mock Math.random to return 0.5 (should give middle values)
    const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const input = "{{roll:1d6}}";
      const result = replaceDiceRollPattern(input);

      // With Math.random() = 0.5, Math.floor(0.5 * 6) + 1 = 3 + 1 = 4
      expect(result).toBe("4");
    } finally {
      mockRandom.mockRestore();
    }
  });

  it("should handle complex scenarios with multiple dice types", () => {
    const input = "Fireball: {{roll:8d6}} fire damage, save DC {{roll:1d20+8}}";
    const result = replaceDiceRollPattern(input);

    const matches = result.match(/Fireball: (\d+) fire damage, save DC (\d+)/);
    expect(matches).not.toBeNull();

    if (matches) {
      const fireballDamage = Number.parseInt(matches[1], 10);
      const saveDC = Number.parseInt(matches[2], 10);

      expect(fireballDamage).toBeGreaterThanOrEqual(8); // 8 * 1
      expect(fireballDamage).toBeLessThanOrEqual(48); // 8 * 6
      expect(saveDC).toBeGreaterThanOrEqual(9); // 1 + 8
      expect(saveDC).toBeLessThanOrEqual(28); // 20 + 8
    }
  });
});
