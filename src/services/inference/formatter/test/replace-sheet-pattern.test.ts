import { describe, expect, it } from "vitest";
import type { SheetSection } from "@/schema/template-character-sheet-schema";
import { CharacterSheetPromptContext, replaceSheetPattern } from "../replace-sheet-pattern";

const sections: SheetSection[] = [
  {
    id: "s1",
    key: "basic_info",
    title: "Basic Info",
    style: "plain",
    columns: 2,
    span: 4,
    fields: [
      {
        id: "f1",
        key: "class",
        label: "Class",
        type: "text",
        span: 1,
        options: [],
        min: null,
        max: null,
        step: 1,
        columns: [],
        table_mode: "dynamic",
        rows: [],
        expression: null,
        default_value: "Wizard",
      },
      { id: "f2", key: "level", label: "Level", type: "number", span: 1, options: [], min: null, max: null, step: 1, columns: [], table_mode: "dynamic", rows: [], expression: null, default_value: 1 },
      {
        id: "f3",
        key: "proficiency",
        label: "Proficiency",
        type: "number",
        span: 1,
        options: [],
        min: null,
        max: null,
        step: 1,
        columns: [],
        table_mode: "dynamic",
        rows: [],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: sheet expression syntax
        expression: "2 + ${sheet.level}",
        default_value: null,
      },
      {
        id: "f4",
        key: "languages",
        label: "Languages",
        type: "list",
        span: 1,
        options: [],
        min: null,
        max: null,
        step: 1,
        columns: [],
        table_mode: "dynamic",
        rows: [],
        expression: null,
        default_value: null,
      },
    ],
  },
  {
    id: "s2",
    key: "inventory",
    title: "Inventory",
    style: "plain",
    columns: 1,
    span: 4,
    fields: [
      {
        id: "f5",
        key: "items",
        label: "Items",
        type: "table",
        span: 1,
        options: [],
        min: null,
        max: null,
        step: 1,
        columns: [
          { id: "c1", label: "Item", expression: null },
          { id: "c2", label: "Qty", expression: null },
          // biome-ignore lint/suspicious/noTemplateCurlyInString: sheet expression syntax
          { id: "c3", label: "Total", expression: "${row.qty} * 2" },
        ],
        table_mode: "dynamic",
        rows: [],
        expression: null,
        default_value: null,
      },
    ],
  },
];

const sheet: CharacterSheetPromptContext = {
  sections,
  values: {
    level: 5,
    languages: ["Common", "Elvish"],
    items: [
      ["Rope", "2"],
      ["Torch", "3"],
    ],
  },
  characterName: "Mira",
};

describe("replaceSheetPattern", () => {
  it("replaces a section reference with labeled markdown", () => {
    const result = replaceSheetPattern("Sheet:\n{{char.Basic Info}}", sheet);
    expect(result).toContain("### Basic Info");
    expect(result).toContain("**Class:** Wizard");
    expect(result).toContain("**Level:** 5");
    expect(result).toContain("**Proficiency:** 7");
    expect(result).toContain("**Languages:**\n- Common\n- Elvish");
  });

  it("replaces a section.field reference with the bare value", () => {
    expect(replaceSheetPattern("You are level {{char.basic_info.level}}.", sheet)).toBe("You are level 5.");
    expect(replaceSheetPattern("Prof: {{char.basic_info.proficiency}}", sheet)).toBe("Prof: 7");
  });

  it("renders the whole sheet with {{char.sheet}}", () => {
    const result = replaceSheetPattern("{{char.sheet}}", sheet);
    expect(result.indexOf("### Basic Info")).toBeLessThan(result.indexOf("### Inventory"));
    expect(result).toContain("| Rope | 2 | 4 |");
  });

  it("resolves {{user.*}} against the user sheet and skips reserved macros", () => {
    expect(replaceSheetPattern("{{user.basic_info.level}} {{user.name}} {{user.personality}}", sheet, "user")).toBe("5 {{user.name}} {{user.personality}}");
    expect(replaceSheetPattern("{{char.level}}", sheet, "user")).toBe("{{char.level}}");
  });

  it("renders tables as markdown tables with column expressions resolved", () => {
    const result = replaceSheetPattern("{{char.Inventory.Items}}", sheet);
    expect(result).toContain("| Item | Qty | Total |");
    expect(result).toContain("| --- | --- | --- |");
    expect(result).toContain("| Rope | 2 | 4 |");
    expect(result).toContain("| Torch | 3 | 6 |");
  });

  it("resolves a bare field reference across sections", () => {
    expect(replaceSheetPattern("{{char.level}}", sheet)).toBe("5");
    expect(replaceSheetPattern("{{char.sheet.class}}", sheet)).toBe("Wizard");
  });

  it("matches keys case-insensitively and slugifies free-form segments", () => {
    expect(replaceSheetPattern("{{CHAR.BASIC_INFO.LEVEL}}", sheet)).toBe("5");
    expect(replaceSheetPattern("{{char.Basic Info.Level}}", sheet)).toBe("5");
  });

  it("leaves unknown references and non-sheet macros untouched", () => {
    expect(replaceSheetPattern("{{char.Nope}} {{char}} {{character.name}}", sheet)).toBe("{{char.Nope}} {{char}} {{character.name}}");
  });

  it("leaves references untouched when no sheet is configured", () => {
    expect(replaceSheetPattern("{{char.basic_info}}", undefined)).toBe("{{char.basic_info}}");
  });
});
