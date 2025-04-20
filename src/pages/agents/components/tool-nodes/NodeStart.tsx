import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import React, { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { NodeBase, NodeOutput } from "./NodeBase";
import { NodeProps } from "./nodeTypes";

// Supported types for the Start Node fields
const SUPPORTED_TYPES = ["string", "number", "boolean", "object", "array"] as const;

export type FieldType = (typeof SUPPORTED_TYPES)[number];

export interface StartNodeConfigField {
  key: string;
  type: FieldType;
  description?: string;
}

export interface StartNodeConfig {
  fields: StartNodeConfigField[];
}

/**
 * Dialog for editing Start Node fields (key/type pairs)
 */
export interface StartNodeConfigDialogProps {
  open: boolean;
  initialFields: StartNodeConfigField[];
  onSave: (fields: StartNodeConfigField[]) => void;
  onCancel: () => void;
}

export const StartNodeConfigDialog: React.FC<StartNodeConfigDialogProps> = ({ open, initialFields, onSave, onCancel }) => {
  const { control, handleSubmit, reset } = useForm<{ fields: StartNodeConfigField[] }>({
    defaultValues: { fields: initialFields },
    mode: "onChange",
  });
  const { fields, append, remove, move, update } = useFieldArray({ control, name: "fields" });

  // Reset form when dialog opens/closes or initialFields change
  useEffect(() => {
    reset({ fields: initialFields });
  }, [open, initialFields, reset]);

  // Validation helpers
  const isKeyDuplicate = (key: string, idx: number) => fields.some((f, i) => i !== idx && f.key.trim().toLowerCase() === key.trim().toLowerCase());

  // Add new field
  const handleAdd = () => {
    append({ key: "", type: "string" });
  };

  // Save handler
  const onSubmit = (data: { fields: StartNodeConfigField[] }) => {
    // Filter out empty keys
    const validFields = data.fields.filter((f) => f.key.trim() !== "");
    onSave(validFields);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Start Node Fields</DialogTitle>
          </DialogHeader>
          <DialogBody className="overflow-hidden">
            <div className="flex flex-col gap-4 py-6">
              {fields.length === 0 && <div className="text-muted-foreground text-xs w-full text-center  ">No fields. Add one below.</div>}
              {fields.map((field, idx) => (
                <>
                  <div
                    key={field.id}
                    className=" bg-muted/30 flex flex-col gap-1 w-full group border-border px-4 py-4 rounded last:mb-0 last:pb-0 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="cursor-grab text-muted-foreground">
                        <GripVertical size={16} />
                      </span>
                      <Controller
                        name={`fields.${idx}.key`}
                        control={control}
                        rules={{
                          required: "Key required",
                          validate: (v) => v.trim() !== "" || "Key required" || !isKeyDuplicate(v, idx) || "Duplicate key",
                        }}
                        render={({ field, fieldState }) => (
                          <div className="flex flex-col flex-1 min-w-0">
                            <Input
                              {...field}
                              placeholder="Field key (e.g. userId)"
                              className={"font-mono text-xs"}
                              autoFocus={idx === fields.length - 1}
                            />
                            {isKeyDuplicate(field.value, idx) && <span className="text-xs text-destructive">Duplicate key</span>}
                            {fieldState.error && <span className="text-xs text-destructive">{fieldState.error.message}</span>}
                          </div>
                        )}
                      />
                      <Controller
                        name={`fields.${idx}.type`}
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-[100px] text-xs" aria-label="Type">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {SUPPORTED_TYPES.map((type) => (
                                <SelectItem key={type} value={type} className="text-xs">
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <Button type="button" variant="destructive" size="xs" className="ml-1" onClick={() => remove(idx)} aria-label="Remove field">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                    <Controller
                      name={`fields.${idx}.description`}
                      control={control}
                      render={({ field }) => (
                        <div className="mt-1">
                          <span className="text-xs text-muted-foreground">Description</span>
                          <div className="mt-1">
                            <MarkdownTextArea initialValue={field.value || ""} onChange={field.onChange} label={undefined} enableHistory={false} />
                          </div>
                        </div>
                      )}
                    />
                  </div>
                  {idx < fields.length - 1 && <Separator key={`separator-${field.id}`} className="m-0" />}
                </>
              ))}
              <div className="flex w-full justify-end mt-2">
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={handleAdd}>
                  <Plus size={16} className="mr-1" /> Add Field
                </Button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} size="dialog">
              Cancel
            </Button>
            <Button
              type="submit"
              size="dialog"
              disabled={fields.length === 0 || fields.some((f, idx) => isKeyDuplicate(f.key, idx) || !f.key?.trim())}
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * NodeStart: The entry node for the tool pipeline. Cannot be deleted.
 * Shows a single JSON output and displays configured fields (key/type pairs) in the node center.
 */
export const NodeStart = ({ data, selected }: NodeProps) => {
  const config = data.config as StartNodeConfig | undefined;
  const fields: StartNodeConfigField[] = config?.fields || [];

  // Single JSON output
  const outputs: NodeOutput[] = [
    {
      id: "json",
      label: "JSON",
      edgeType: "json",
    },
  ];

  return (
    <NodeBase title="Tool Params" nodeType="start" data={data} selected={!!selected} outputs={outputs}>
      <div className="flex flex-col gap-2 w-full">
        {fields.length > 0 ? (
          <>
            <div className="text-xs text-foreground font-semibold mb-1">Configured Fields:</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground w-full">
              {fields.map((field, idx) => (
                <div key={idx} className="contents">
                  <span className="font-mono text-foreground truncate text-right">{field.key}</span>
                  <span className="text-[0.6rem] px-2 py-0 rounded bg-muted text-muted-foreground border border-border justify-self-start">
                    {field.type}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">Double-click to configure fields</span>
        )}
      </div>
    </NodeBase>
  );
};
