import type { SheetTableColumn } from "@/schema/template-character-sheet-schema";

export function slugifyKey(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

export function tableColumnKey(column: SheetTableColumn): string {
  return slugifyKey(column.label);
}
