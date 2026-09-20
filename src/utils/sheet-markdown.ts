import type { SheetField, SheetSection, SheetValues } from "@/schema/template-character-sheet-schema";
import { buildResolvedSheetValues, getRawSheetValue, resolveSheetExpression, slugifyKey, tableColumnKey } from "./sheet-expression";

export interface SheetMarkdownContext {
  sections: SheetSection[];
  values: SheetValues;
  characterName?: string;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")) : [];
}

function toTableRows(value: unknown, columnCount: number): string[][] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((row) => {
    const cells = Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [String(row ?? "")];
    while (cells.length < columnCount) {
      cells.push("");
    }
    return cells.slice(0, Math.max(columnCount, 1));
  });
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderTableMarkdown(field: SheetField, context: SheetMarkdownContext, resolvedValues: SheetValues): string {
  const columns = field.columns.length > 0 ? field.columns : [{ id: "value", label: "Value", expression: null }];
  const isStatic = field.table_mode === "static";
  const rows = isStatic ? toTableRows(field.rows, columns.length) : toTableRows(getRawSheetValue(field, context.values), columns.length);

  if (rows.length === 0) {
    return "";
  }

  const resolveCell = (row: string[], columnIndex: number): string => {
    const column = columns[columnIndex];
    const rowContext: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      if (!col.expression) {
        rowContext[tableColumnKey(col)] = row[i];
      }
    });
    const cellContext = { characterName: context.characterName, row: rowContext };
    if (column.expression) {
      return resolveSheetExpression(column.expression, resolvedValues, cellContext);
    }
    const cell = row[columnIndex] ?? "";
    if (isStatic && cell.includes("${")) {
      return resolveSheetExpression(cell, resolvedValues, cellContext);
    }
    return cell;
  };

  const header = `| ${columns.map((column) => escapeTableCell(column.label)).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((_, columnIndex) => escapeTableCell(resolveCell(row, columnIndex))).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

/**
 * Renders a field's value as bare markdown (no label): scalars as plain text,
 * multi-selects as a comma list, lists as bullets, tables as a markdown table.
 * Expressions (field-level, table-column, and static-cell) are already resolved.
 */
export function renderSheetFieldMarkdown(field: SheetField, context: SheetMarkdownContext, resolvedValues?: SheetValues): string {
  const resolved = resolvedValues ?? buildResolvedSheetValues(context.sections, context.values, context.characterName);

  switch (field.type) {
    case "table":
      return renderTableMarkdown(field, context, resolved);
    case "list": {
      const items = toStringArray(resolved[field.key]).filter((item) => item.trim() !== "");
      return items.map((item) => `- ${item}`).join("\n");
    }
    case "multi_select":
      return toStringArray(resolved[field.key])
        .filter((item) => item.trim() !== "")
        .join(", ");
    default: {
      const value = resolved[field.key];
      return value === undefined || value === null ? "" : String(value);
    }
  }
}

/**
 * Renders a whole section as markdown: heading, then one labeled block per
 * field. Fields with no value are skipped.
 */
export function renderSheetSectionMarkdown(section: SheetSection, context: SheetMarkdownContext, resolvedValues?: SheetValues): string {
  const resolved = resolvedValues ?? buildResolvedSheetValues(context.sections, context.values, context.characterName);

  const blocks: string[] = [];
  for (const field of section.fields) {
    const value = renderSheetFieldMarkdown(field, context, resolved);
    if (value.trim() === "") {
      continue;
    }
    if (field.type === "table") {
      // Blank line so the table starts its own block in strict markdown
      blocks.push(`**${field.label}:**\n\n${value}`);
    } else if (field.type === "list" || value.includes("\n")) {
      blocks.push(`**${field.label}:**\n${value}`);
    } else {
      blocks.push(`**${field.label}:** ${value}`);
    }
  }

  const title = section.title.trim();
  const body = blocks.join("\n\n");
  if (!title) {
    return body;
  }
  return body ? `### ${title}\n\n${body}` : `### ${title}`;
}

export function findSheetSection(sections: SheetSection[], reference: string): SheetSection | undefined {
  const slug = slugifyKey(reference);
  return sections.find((section) => section.key.toLowerCase() === slug);
}

export function findSheetField(fields: SheetField[], reference: string): SheetField | undefined {
  const slug = slugifyKey(reference);
  return fields.find((field) => field.key.toLowerCase() === slug);
}

export function renderSheetMarkdown(context: SheetMarkdownContext): string {
  const resolved = buildResolvedSheetValues(context.sections, context.values, context.characterName);
  return context.sections
    .map((section) => renderSheetSectionMarkdown(section, context, resolved))
    .filter((block) => block.trim() !== "")
    .join("\n\n");
}

/**
 * Resolves a dotted sheet reference to markdown:
 * - "sheet" — every section
 * - "SECTION" — the whole section (fields labeled, tables/lists converted)
 * - "SECTION.FIELD" — one field's bare value
 * - "FIELD" / "sheet.FIELD" — a field looked up across all sections
 * Segments are matched against section/field keys after slugifying, so
 * "Basic Info" and "basic_info" both hit the key "basic_info".
 * Returns null when nothing matches.
 */
export function resolveSheetReference(path: string, context: SheetMarkdownContext): string | null {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const resolved = buildResolvedSheetValues(context.sections, context.values, context.characterName);
  const allFields = context.sections.flatMap((section) => section.fields);

  if (segments.length === 1) {
    if (segments[0].toLowerCase() === "sheet") {
      return renderSheetMarkdown(context);
    }
    const section = findSheetSection(context.sections, segments[0]);
    if (section) {
      return renderSheetSectionMarkdown(section, context, resolved);
    }
    const field = findSheetField(allFields, segments[0]);
    return field ? renderSheetFieldMarkdown(field, context, resolved) : null;
  }

  const [sectionRef, ...fieldSegments] = segments;
  const fieldRef = fieldSegments.join(".");
  const scopedFields = sectionRef.toLowerCase() === "sheet" ? allFields : (findSheetSection(context.sections, sectionRef)?.fields ?? null);
  if (!scopedFields) {
    return null;
  }
  const field = findSheetField(scopedFields, fieldRef);
  return field ? renderSheetFieldMarkdown(field, context, resolved) : null;
}
