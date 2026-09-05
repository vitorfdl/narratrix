import { LuLock, LuMinus, LuPlus } from "react-icons/lu";
import { ConfirmDeleteButton } from "@/components/shared/ConfirmDeleteButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SheetField, SheetSection, SheetValues } from "@/schema/template-character-sheet-schema";
import { buildResolvedSheetValues, getRawSheetValue, isExpressionField, resolveSheetExpression, tableColumnKey } from "@/utils/sheet-expression";
import { SectionFrame } from "./SectionFrame";
import { SECTION_STYLE_PRESETS, type SectionStylePreset } from "./sheet-style-presets";

interface SheetRendererProps {
  sections: SheetSection[];
  values: SheetValues;
  onValuesChange: (values: SheetValues) => void;
  characterName?: string;
  readOnly?: boolean;
}

// Solid surface so controls stand out against tinted/dark section frames
const CONTROL_SURFACE = "border-border/70 bg-background/70 shadow-sm backdrop-blur-sm";

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

function clampNumber(value: number, field: SheetField): number {
  let result = value;
  if (field.min !== null && result < field.min) {
    result = field.min;
  }
  if (field.max !== null && result > field.max) {
    result = field.max;
  }
  return result;
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface SheetTableProps {
  field: SheetField;
  rawValue: unknown;
  resolvedValues: SheetValues;
  preset: SectionStylePreset;
  characterName?: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

function SheetTable({ field, rawValue, resolvedValues, preset, characterName, disabled, onChange }: SheetTableProps) {
  const columns = field.columns.length > 0 ? field.columns : [{ id: "value", label: "Value", expression: null }];
  const isStatic = field.table_mode === "static";
  const rows = isStatic ? toTableRows(field.rows, columns.length) : toTableRows(rawValue, columns.length);

  const resolveCell = (row: string[], columnIndex: number): string => {
    const column = columns[columnIndex];
    const rowContext: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      if (!col.expression) {
        rowContext[tableColumnKey(col)] = row[i];
      }
    });
    const context = { characterName, row: rowContext };
    if (column.expression) {
      return resolveSheetExpression(column.expression, resolvedValues, context);
    }
    const cell = row[columnIndex] ?? "";
    if (isStatic && cell.includes("${")) {
      return resolveSheetExpression(cell, resolvedValues, context);
    }
    return cell;
  };

  const isCellEditable = (columnIndex: number): boolean => !isStatic && !columns[columnIndex].expression && !disabled;

  return (
    <div className="space-y-1">
      <div className={cn("overflow-x-auto rounded-md border", preset.tableWrapper)}>
        <table className="w-full text-xs">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} className={cn("px-2 py-1.5 text-left text-[11px] font-semibold", preset.tableHeader)} title={column.expression ?? undefined}>
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {column.expression && <LuLock className="h-2.5 w-2.5 opacity-60" />}
                  </span>
                </th>
              ))}
              {!isStatic && <th className={cn("w-8", preset.tableHeader)} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (isStatic ? 0 : 1)} className="px-2 py-3 text-center text-muted-foreground/60">
                  {isStatic ? "No rows defined in the template." : "No rows yet."}
                </td>
              </tr>
            )}
            {rows.map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: table rows have no stable identity
              <tr key={rowIndex} className={cn("border-t transition-colors", preset.tableRow)}>
                {columns.map((_, colIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                  <td key={colIndex} className="p-0.5">
                    {isCellEditable(colIndex) ? (
                      <Input
                        className="h-7 border-none bg-transparent text-xs shadow-none focus-visible:ring-1"
                        value={row[colIndex] ?? ""}
                        onChange={(e) => {
                          const next = rows.map((r) => [...r]);
                          next[rowIndex][colIndex] = e.target.value;
                          onChange(next);
                        }}
                      />
                    ) : (
                      <span className="block px-2 py-1.5 font-medium">{resolveCell(row, colIndex)}</span>
                    )}
                  </td>
                ))}
                {!isStatic && (
                  <td className="p-0.5 text-center">
                    <ConfirmDeleteButton className="h-6 w-6" title="Delete row" disabled={disabled} onDelete={() => onChange(rows.filter((_, i) => i !== rowIndex))} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isStatic && (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={disabled} onClick={() => onChange([...rows, columns.map(() => "")])}>
          <LuPlus className="h-3 w-3" /> Add Row
        </Button>
      )}
    </div>
  );
}

// ─── Field Controls ───────────────────────────────────────────────────────────

interface FieldControlProps {
  field: SheetField;
  rawValue: unknown;
  resolvedValue: unknown;
  resolvedValues: SheetValues;
  preset: SectionStylePreset;
  characterName?: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

function FieldControl({ field, rawValue, resolvedValue, resolvedValues, preset, characterName, disabled, onChange }: FieldControlProps) {
  if (field.type !== "table" && isExpressionField(field.expression)) {
    return (
      <div className="flex h-8 items-center gap-2 rounded-md border border-dashed border-primary/30 bg-primary/5 px-2 text-sm" title={field.expression}>
        <LuLock className="h-3 w-3 flex-shrink-0 text-primary/50" />
        <span className="truncate font-semibold">{String(resolvedValue ?? "")}</span>
      </div>
    );
  }

  switch (field.type) {
    case "text":
      return <Input className={CONTROL_SURFACE} value={String(rawValue ?? "")} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;

    case "textarea":
      return <Textarea className={CONTROL_SURFACE} rows={3} value={String(rawValue ?? "")} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;

    case "number":
      return (
        <Input
          type="number"
          className={CONTROL_SURFACE}
          value={rawValue === undefined || rawValue === null || rawValue === "" ? "" : Number(rawValue)}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          step={field.step}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? undefined : clampNumber(Number(e.target.value), field))}
        />
      );

    case "number_stepper": {
      const current = Number(rawValue ?? field.min ?? 0) || 0;
      return (
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" disabled={disabled} onClick={() => onChange(clampNumber(current - field.step, field))}>
            <LuMinus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            className={cn("text-center", CONTROL_SURFACE)}
            value={current}
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            step={field.step}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value === "" ? undefined : clampNumber(Number(e.target.value), field))}
          />
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" disabled={disabled} onClick={() => onChange(clampNumber(current + field.step, field))}>
            <LuPlus className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    case "dropdown":
      return (
        <Select value={rawValue ? String(rawValue) : undefined} disabled={disabled} onValueChange={(value) => onChange(value)}>
          <SelectTrigger className={CONTROL_SURFACE}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multi_select":
      return <CommandTagInput value={toStringArray(rawValue)} onChange={(next: string[]) => onChange(next)} suggestions={field.options} placeholder="Select..." maxTags={100} disabled={disabled} />;

    case "list": {
      const items = toStringArray(rawValue);
      return (
        <div className="space-y-1">
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items have no stable identity
            <div key={index} className="flex items-center gap-1">
              <Input
                className={CONTROL_SURFACE}
                value={item}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...items];
                  next[index] = e.target.value;
                  onChange(next);
                }}
              />
              <ConfirmDeleteButton className="h-7 w-7 flex-shrink-0" title="Delete item" disabled={disabled} onDelete={() => onChange(items.filter((_, i) => i !== index))} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={disabled} onClick={() => onChange([...items, ""])}>
            <LuPlus className="h-3 w-3" /> Add
          </Button>
        </div>
      );
    }

    case "table":
      return <SheetTable field={field} rawValue={rawValue} resolvedValues={resolvedValues} preset={preset} characterName={characterName} disabled={disabled} onChange={onChange} />;

    default:
      return null;
  }
}

// ─── Renderer Root ────────────────────────────────────────────────────────────

export function SheetRenderer({ sections, values, onValuesChange, characterName, readOnly = false }: SheetRendererProps) {
  const resolvedValues = buildResolvedSheetValues(sections, values, characterName);

  const handleFieldChange = (field: SheetField, value: unknown) => {
    onValuesChange({ ...values, [field.key]: value });
  };

  if (sections.length === 0) {
    return <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-sm text-muted-foreground">This sheet template has no sections yet.</div>;
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {sections.map((section) => {
        const preset = SECTION_STYLE_PRESETS[section.style];
        const span = Math.min(section.span, 4);
        return (
          <div key={section.id} className="min-w-0" style={{ gridColumn: `span ${span} / span ${span}` }}>
            <SectionFrame style={section.style} className="h-full">
              {section.title && <h3 className={cn("mb-2 text-sm font-semibold", preset.title)}>{section.title}</h3>}
              <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}>
                {section.fields.map((field) => (
                  <div key={field.id} className="min-w-0 space-y-1" style={{ gridColumn: `span ${Math.min(field.span, section.columns)} / span ${Math.min(field.span, section.columns)}` }}>
                    <Label className="text-xs text-muted-foreground">{field.label}</Label>
                    <FieldControl
                      field={field}
                      rawValue={getRawSheetValue(field, values)}
                      resolvedValue={resolvedValues[field.key]}
                      resolvedValues={resolvedValues}
                      preset={preset}
                      characterName={characterName}
                      disabled={readOnly}
                      onChange={(value) => handleFieldChange(field, value)}
                    />
                  </div>
                ))}
              </div>
            </SectionFrame>
          </div>
        );
      })}
    </div>
  );
}
