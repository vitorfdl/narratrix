import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  DropAnimation,
  defaultDropAnimationSideEffects,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCopy, LuEllipsisVertical, LuGripVertical, LuPencil, LuPlus, LuSettings2, LuX } from "react-icons/lu";
import { ConfirmDeleteButton } from "@/components/shared/ConfirmDeleteButton";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { SettingsPopoverContent } from "@/components/shared/SettingsPopover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SHEET_FIELD_TYPE_LABELS,
  SHEET_FIELD_TYPES,
  SHEET_SECTION_STYLE_LABELS,
  SHEET_SECTION_STYLES,
  type SheetField,
  type SheetFieldType,
  type SheetSection,
  type SheetSectionStyle,
} from "@/schema/template-character-sheet-schema";
import { slugifyKey, tableColumnKey } from "@/utils/sheet-expression";
import { SectionFrame } from "./SectionFrame";
import { SECTION_STYLE_PRESETS } from "./sheet-style-presets";

interface SheetTemplateEditorProps {
  sections: SheetSection[];
  onChange: (sections: SheetSection[]) => void;
}

function uniqueKey(base: string, existingKeys: Set<string>): string {
  let key = base;
  let counter = 2;
  while (existingKeys.has(key)) {
    key = `${base}_${counter++}`;
  }
  return key;
}

function createField(type: SheetFieldType, existingKeys: Set<string>): SheetField {
  return {
    id: crypto.randomUUID(),
    key: uniqueKey(slugifyKey(SHEET_FIELD_TYPE_LABELS[type]), existingKeys),
    label: SHEET_FIELD_TYPE_LABELS[type],
    type,
    span: 1,
    options: [],
    min: null,
    max: null,
    step: 1,
    columns:
      type === "table"
        ? [
            { id: crypto.randomUUID(), label: "Name", expression: null },
            { id: crypto.randomUUID(), label: "Value", expression: null },
          ]
        : [],
    table_mode: "dynamic",
    rows: [],
    expression: null,
    default_value: undefined,
  };
}

// A key is "auto" while it still matches the slug the field was created with
// ("text", "text_2"). Renaming the label re-derives such keys; once a label has
// been set the key stays put so stored values keyed by it are not orphaned.
function isAutoFieldKey(field: SheetField): boolean {
  const base = slugifyKey(SHEET_FIELD_TYPE_LABELS[field.type]);
  return new RegExp(`^${base}(_\\d+)?$`).test(field.key);
}

function withoutKey(keys: Set<string>, key: string): Set<string> {
  const next = new Set(keys);
  next.delete(key);
  return next;
}

function duplicateField(field: SheetField, existingKeys: Set<string>): SheetField {
  return {
    ...structuredClone(field),
    id: crypto.randomUUID(),
    key: uniqueKey(field.key, existingKeys),
    columns: field.columns.map((column) => ({ ...column, id: crypto.randomUUID() })),
  };
}

// ─── Drag-to-resize span ──────────────────────────────────────────────────────

function useSpanResize(currentSpan: number, maxSpan: number, onCommit: (span: number) => void) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [previewSpan, setPreviewSpan] = useState<number | null>(null);

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const startX = e.clientX;
    const rect = element.getBoundingClientRect();
    const columnWidth = rect.width / currentSpan;
    let latest = currentSpan;

    const onMove = (event: PointerEvent) => {
      const next = Math.min(maxSpan, Math.max(1, Math.round((rect.width + event.clientX - startX) / columnWidth)));
      latest = next;
      setPreviewSpan(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPreviewSpan(null);
      if (latest !== currentSpan) {
        onCommit(latest);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return { elementRef, previewSpan, onResizeStart };
}

function ResizeHandle({ onResizeStart, title }: { onResizeStart: (e: React.PointerEvent) => void; title: string }) {
  return (
    <div
      onPointerDown={onResizeStart}
      title={title}
      className="absolute -right-0.5 inset-y-1 w-1.5 cursor-ew-resize rounded-full opacity-0 transition-opacity hover:bg-primary/60 group-hover/resize:opacity-100"
    />
  );
}

// ─── Table Settings ───────────────────────────────────────────────────────────

function TableSettings({ field, onChange }: { field: SheetField; onChange: (field: SheetField) => void }) {
  const updateColumns = (columns: SheetField["columns"]) => {
    // Keep static rows aligned with the column count
    const rows = field.rows.map((row) => {
      const next = [...row];
      while (next.length < columns.length) {
        next.push("");
      }
      return next.slice(0, Math.max(columns.length, 1));
    });
    onChange({ ...field, columns, rows });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label className="text-xs">Table Mode</Label>
          <HelpTooltip>
            <p>
              <strong>Dynamic:</strong> rows are added while filling the sheet.
            </p>
            <p>
              <strong>Static:</strong> rows are fixed here in the template; cells may contain expressions.
            </p>
          </HelpTooltip>
        </div>
        <Select value={field.table_mode} onValueChange={(mode) => onChange({ ...field, table_mode: mode as SheetField["table_mode"] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dynamic">Dynamic (users add rows)</SelectItem>
            <SelectItem value="static">Static (fixed rows)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label className="text-xs">Columns</Label>
          <HelpTooltip>
            <p>A column with an expression is computed per row and read-only.</p>
            <p>
              Reference sibling cells with <code>{`\${row.column_label}`}</code> and sheet fields with <code>{`\${sheet.key}`}</code>.
            </p>
          </HelpTooltip>
        </div>
        {field.columns.map((column) => (
          <div key={column.id} className="flex items-center gap-1">
            <Input className="flex-1" value={column.label} placeholder="Label" onChange={(e) => updateColumns(field.columns.map((c) => (c.id === column.id ? { ...c, label: e.target.value } : c)))} />
            <Input
              className="flex-1"
              value={column.expression ?? ""}
              placeholder={`\${row.${tableColumnKey(field.columns[0] ?? column)}} + 1`}
              title="Expression (optional)"
              onChange={(e) => updateColumns(field.columns.map((c) => (c.id === column.id ? { ...c, expression: e.target.value === "" ? null : e.target.value } : c)))}
            />
            <ConfirmDeleteButton className="h-6 w-6 flex-shrink-0" title="Delete column" onDelete={() => updateColumns(field.columns.filter((c) => c.id !== column.id))} />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => updateColumns([...field.columns, { id: crypto.randomUUID(), label: `Column ${field.columns.length + 1}`, expression: null }])}
        >
          <LuPlus className="h-3 w-3" /> Add Column
        </Button>
      </div>

      {field.table_mode === "static" && (
        <div className="space-y-1">
          <Label className="text-xs">Rows</Label>
          {field.rows.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <div key={rowIndex} className="flex items-center gap-1">
              {field.columns.map((column, colIndex) => (
                <Input
                  key={column.id}
                  className="flex-1"
                  value={row[colIndex] ?? ""}
                  placeholder={column.label}
                  disabled={!!column.expression}
                  onChange={(e) => {
                    const rows = field.rows.map((r) => [...r]);
                    rows[rowIndex][colIndex] = e.target.value;
                    onChange({ ...field, rows });
                  }}
                />
              ))}
              <ConfirmDeleteButton className="h-6 w-6 flex-shrink-0" title="Delete row" onDelete={() => onChange({ ...field, rows: field.rows.filter((_, i) => i !== rowIndex) })} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange({ ...field, rows: [...field.rows, field.columns.map(() => "")] })}>
            <LuPlus className="h-3 w-3" /> Add Row
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Field Settings Popover ───────────────────────────────────────────────────

function FieldSettings({ field, onChange }: { field: SheetField; onChange: (field: SheetField) => void }) {
  const isNumeric = field.type === "number" || field.type === "number_stepper";
  const hasOptions = field.type === "dropdown" || field.type === "multi_select";
  const isTable = field.type === "table";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Label className="text-xs">Key</Label>
            <HelpTooltip>
              <p>
                Reference this field in expressions as <code>{`\${sheet.${field.key || "key"}}`}</code>.
              </p>
              <p>
                In prompts, insert its value with <code>{`{{char.${field.key || "key"}}}`}</code>.
              </p>
            </HelpTooltip>
          </div>
          <Input value={field.key} onChange={(e) => onChange({ ...field, key: slugifyKey(e.target.value) })} />
        </div>
      </div>

      {isNumeric && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Min</Label>
            <Input type="number" value={field.min ?? ""} onChange={(e) => onChange({ ...field, min: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max</Label>
            <Input type="number" value={field.max ?? ""} onChange={(e) => onChange({ ...field, max: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Step</Label>
            <Input type="number" value={field.step} onChange={(e) => onChange({ ...field, step: Number(e.target.value) || 1 })} />
          </div>
        </div>
      )}

      {hasOptions && (
        <div className="space-y-1">
          <Label className="text-xs">Options</Label>
          <CommandTagInput value={field.options} onChange={(options: string[]) => onChange({ ...field, options })} placeholder="Add option..." maxTags={100} />
        </div>
      )}

      {isTable && <TableSettings field={field} onChange={onChange} />}

      {!isTable && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Label className="text-xs">Expression</Label>
            <HelpTooltip>
              <p>Makes the field computed and read-only.</p>
              <p>
                Reference other fields with <code>{`\${sheet.fieldkey}`}</code> and the character with <code>{`\${name}`}</code>. Arithmetic is evaluated, e.g.{" "}
                <code>{`10 + \${sheet.level} * 2`}</code>.
              </p>
            </HelpTooltip>
          </div>
          <Input value={field.expression ?? ""} placeholder={`e.g. 10 + \${sheet.level}`} onChange={(e) => onChange({ ...field, expression: e.target.value === "" ? null : e.target.value })} />
        </div>
      )}

      {!field.expression && !isTable && field.type !== "list" && field.type !== "multi_select" && (
        <div className="space-y-1">
          <Label className="text-xs">Default Value</Label>
          <Input
            value={field.default_value === undefined || field.default_value === null ? "" : String(field.default_value)}
            onChange={(e) => {
              const raw = e.target.value;
              const value = raw === "" ? undefined : isNumeric ? Number(raw) || raw : raw;
              onChange({ ...field, default_value: value });
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Sortable Field Chip ──────────────────────────────────────────────────────

interface SortableFieldRowProps {
  field: SheetField;
  sectionColumns: number;
  allKeys: Set<string>;
  onChange: (field: SheetField) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableFieldRow({ field, sectionColumns, allKeys, onChange, onDuplicate, onDelete }: SortableFieldRowProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id, data: { type: "field" } });
  const span = Math.min(field.span, sectionColumns);
  const { elementRef, previewSpan, onResizeStart } = useSpanResize(span, sectionColumns, (next) => onChange({ ...field, span: next }));
  const displaySpan = previewSpan ?? span;

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      elementRef.current = node;
    },
    [setNodeRef, elementRef],
  );

  return (
    <div
      ref={setRefs}
      style={{ gridColumn: `span ${displaySpan} / span ${displaySpan}`, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className={cn(
        "group/resize relative flex min-w-0 items-center gap-1 rounded-sm border border-transparent px-1 py-0.5 transition-colors hover:border-border/30 hover:bg-background/20",
        previewSpan !== null && "border-primary/50",
        isDragging && "border-dashed border-primary/50 bg-primary/5",
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab touch-none opacity-40 hover:opacity-80 active:cursor-grabbing" title="Drag to reorder or move to another section">
        <LuGripVertical className="h-3.5 w-3.5 flex-shrink-0" />
      </div>
      <Input
        className="h-5 min-w-0 flex-1 rounded-sm border-none bg-transparent px-0.5 text-xs font-medium shadow-none focus-visible:bg-background/40 focus-visible:ring-0"
        value={field.label}
        placeholder="Field label"
        onChange={(e) => {
          const label = e.target.value;
          const key = isAutoFieldKey(field) && label.trim() ? uniqueKey(slugifyKey(label), withoutKey(allKeys, field.key)) : field.key;
          onChange({ ...field, label, key });
        }}
      />
      <Badge variant="outline" className="h-5 flex-shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground">
        {SHEET_FIELD_TYPE_LABELS[field.type]}
      </Badge>
      {(field.expression || field.columns.some((c) => c.expression)) && (
        <Badge variant="secondary" className="h-5 flex-shrink-0 px-1.5 text-[10px] font-normal">
          fx
        </Badge>
      )}
      <div className="flex flex-shrink-0 items-center">
        <AnimatePresence>
          {actionsOpen && (
            <motion.div key="actions" className="flex items-center gap-0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1, transition: { delay: 0, type: "spring", stiffness: 600, damping: 22 } }} exit={{ scale: 0, transition: { delay: 0.06 } }}>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Duplicate field" onClick={onDuplicate}>
                  <LuCopy className="h-3 w-3" />
                </Button>
              </motion.div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1, transition: { delay: 0.05, type: "spring", stiffness: 600, damping: 22 } }} exit={{ scale: 0, transition: { delay: 0.03 } }}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Field settings">
                      <LuPencil className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <SettingsPopoverContent
                    title="Field Settings"
                    icon={<LuSettings2 className="h-3.5 w-3.5 text-muted-foreground/70" />}
                    side="left"
                    align="start"
                    className={field.type === "table" ? "w-[26rem]" : "w-80"}
                  >
                    <FieldSettings field={field} onChange={onChange} />
                  </SettingsPopoverContent>
                </Popover>
              </motion.div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1, transition: { delay: 0.1, type: "spring", stiffness: 600, damping: 22 } }} exit={{ scale: 0, transition: { delay: 0 } }}>
                <ConfirmDeleteButton className="h-6 w-6" title="Delete field" onDelete={onDelete} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 opacity-50 hover:opacity-100"
          title={actionsOpen ? "Close actions" : "Field actions"}
          onClick={() => setActionsOpen((open) => !open)}
        >
          {actionsOpen ? <LuX className="h-3 w-3" /> : <LuEllipsisVertical className="h-3 w-3" />}
        </Button>
      </div>
      <ResizeHandle onResizeStart={onResizeStart} title="Drag to resize width" />
    </div>
  );
}

// ─── Section Editor ───────────────────────────────────────────────────────────

interface SectionEditorProps {
  section: SheetSection;
  allKeys: Set<string>;
  sectionKeys: Set<string>;
  dragHandleProps: Record<string, unknown>;
  onChange: (section: SheetSection) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SectionEditor({ section, allKeys, sectionKeys, dragHandleProps, onChange, onDuplicate, onDelete }: SectionEditorProps) {
  const preset = SECTION_STYLE_PRESETS[section.style];
  const otherSectionKeys = withoutKey(sectionKeys, section.key);

  // The key follows the title until the user edits it by hand
  const handleTitleChange = (title: string) => {
    const follows = section.key === slugifyKey(section.title);
    const key = follows && title.trim() ? uniqueKey(slugifyKey(title), otherSectionKeys) : section.key;
    onChange({ ...section, title, key });
  };

  const handleAddField = (type: SheetFieldType) => {
    onChange({ ...section, fields: [...section.fields, createField(type, allKeys)] });
  };

  const handleDuplicateField = (field: SheetField) => {
    const copy = duplicateField(field, allKeys);
    const index = section.fields.findIndex((f) => f.id === field.id);
    const fields = [...section.fields];
    fields.splice(index + 1, 0, copy);
    onChange({ ...section, fields });
  };

  return (
    <SectionFrame style={section.style} className="h-full">
      <div className="mb-2 flex items-center gap-1">
        <div {...dragHandleProps} className="flex-shrink-0 cursor-grab touch-none opacity-40 hover:opacity-80 active:cursor-grabbing" title="Drag to reposition section">
          <LuGripVertical className="h-4 w-4" />
        </div>
        <Input
          className={cn("h-6 min-w-0 flex-1 rounded-sm border-none bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:bg-background/40 focus-visible:ring-0", preset.title)}
          value={section.title}
          placeholder="Section title"
          onChange={(e) => handleTitleChange(e.target.value)}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" title="Section settings">
              <LuPencil className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <SettingsPopoverContent title="Section Settings" icon={<LuSettings2 className="h-3.5 w-3.5 text-muted-foreground/70" />} side="bottom" align="end">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Key</Label>
                <HelpTooltip>
                  <p>
                    Insert this whole section in prompts with <code>{`{{char.${section.key || "key"}}}`}</code>, or a single field with <code>{`{{char.${section.key || "key"}.field_key}}`}</code>.
                  </p>
                  <p>The key follows the title until you edit it here.</p>
                </HelpTooltip>
              </div>
              <Input value={section.key} onChange={(e) => onChange({ ...section, key: uniqueKey(slugifyKey(e.target.value), otherSectionKeys) })} />
            </div>
          </SettingsPopoverContent>
        </Popover>
        <Select value={section.style} onValueChange={(style) => onChange({ ...section, style: style as SheetSectionStyle })}>
          <SelectTrigger className="h-6 w-24 flex-shrink-0 border-border/40 bg-transparent text-xs" title="Section style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHEET_SECTION_STYLES.map((style) => (
              <SelectItem key={style} value={style}>
                {SHEET_SECTION_STYLE_LABELS[style]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(section.columns)} onValueChange={(value) => onChange({ ...section, columns: Number(value) })}>
          <SelectTrigger className="h-6 w-16 flex-shrink-0 border-border/40 bg-transparent text-xs" title="Field grid columns inside the section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count} col
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" title="Duplicate section" onClick={onDuplicate}>
          <LuCopy className="h-3.5 w-3.5" />
        </Button>
        <ConfirmDeleteButton className="h-6 w-6 flex-shrink-0" iconClassName="h-3.5 w-3.5" title="Delete section" onDelete={onDelete} />
      </div>

      <SortableContext items={section.fields.map((f) => f.id)} strategy={rectSortingStrategy}>
        <div className="grid min-h-8 gap-1.5" style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}>
          {section.fields.length === 0 && (
            <div className="col-span-full rounded-md border border-dashed border-border/50 px-2 py-2 text-center text-[11px] text-muted-foreground/60">Drop fields here</div>
          )}
          {section.fields.map((field) => (
            <SortableFieldRow
              key={field.id}
              field={field}
              sectionColumns={section.columns}
              allKeys={allKeys}
              onChange={(updated) => onChange({ ...section, fields: section.fields.map((f) => (f.id === updated.id ? updated : f)) })}
              onDuplicate={() => handleDuplicateField(field)}
              onDelete={() => onChange({ ...section, fields: section.fields.filter((f) => f.id !== field.id) })}
            />
          ))}
        </div>
      </SortableContext>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs">
            <LuPlus className="h-3 w-3" /> Add Field
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SHEET_FIELD_TYPES.map((type) => (
            <DropdownMenuItem key={type} onClick={() => handleAddField(type)}>
              {SHEET_FIELD_TYPE_LABELS[type]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SectionFrame>
  );
}

interface SortableSectionProps {
  section: SheetSection;
  allKeys: Set<string>;
  sectionKeys: Set<string>;
  onChange: (section: SheetSection) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableSection({ section, allKeys, sectionKeys, onChange, onDuplicate, onDelete }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, data: { type: "section" } });
  const span = Math.min(section.span, 4);
  const { elementRef, previewSpan, onResizeStart } = useSpanResize(span, 4, (next) => onChange({ ...section, span: next }));
  const displaySpan = previewSpan ?? span;

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      elementRef.current = node;
    },
    [setNodeRef, elementRef],
  );

  return (
    <div
      ref={setRefs}
      style={{ gridColumn: `span ${displaySpan} / span ${displaySpan}`, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className={cn("group/resize relative min-w-0", previewSpan !== null && "rounded-lg ring-2 ring-primary/40", isDragging && "rounded-lg outline-dashed outline-2 outline-primary/50")}
    >
      <SectionEditor
        section={section}
        allKeys={allKeys}
        sectionKeys={sectionKeys}
        dragHandleProps={{ ...attributes, ...listeners }}
        onChange={onChange}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
      <ResizeHandle onResizeStart={onResizeStart} title="Drag to resize section width" />
    </div>
  );
}

// Shrinks the moved section's span to the free space left in the row it landed
// in, so dropping a wide section beside another slots it in instead of wrapping.
function autoFitMovedSection(sections: SheetSection[], movedId: string): SheetSection[] {
  let cursor = 0;
  return sections.map((section) => {
    let span = Math.min(section.span, 4);
    if (section.id === movedId && cursor > 0 && cursor + span > 4) {
      span = 4 - cursor;
    } else if (cursor + span > 4) {
      cursor = 0;
    }
    cursor = (cursor + span) % 4;
    return span !== section.span ? { ...section, span } : section;
  });
}

// ─── Row Gap Drop Zones ───────────────────────────────────────────────────────

const GAP_ID_PREFIX = "section-gap";

function makeGapId(insertIndex: number, available: number): string {
  return `${GAP_ID_PREFIX}:${insertIndex}:${available}`;
}

function parseGapId(id: string): { insertIndex: number; available: number } | null {
  if (!id.startsWith(`${GAP_ID_PREFIX}:`)) {
    return null;
  }
  const [, insertIndex, available] = id.split(":");
  return { insertIndex: Number(insertIndex), available: Number(available) };
}

function GapDropZone({ id, span }: { id: string; span: number }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "gap" } });
  return (
    <div
      ref={setNodeRef}
      style={{ gridColumn: `span ${span} / span ${span}` }}
      className={cn(
        "flex min-h-16 items-center justify-center rounded-lg border-2 border-dashed border-border/50 text-[11px] text-muted-foreground/60 transition-colors",
        isOver && "border-primary bg-primary/10 text-primary",
      )}
    >
      Drop here ({span === 4 ? "full" : `${span}/4`} wide)
    </div>
  );
}

// ─── Drag Overlay Previews ────────────────────────────────────────────────────

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

function FieldDragPreview({ field }: { field: SheetField }) {
  return (
    <div className="flex h-full cursor-grabbing items-center gap-1.5 rounded-md border border-primary/50 bg-background px-1.5 py-1 shadow-xl ring-1 ring-primary/20">
      <LuGripVertical className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{field.label}</span>
      <Badge variant="outline" className="h-5 flex-shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground">
        {SHEET_FIELD_TYPE_LABELS[field.type]}
      </Badge>
    </div>
  );
}

function SectionDragPreview({ section }: { section: SheetSection }) {
  const preset = SECTION_STYLE_PRESETS[section.style];
  return (
    <SectionFrame style={section.style} className="h-full cursor-grabbing opacity-95 shadow-2xl ring-2 ring-primary/40">
      <h3 className={cn("mb-1 text-sm font-semibold", preset.title)}>{section.title || "Untitled"}</h3>
      <p className="text-[11px] text-muted-foreground/70">
        {section.fields.length} {section.fields.length === 1 ? "field" : "fields"}
      </p>
    </SectionFrame>
  );
}

// ─── Editor Root ──────────────────────────────────────────────────────────────

export function SheetTemplateEditor({ sections, onChange }: SheetTemplateEditorProps) {
  // Local copy so cross-section drag previews don't persist to the store until drop
  const [localSections, setLocalSections] = useState<SheetSection[]>(sections);
  const [draggingType, setDraggingType] = useState<"section" | "field" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  const allKeys = new Set(localSections.flatMap((s) => s.fields.map((f) => f.key)));
  const sectionKeys = new Set(localSections.map((s) => s.key));

  const commit = (next: SheetSection[]) => {
    setLocalSections(next);
    onChange(next);
  };

  const findSectionOfField = (list: SheetSection[], fieldId: string) => list.find((s) => s.fields.some((f) => f.id === fieldId));
  const resolveSectionId = (list: SheetSection[], id: string) => (list.some((s) => s.id === id) ? id : findSectionOfField(list, id)?.id);

  const activeSection = activeId ? localSections.find((s) => s.id === activeId) : undefined;
  const activeField = activeId ? findSectionOfField(localSections, activeId)?.fields.find((f) => f.id === activeId) : undefined;

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingType((event.active.data.current?.type as "section" | "field") ?? null);
    setActiveId(event.active.id as string);
  };

  const handleDragCancel = () => {
    setDraggingType(null);
    setActiveId(null);
    setLocalSections(sections);
  };

  // Move a field between sections live while dragging so the drop position is visible
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || draggingType !== "field") {
      return;
    }
    setLocalSections((prev) => {
      const sourceSection = findSectionOfField(prev, active.id as string);
      const targetSectionId = resolveSectionId(prev, over.id as string);
      if (!sourceSection || !targetSectionId || sourceSection.id === targetSectionId) {
        return prev;
      }
      const field = sourceSection.fields.find((f) => f.id === active.id)!;
      return prev.map((section) => {
        if (section.id === sourceSection.id) {
          return { ...section, fields: section.fields.filter((f) => f.id !== active.id) };
        }
        if (section.id === targetSectionId) {
          const overIndex = section.fields.findIndex((f) => f.id === over.id);
          const insertIndex = overIndex >= 0 ? overIndex : section.fields.length;
          const fields = [...section.fields];
          fields.splice(insertIndex, 0, field);
          return { ...section, fields };
        }
        return section;
      });
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const type = draggingType;
    setDraggingType(null);
    setActiveId(null);

    if (!over) {
      commit(localSections);
      return;
    }

    if (type === "section") {
      const oldIndex = localSections.findIndex((s) => s.id === active.id);
      if (oldIndex < 0) {
        return;
      }

      // Dropped into the free space of a row: insert there sized to the gap
      const gap = parseGapId(over.id as string);
      if (gap) {
        const moved = localSections[oldIndex];
        const remaining = localSections.filter((s) => s.id !== active.id);
        const insertIndex = gap.insertIndex > oldIndex ? gap.insertIndex - 1 : gap.insertIndex;
        remaining.splice(insertIndex, 0, { ...moved, span: Math.min(Math.min(moved.span, 4), gap.available) });
        commit(remaining);
        return;
      }

      const targetId = resolveSectionId(localSections, over.id as string);
      const newIndex = localSections.findIndex((s) => s.id === targetId);
      if (newIndex >= 0 && oldIndex !== newIndex) {
        commit(autoFitMovedSection(arrayMove(localSections, oldIndex, newIndex), active.id as string));
      }
      return;
    }

    if (type === "field") {
      const section = findSectionOfField(localSections, active.id as string);
      if (section) {
        const oldIndex = section.fields.findIndex((f) => f.id === active.id);
        const newIndex = section.fields.findIndex((f) => f.id === over.id);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          commit(localSections.map((s) => (s.id === section.id ? { ...s, fields: arrayMove(s.fields, oldIndex, newIndex) } : s)));
          return;
        }
      }
      // Cross-section moves already happened in handleDragOver — persist them
      commit(localSections);
    }
  };

  const handleAddSection = () => {
    const title = "New Section";
    commit([...localSections, { id: crypto.randomUUID(), key: uniqueKey(slugifyKey(title), sectionKeys), title, style: "plain", columns: 2, span: 4, fields: [] }]);
  };

  const handleDuplicateSection = (section: SheetSection) => {
    const keys = new Set(allKeys);
    const copy: SheetSection = {
      ...structuredClone(section),
      id: crypto.randomUUID(),
      key: uniqueKey(section.key, sectionKeys),
      fields: section.fields.map((field) => {
        const duplicated = duplicateField(field, keys);
        keys.add(duplicated.key);
        return duplicated;
      }),
    };
    const index = localSections.findIndex((s) => s.id === section.id);
    const next = [...localSections];
    next.splice(index + 1, 0, copy);
    commit(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/70">Drag sections and fields into position. Drag the right edge of a section or field to resize it. Click a label to rename it.</p>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={localSections.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-3">
            {(() => {
              // Interleave sections with drop zones for the free space in each
              // partially-filled row (only while a section is being dragged)
              const children: React.ReactNode[] = [];
              let cursor = 0;
              localSections.forEach((section, index) => {
                const span = Math.min(section.span, 4);
                if (cursor + span > 4) {
                  cursor = 0;
                }
                children.push(
                  <SortableSection
                    key={section.id}
                    section={section}
                    allKeys={allKeys}
                    sectionKeys={sectionKeys}
                    onChange={(updated) => commit(localSections.map((s) => (s.id === updated.id ? updated : s)))}
                    onDuplicate={() => handleDuplicateSection(section)}
                    onDelete={() => commit(localSections.filter((s) => s.id !== section.id))}
                  />,
                );
                cursor = (cursor + span) % 4;
                const next = localSections[index + 1];
                const nextSpan = next ? Math.min(next.span, 4) : null;
                const rowEnds = cursor === 0 || nextSpan === null || cursor + nextSpan > 4;
                if (draggingType === "section" && cursor > 0 && rowEnds) {
                  children.push(<GapDropZone key={`gap-${section.id}`} id={makeGapId(index + 1, 4 - cursor)} span={4 - cursor} />);
                  cursor = 0;
                }
              });
              return children;
            })()}
          </div>
        </SortableContext>
        {/* Portal to body: the dialog's translate(-50%,-50%) re-anchors position:fixed, which would offset the overlay from the cursor */}
        {createPortal(
          <DragOverlay dropAnimation={dropAnimation}>
            {draggingType === "field" && activeField && <FieldDragPreview field={activeField} />}
            {draggingType === "section" && activeSection && <SectionDragPreview section={activeSection} />}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      <Button type="button" variant="outline" size="sm" onClick={handleAddSection}>
        <LuPlus className="h-3.5 w-3.5" /> Add Section
      </Button>
    </div>
  );
}
