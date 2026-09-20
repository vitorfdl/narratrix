import { describe, expect, it } from "vitest";
import { resolveSheetExpression } from "./sheet-expression";

describe("resolveSheetExpression arithmetic functions", () => {
  it("computes floor for ability modifiers", () => {
    expect(resolveSheetExpression(`floor((\${sheet.strength} - 10) / 2)`, { strength: 13 })).toBe("1");
    expect(resolveSheetExpression(`floor((\${sheet.strength} - 10) / 2)`, { strength: 8 })).toBe("-1");
  });

  it("computes ceil, round and abs", () => {
    expect(resolveSheetExpression(`ceil(\${sheet.level} / 4)`, { level: 5 })).toBe("2");
    expect(resolveSheetExpression(`round(\${sheet.hp} / 3)`, { hp: 10 })).toBe("3");
    expect(resolveSheetExpression(`abs(\${sheet.delta})`, { delta: -4 })).toBe("4");
  });

  it("computes min and max with several arguments", () => {
    expect(resolveSheetExpression(`max(1, \${sheet.level} - 2, 3)`, { level: 10 })).toBe("8");
    expect(resolveSheetExpression(`min(\${sheet.hp}, \${sheet.max_hp})`, { hp: 25, max_hp: 20 })).toBe("20");
  });

  it("nests functions inside arithmetic", () => {
    expect(resolveSheetExpression(`2 + floor((\${sheet.level} - 1) / 4)`, { level: 9 })).toBe("4");
    expect(resolveSheetExpression(`10 + floor((\${sheet.wisdom} - 10) / 2)`, { wisdom: 15 })).toBe("12");
  });

  it("leaves non-arithmetic text untouched even when it contains letters", () => {
    expect(resolveSheetExpression(`Sword of \${sheet.element}`, { element: "Dawn" })).toBe("Sword of Dawn");
    expect(resolveSheetExpression(`flooring the \${sheet.count}`, { count: 3 })).toBe("flooring the 3");
  });

  it("still evaluates plain arithmetic", () => {
    expect(resolveSheetExpression(`10 + \${sheet.level} * 2`, { level: 3 })).toBe("16");
  });
});
