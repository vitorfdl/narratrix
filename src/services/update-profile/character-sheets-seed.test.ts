import { describe, expect, it } from "vitest";
import { characterSheetTemplateSchema, type SheetSection } from "@/schema/template-character-sheet-schema";
import { buildResolvedSheetValues, isExpressionField } from "@/utils/sheet-expression";
import characterSheets from "./data/character_sheets.json";

function parseSections(template: (typeof characterSheets)[number]): SheetSection[] {
  return characterSheetTemplateSchema.parse({
    id: crypto.randomUUID(),
    profile_id: crypto.randomUUID(),
    name: template.name,
    sections: template.sections,
    created_at: new Date(),
    updated_at: new Date(),
  }).sections;
}

describe("bundled character sheet templates", () => {
  it("ships both templates", () => {
    expect(characterSheets.map((t) => t.name)).toEqual(["DnD 5E Character", "Novel Protagonist"]);
  });

  it("parses against the character sheet schema", () => {
    for (const template of characterSheets) {
      expect(parseSections(template).length).toBeGreaterThan(0);
    }
  });

  it("keeps field and section keys unique within each template", () => {
    for (const template of characterSheets) {
      const sections = parseSections(template);
      const sectionKeys = sections.map((s) => s.key);
      expect(new Set(sectionKeys).size).toBe(sectionKeys.length);
      const fieldKeys = sections.flatMap((s) => s.fields.map((f) => f.key));
      expect(new Set(fieldKeys).size).toBe(fieldKeys.length);
    }
  });

  it("evaluates every expression to a finite number using default values", () => {
    for (const template of characterSheets) {
      const sections = parseSections(template);
      const resolved = buildResolvedSheetValues(sections, {}, "Test Hero");
      for (const field of sections.flatMap((s) => s.fields)) {
        if (isExpressionField(field.expression)) {
          expect(Number.isFinite(Number(resolved[field.key])), `${template.name} › ${field.key} → ${resolved[field.key]}`).toBe(true);
        }
      }
    }
  });
});
