import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useRef, useState } from "react";
import { LuCheck, LuCopy, LuLock, LuPlus } from "react-icons/lu";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/shared/ConfirmDeleteButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepButton } from "@/components/ui/step-button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SheetField, SheetSection, SheetValues } from "@/schema/template-character-sheet-schema";
import { buildResolvedSheetValues, getRawSheetValue, isExpressionField, resolveSheetExpression, tableColumnKey } from "@/utils/sheet-expression";
import { SectionFrame } from "./SectionFrame";
import { resolveSectionStyle, SHEET_ADD_BUTTON, type SheetStyleRecipe } from "./sheet-style-presets";

interface SheetRendererProps {
  sections: SheetSection[];
  values: SheetValues;
  onValuesChange: (values: SheetValues) => void;
  characterName?: string;
  readOnly?: boolean;
}

// Revealed on hover of the surrounding group/key element; click copies the prompt placeholder
function CopyKeyChip({ text, placeholder }: { text: string; placeholder: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const handleCopy = async () => {
    try {
      await writeText(placeholder);
      setCopied(true);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      toast.error(`Failed to copy to clipboard: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${placeholder}`}
      className="inline-flex max-w-0 flex-shrink-0 items-center gap-1 overflow-hidden font-mono text-[10px] leading-none text-muted-foreground/60 opacity-0 transition-all duration-200 hover:text-foreground focus-visible:max-w-40 focus-visible:opacity-100 group-hover/key:max-w-40 group-hover/key:opacity-100"
    >
      {copied ? <LuCheck className="h-2.5 w-2.5 flex-shrink-0 text-primary" /> : <LuCopy className="h-2.5 w-2.5 flex-shrink-0" />}
      <span className="truncate">{text}</span>
    </button>
  );
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
  preset: SheetStyleRecipe;
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
      {!isStatic && !disabled && (
        <Button type="button" variant="ghost" size="sm" className={SHEET_ADD_BUTTON} onClick={() => onChange([...rows, columns.map(() => "")])}>
          <LuPlus className="!size-3" /> Add Row
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
  preset: SheetStyleRecipe;
  characterName?: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

function FieldControl({ field, rawValue, resolvedValue, resolvedValues, preset, characterName, disabled, onChange }: FieldControlProps) {
  if (field.type !== "table" && isExpressionField(field.expression)) {
    return (
      <div
        className="flex h-7 items-center gap-2 rounded-sm border border-[color:color-mix(in_srgb,var(--sheet-accent)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--sheet-accent)_10%,transparent)] px-2 text-sm"
        title={field.expression}
      >
        <LuLock className="h-3 w-3 flex-shrink-0 text-[color:color-mix(in_srgb,var(--sheet-accent)_70%,transparent)]" />
        <span className="truncate text-xs font-semibold">{String(resolvedValue ?? "")}</span>
      </div>
    );
  }

  switch (field.type) {
    case "text":
      return <Input className={preset.surface} value={String(rawValue ?? "")} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;

    case "textarea":
      return <Textarea className={preset.surface} rows={3} value={String(rawValue ?? "")} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;

    case "number":
      return (
        <Input
          type="number"
          className={cn("[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", preset.surface)}
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
        <StepButton
          value={current}
          min={field.min ?? Number.MIN_SAFE_INTEGER}
          max={field.max ?? Number.MAX_SAFE_INTEGER}
          step={field.step}
          disabled={disabled}
          onValueChange={(value) => onChange(clampNumber(value, field))}
        />
      );
    }

    case "dropdown":
      return (
        <Select value={rawValue ? String(rawValue) : undefined} disabled={disabled} onValueChange={(value) => onChange(value)}>
          <SelectTrigger className={preset.surface}>
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
      return (
        <CommandTagInput
          className={preset.surface}
          value={toStringArray(rawValue)}
          onChange={(next: string[]) => onChange(next)}
          suggestions={field.options}
          placeholder="Select..."
          maxTags={100}
          disabled={disabled}
        />
      );

    case "list": {
      const items = toStringArray(rawValue);
      return (
        <div className="space-y-1">
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items have no stable identity
            <div key={index} className="flex items-center gap-1">
              <Input
                className={preset.surface}
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
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" className={SHEET_ADD_BUTTON} onClick={() => onChange([...items, ""])}>
              <LuPlus className="!size-3" /> Add Item
            </Button>
          )}
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
        const { recipe: preset } = resolveSectionStyle(section.style);
        const span = Math.min(section.span, 4);
        return (
          <div key={section.id} className="min-w-0" style={{ gridColumn: `span ${span} / span ${span}` }}>
            <SectionFrame style={section.style} className="h-full">
              {section.title && (
                <div className="group/key mb-2 flex items-center gap-2">
                  <h3 className={cn("min-w-0 flex-1 text-sm font-semibold", preset.title)}>{section.title}</h3>
                  <CopyKeyChip text={section.key} placeholder={`{{char.${section.key}}}`} />
                </div>
              )}
              <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}>
                {section.fields.map((field) => (
                  <div key={field.id} className="group/key min-w-0 space-y-1" style={{ gridColumn: `span ${Math.min(field.span, section.columns)} / span ${Math.min(field.span, section.columns)}` }}>
                    <div className="flex items-center justify-between gap-2">
                      <Label className={cn("min-w-0 flex-1 truncate whitespace-nowrap text-xs", preset.fieldLabel)} title={field.label}>
                        {field.label}
                      </Label>
                      <CopyKeyChip text={field.key} placeholder={`{{char.${section.key}.${field.key}}}`} />
                    </div>
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
