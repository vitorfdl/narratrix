import { z } from "zod";
import { slugifyKey } from "@/utils/sheet-expression";
import { baseTemplateSchema } from "./template-base-schema";

export const SHEET_FIELD_TYPES = ["text", "textarea", "number", "number_stepper", "dropdown", "multi_select", "list", "table"] as const;

export const SHEET_FIELD_TYPE_LABELS: Record<SheetFieldType, string> = {
  text: "Text",
  textarea: "Multi-line Text",
  number: "Number",
  number_stepper: "Number with Steppers",
  dropdown: "Dropdown",
  multi_select: "Multi-Select Dropdown",
  list: "List",
  table: "Table",
};

const sheetFieldTypeEnum = z.enum(SHEET_FIELD_TYPES);

export const SHEET_SECTION_STYLES = ["plain", "parchment", "ornate", "arcane", "shadow"] as const;

export const SHEET_SECTION_STYLE_LABELS: Record<SheetSectionStyle, string> = {
  plain: "Plain",
  parchment: "Parchment",
  ornate: "Ornate Frame",
  arcane: "Arcane",
  shadow: "Shadow",
};

const sheetSectionStyleEnum = z.enum(SHEET_SECTION_STYLES);

// Accepts a bare string (earlier format) and upgrades it to a column object
const sheetTableColumnSchema = z.preprocess(
  (value) => (typeof value === "string" ? { id: crypto.randomUUID(), label: value, expression: null } : value),
  z.object({
    id: z.string(),
    label: z.string(),
    // Computed column: evaluated per row, referencing sibling cells as ${row.column_label}
    expression: z.string().nullable().default(null),
  }),
);

const sheetFieldSchema = z.object({
  id: z.string(),
  // Key used to reference the field in expressions: ${sheet.key}
  key: z.string(),
  label: z.string(),
  type: sheetFieldTypeEnum,
  // How many grid columns of the parent section this field spans (clamped to section columns at render)
  span: z.number().min(1).max(4).default(1),
  options: z.array(z.string()).default([]),
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  step: z.number().default(1),
  columns: z.array(sheetTableColumnSchema).default([]),
  // dynamic: users add/remove rows when filling. static: rows are fixed in the template.
  table_mode: z.enum(["dynamic", "static"]).default("dynamic"),
  // Template-defined rows for static tables; cells may contain expressions
  rows: z.array(z.array(z.string())).default([]),
  // When set, the field is computed and read-only
  expression: z.string().nullable().default(null),
  default_value: z.unknown().optional(),
});

const sheetSectionSchema = z.object({
  id: z.string(),
  // Key used to reference the section in prompts: {{char.key}}
  key: z.string(),
  title: z.string(),
  style: sheetSectionStyleEnum.default("plain"),
  columns: z.number().min(1).max(4).default(2),
  // How many columns of the 4-column sheet grid this section spans (4 = full width)
  span: z.number().min(1).max(4).default(4),
  fields: z.array(sheetFieldSchema).default([]),
});

// Sections saved before keys existed get one derived from their title, kept unique
function ensureSectionKeys(sections: unknown): unknown {
  if (!Array.isArray(sections)) {
    return sections;
  }
  const used = new Set<string>();
  return sections.map((section) => {
    if (typeof section !== "object" || section === null) {
      return section;
    }
    const record = section as Record<string, unknown>;
    let key = typeof record.key === "string" && record.key ? record.key : slugifyKey(typeof record.title === "string" ? record.title : "section");
    const base = key;
    let counter = 2;
    while (used.has(key)) {
      key = `${base}_${counter++}`;
    }
    used.add(key);
    return { ...record, key };
  });
}

export const characterSheetTemplateSchema = baseTemplateSchema.extend({
  sections: z.preprocess(ensureSectionKeys, z.array(sheetSectionSchema).default([])),
});

export const newCharacterSheetTemplateSchema = characterSheetTemplateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type SheetFieldType = (typeof SHEET_FIELD_TYPES)[number];
export type SheetSectionStyle = (typeof SHEET_SECTION_STYLES)[number];
export type SheetTableColumn = z.infer<typeof sheetTableColumnSchema>;
export type SheetField = z.infer<typeof sheetFieldSchema>;
export type SheetSection = z.infer<typeof sheetSectionSchema>;
export type CharacterSheetTemplate = z.infer<typeof characterSheetTemplateSchema>;
export type NewCharacterSheetTemplate = z.infer<typeof newCharacterSheetTemplateSchema>;

// Values are keyed by field key. list → string[], table → string[][], multi_select → string[]
export type SheetValues = Record<string, unknown>;

export { sheetFieldSchema, sheetSectionSchema };
