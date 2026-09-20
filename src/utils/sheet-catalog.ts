import type { SheetField, SheetFieldType, SheetSection, SheetValues } from "@/schema/template-character-sheet-schema";
import { buildResolvedSheetValues, getRawSheetValue, isExpressionField, slugifyKey, tableColumnKey } from "./sheet-expression";

export interface SheetColumnSpec {
  key: string;
  label: string;
  computed: boolean;
}

export interface SheetFieldSpec {
  key: string;
  section: string;
  label: string;
  type: SheetFieldType;
  readOnly: boolean;
  options?: string[];
  min?: number | null;
  max?: number | null;
  columns?: SheetColumnSpec[];
  value: unknown;
}

export type SheetUpdateOp = "set" | "add" | "remove";

export interface SheetUpdate {
  field: string;
  op?: SheetUpdateOp;
  value?: unknown;
}

export interface SheetUpdateResult {
  values: SheetValues;
  changes: string[];
  errors: string[];
}

const NUMERIC_TYPES: SheetFieldType[] = ["number", "number_stepper"];

function isReadOnlyField(field: SheetField): boolean {
  return isExpressionField(field.expression) || (field.type === "table" && field.table_mode === "static");
}

function columnSpecs(field: SheetField): SheetColumnSpec[] {
  const columns = field.columns.length > 0 ? field.columns : [{ id: "value", label: "Value", expression: null }];
  return columns.map((column) => ({ key: tableColumnKey(column), label: column.label, computed: isExpressionField(column.expression) }));
}

export function findSheetFieldByReference(sections: SheetSection[], reference: string): SheetField | undefined {
  const segments = reference
    .split(".")
    .map((segment) => slugifyKey(segment))
    .filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }
  if (segments.length >= 2) {
    const section = sections.find((candidate) => candidate.key.toLowerCase() === segments[0]);
    const fieldKey = segments.slice(1).join("_");
    const scoped = section?.fields.find((field) => field.key.toLowerCase() === fieldKey);
    if (scoped) {
      return scoped;
    }
  }
  const flat = segments.join("_");
  return sections.flatMap((section) => section.fields).find((field) => field.key.toLowerCase() === flat);
}

export function describeSheetFields(sections: SheetSection[], values: SheetValues, characterName?: string): SheetFieldSpec[] {
  const resolved = buildResolvedSheetValues(sections, values, characterName);
  const specs: SheetFieldSpec[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      const spec: SheetFieldSpec = {
        key: field.key,
        section: section.key,
        label: field.label,
        type: field.type,
        readOnly: isReadOnlyField(field),
        value: field.type === "table" && field.table_mode === "static" ? field.rows : resolved[field.key],
      };
      if (field.type === "dropdown" || field.type === "multi_select") {
        spec.options = field.options;
      }
      if (NUMERIC_TYPES.includes(field.type)) {
        spec.min = field.min;
        spec.max = field.max;
      }
      if (field.type === "table") {
        spec.columns = columnSpecs(field);
      }
      specs.push(spec);
    }
  }
  return specs;
}

/**
 * JSON Schema describing the writable values of a sheet, keyed by field key.
 * Read-only fields (expressions, static tables) are omitted.
 */
export function buildSheetValuesJsonSchema(sections: SheetSection[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      if (isReadOnlyField(field)) {
        continue;
      }
      const description = `${section.title} › ${field.label}`;
      switch (field.type) {
        case "number":
        case "number_stepper":
          properties[field.key] = {
            type: "number",
            description,
            ...(field.min !== null ? { minimum: field.min } : {}),
            ...(field.max !== null ? { maximum: field.max } : {}),
          };
          break;
        case "dropdown":
          properties[field.key] = { type: "string", description, ...(field.options.length > 0 ? { enum: field.options } : {}) };
          break;
        case "multi_select":
          properties[field.key] = { type: "array", description, items: { type: "string", ...(field.options.length > 0 ? { enum: field.options } : {}) } };
          break;
        case "list":
          properties[field.key] = { type: "array", description, items: { type: "string" } };
          break;
        case "table": {
          const columns = columnSpecs(field).filter((column) => !column.computed);
          properties[field.key] = {
            type: "array",
            description: `${description}. Each row is an array of cells in column order: ${columns.map((column) => column.label).join(", ")}.`,
            items: { type: "array", items: { type: "string" } },
          };
          break;
        }
        default:
          properties[field.key] = { type: "string", description };
      }
    }
  }
  return { type: "object", properties };
}

function rangeHint(field: SheetField): string {
  if (field.min !== null && field.max !== null) {
    return ` ${field.min}-${field.max}`;
  }
  if (field.min !== null) {
    return ` min ${field.min}`;
  }
  if (field.max !== null) {
    return ` max ${field.max}`;
  }
  return "";
}

/** One-line catalog of writable fields, e.g. "level (number 1-20), class (dropdown: Wizard|Rogue), items (table: Item, Qty)". */
export function summarizeSheetFields(sections: SheetSection[]): string {
  const parts: string[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (isReadOnlyField(field)) {
        continue;
      }
      switch (field.type) {
        case "number":
        case "number_stepper":
          parts.push(`${field.key} (number${rangeHint(field)})`);
          break;
        case "dropdown":
        case "multi_select":
          parts.push(`${field.key} (${field.type === "dropdown" ? "one of" : "any of"}: ${field.options.join("|") || "free text"})`);
          break;
        case "list":
          parts.push(`${field.key} (list)`);
          break;
        case "table":
          parts.push(
            `${field.key} (table: ${columnSpecs(field)
              .filter((column) => !column.computed)
              .map((column) => column.label)
              .join(", ")})`,
          );
          break;
        default:
          parts.push(`${field.key} (text)`);
      }
    }
  }
  return parts.join(", ");
}

// ─── Updates ──────────────────────────────────────────────────────────────────

function formatShort(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "(empty)";
  }
  const text = Array.isArray(value) ? JSON.stringify(value) : String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [String(value).trim()].filter(Boolean);
}

function matchOption(field: SheetField, raw: string): string | undefined {
  if (field.options.length === 0) {
    return raw;
  }
  const lowered = raw.trim().toLowerCase();
  return field.options.find((option) => option.toLowerCase() === lowered);
}

function clampNumber(field: SheetField, value: number): number {
  let result = value;
  if (field.min !== null && result < field.min) {
    result = field.min;
  }
  if (field.max !== null && result > field.max) {
    result = field.max;
  }
  return result;
}

function normalizeTableRow(field: SheetField, raw: unknown): string[] | null {
  const columns = columnSpecs(field);
  if (Array.isArray(raw)) {
    const cells = raw.map((cell) => String(cell ?? ""));
    while (cells.length < columns.length) {
      cells.push("");
    }
    return cells.slice(0, columns.length);
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const byKey = new Map(Object.entries(record).map(([key, value]) => [slugifyKey(key), value]));
    return columns.map((column) => (column.computed ? "" : String(byKey.get(column.key) ?? "")));
  }
  if (raw === undefined || raw === null) {
    return null;
  }
  const cells = columns.map(() => "");
  cells[0] = String(raw);
  return cells;
}

function normalizeTableRows(field: SheetField, raw: unknown): string[][] | null {
  if (!Array.isArray(raw)) {
    const single = normalizeTableRow(field, raw);
    return single ? [single] : null;
  }
  const looksLikeSingleRow = raw.every((cell) => typeof cell !== "object" || cell === null);
  if (looksLikeSingleRow && raw.length > 0) {
    const single = normalizeTableRow(field, raw);
    return single ? [single] : null;
  }
  const rows: string[][] = [];
  for (const item of raw) {
    const row = normalizeTableRow(field, item);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

function currentRows(field: SheetField, values: SheetValues): string[][] {
  const raw = getRawSheetValue(field, values);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [String(row ?? "")]));
}

function applyOne(field: SheetField, op: SheetUpdateOp, value: unknown, values: SheetValues): { next?: unknown; error?: string } {
  const current = getRawSheetValue(field, values);

  switch (field.type) {
    case "number":
    case "number_stepper": {
      const amount = Number(value);
      if (value === undefined || value === null || value === "" || Number.isNaN(amount)) {
        return { error: `"${field.key}" expects a number, got ${formatShort(value)}.` };
      }
      const base = Number(current) || 0;
      const next = op === "add" ? base + amount : op === "remove" ? base - amount : amount;
      return { next: clampNumber(field, next) };
    }

    case "dropdown": {
      if (op !== "set") {
        return { error: `"${field.key}" is a single choice; use op "set".` };
      }
      const matched = matchOption(field, String(value ?? ""));
      if (matched === undefined) {
        return { error: `"${field.key}" must be one of: ${field.options.join(", ")}.` };
      }
      return { next: matched };
    }

    case "multi_select": {
      const incoming = toStringList(value);
      const matched: string[] = [];
      for (const item of incoming) {
        const option = matchOption(field, item);
        if (option === undefined) {
          return { error: `"${field.key}" only accepts: ${field.options.join(", ")}. Unknown: ${item}.` };
        }
        matched.push(option);
      }
      const existing = toStringList(current);
      if (op === "add") {
        return { next: [...existing, ...matched.filter((item) => !existing.includes(item))] };
      }
      if (op === "remove") {
        return { next: existing.filter((item) => !matched.includes(item)) };
      }
      return { next: matched };
    }

    case "list": {
      const existing = toStringList(current);
      if (op === "add") {
        return { next: [...existing, ...toStringList(value)] };
      }
      if (op === "remove") {
        const targets = Array.isArray(value) ? value : [value];
        let next = [...existing];
        for (const target of targets) {
          if (typeof target === "number") {
            next = next.filter((_, index) => index !== target);
          } else {
            const lowered = String(target ?? "").toLowerCase();
            next = next.filter((item) => item.toLowerCase() !== lowered);
          }
        }
        return { next };
      }
      return { next: toStringList(value) };
    }

    case "table": {
      const existing = currentRows(field, values);
      if (op === "remove") {
        const targets = Array.isArray(value) ? value : [value];
        let next = [...existing];
        for (const target of targets) {
          if (typeof target === "number") {
            next = next.filter((_, index) => index !== target);
          } else {
            const lowered = String(target ?? "").toLowerCase();
            next = next.filter((row) => (row[0] ?? "").toLowerCase() !== lowered);
          }
        }
        return { next };
      }
      const rows = normalizeTableRows(field, value);
      if (rows === null) {
        return { error: `"${field.key}" expects one or more rows (arrays of cells or objects keyed by column).` };
      }
      return { next: op === "add" ? [...existing, ...rows] : rows };
    }

    default: {
      if (op !== "set") {
        return { error: `"${field.key}" is text; use op "set".` };
      }
      return { next: value === undefined || value === null ? "" : String(value) };
    }
  }
}

/**
 * Validates and applies a batch of updates against the sheet template. Invalid
 * updates are reported in `errors` and skipped; valid ones are applied in order.
 */
export function applySheetUpdates(sections: SheetSection[], values: SheetValues, updates: SheetUpdate[]): SheetUpdateResult {
  const next: SheetValues = { ...values };
  const changes: string[] = [];
  const errors: string[] = [];

  for (const update of updates) {
    if (!update || typeof update.field !== "string" || !update.field.trim()) {
      errors.push('Each update needs a "field" key.');
      continue;
    }
    const field = findSheetFieldByReference(sections, update.field);
    if (!field) {
      errors.push(`Unknown field "${update.field}". Writable fields: ${summarizeSheetFields(sections) || "(none)"}.`);
      continue;
    }
    if (isReadOnlyField(field)) {
      errors.push(`"${field.key}" is read-only (${isExpressionField(field.expression) ? "computed by an expression" : "static table defined in the template"}).`);
      continue;
    }
    const op: SheetUpdateOp = update.op === "add" || update.op === "remove" ? update.op : "set";
    const before = getRawSheetValue(field, next);
    const result = applyOne(field, op, update.value, next);
    if (result.error) {
      errors.push(result.error);
      continue;
    }
    next[field.key] = result.next;
    changes.push(`${field.key}: ${formatShort(before)} → ${formatShort(result.next)}`);
  }

  return { values: next, changes, errors };
}
