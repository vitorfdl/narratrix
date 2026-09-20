import { describe, expect, it } from "vitest";
import type { SheetField, SheetSection } from "@/schema/template-character-sheet-schema";
import { applySheetUpdates, buildSheetValuesJsonSchema, describeSheetFields, summarizeSheetFields } from "./sheet-catalog";

function field(overrides: Partial<SheetField> & Pick<SheetField, "key" | "label" | "type">): SheetField {
  return { id: overrides.key, span: 1, options: [], min: null, max: null, step: 1, columns: [], table_mode: "dynamic", rows: [], expression: null, default_value: undefined, ...overrides };
}

const sections: SheetSection[] = [
  {
    id: "s1",
    key: "stats",
    title: "Stats",
    style: { base: "clean", accent: null, background: null },
    columns: 2,
    span: 4,
    fields: [
      field({ key: "hp", label: "HP", type: "number", min: 0, max: 20, default_value: 10 }),
      field({ key: "class", label: "Class", type: "dropdown", options: ["Wizard", "Rogue"] }),
      field({ key: "skills", label: "Skills", type: "multi_select", options: ["Stealth", "Arcana"] }),
      // biome-ignore lint/suspicious/noTemplateCurlyInString: sheet expression syntax
      field({ key: "bonus", label: "Bonus", type: "number", expression: "${sheet.hp} / 2" }),
    ],
  },
  {
    id: "s2",
    key: "gear",
    title: "Gear",
    style: { base: "clean", accent: null, background: null },
    columns: 1,
    span: 4,
    fields: [
      field({ key: "notes", label: "Notes", type: "list" }),
      field({
        key: "items",
        label: "Items",
        type: "table",
        columns: [
          { id: "c1", label: "Item", expression: null },
          { id: "c2", label: "Qty", expression: null },
          // biome-ignore lint/suspicious/noTemplateCurlyInString: sheet expression syntax
          { id: "c3", label: "Total", expression: "${row.qty} * 2" },
        ],
      }),
      field({ key: "fixed", label: "Fixed", type: "table", table_mode: "static", rows: [["a", "b"]], columns: [{ id: "x", label: "X", expression: null }] }),
    ],
  },
];

describe("sheet catalog", () => {
  it("describes fields with read-only flags and resolved values", () => {
    const specs = describeSheetFields(sections, { hp: 12 });
    const bonus = specs.find((spec) => spec.key === "bonus");
    expect(bonus?.readOnly).toBe(true);
    expect(bonus?.value).toBe("6");
    expect(specs.find((spec) => spec.key === "fixed")?.readOnly).toBe(true);
    expect(specs.find((spec) => spec.key === "items")?.columns?.map((column) => column.computed)).toEqual([false, false, true]);
  });

  it("builds a JSON schema of writable values", () => {
    const schema = buildSheetValuesJsonSchema(sections) as { properties: Record<string, Record<string, unknown>> };
    expect(schema.properties.hp).toMatchObject({ type: "number", minimum: 0, maximum: 20 });
    expect(schema.properties.class).toMatchObject({ enum: ["Wizard", "Rogue"] });
    expect(schema.properties.bonus).toBeUndefined();
    expect(schema.properties.fixed).toBeUndefined();
  });

  it("summarizes writable fields on one line", () => {
    const summary = summarizeSheetFields(sections);
    expect(summary).toContain("hp (number 0-20)");
    expect(summary).toContain("class (one of: Wizard|Rogue)");
    expect(summary).toContain("items (table: Item, Qty)");
    expect(summary).not.toContain("bonus");
  });
});

describe("applySheetUpdates", () => {
  it("sets, increments and clamps numbers", () => {
    const result = applySheetUpdates(sections, { hp: 10 }, [
      { field: "hp", op: "add", value: 5 },
      { field: "stats.hp", op: "add", value: 100 },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.values.hp).toBe(20);
    expect(result.changes[0]).toBe("hp: 10 → 15");
  });

  it("matches dropdown options case-insensitively and rejects unknown ones", () => {
    const ok = applySheetUpdates(sections, {}, [{ field: "class", value: "rogue" }]);
    expect(ok.values.class).toBe("Rogue");
    const bad = applySheetUpdates(sections, {}, [{ field: "class", value: "Bard" }]);
    expect(bad.errors[0]).toContain("must be one of");
  });

  it("adds and removes list and multi-select entries", () => {
    const result = applySheetUpdates(sections, { notes: ["a", "b"], skills: ["Stealth"] }, [
      { field: "notes", op: "add", value: "c" },
      { field: "notes", op: "remove", value: "A" },
      { field: "skills", op: "add", value: ["arcana", "Stealth"] },
    ]);
    expect(result.values.notes).toEqual(["b", "c"]);
    expect(result.values.skills).toEqual(["Stealth", "Arcana"]);
  });

  it("appends table rows from arrays or objects and removes by index or first cell", () => {
    const result = applySheetUpdates(sections, { items: [["Rope", "1"]] }, [
      { field: "items", op: "add", value: ["Torch", "3"] },
      { field: "items", op: "add", value: [{ item: "Bread", qty: 2 }] },
      { field: "items", op: "remove", value: "rope" },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.values.items).toEqual([
      ["Torch", "3", ""],
      ["Bread", "2", ""],
    ]);
  });

  it("rejects read-only and unknown fields without aborting the batch", () => {
    const result = applySheetUpdates(sections, {}, [
      { field: "bonus", value: 1 },
      { field: "fixed", value: [] },
      { field: "nope", value: 1 },
      { field: "hp", value: 3 },
    ]);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toContain("read-only");
    expect(result.errors[2]).toContain("Unknown field");
    expect(result.values.hp).toBe(3);
  });
});
