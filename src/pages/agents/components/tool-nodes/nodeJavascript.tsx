import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateNodeInternals } from "@xyflow/react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { NodeBase, NodeInput, NodeOutput } from "./NodeBase";
import { NodeProps } from "./nodeTypes";

/**
 * JavascriptNode: Node for executing custom JavaScript code
 */
export interface JavascriptNodeConfig {
  name: string;
  code: string;
}

/**
 * JavascriptNodeConfigDialog: Dialog for configuring JavaScript node
 */
export interface JavascriptNodeConfigDialogProps {
  open: boolean;
  initialConfig: JavascriptNodeConfig;
  onSave: (config: JavascriptNodeConfig) => void;
  onCancel: () => void;
}

export const JavascriptNodeConfigDialog: React.FC<JavascriptNodeConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = useForm<JavascriptNodeConfig>({
    defaultValues: initialConfig,
    mode: "onChange",
  });

  // Reset form when dialog opens/closes or initialConfig changes
  useEffect(() => {
    reset(initialConfig);
  }, [open, initialConfig, reset]);

  // Save handler
  const onSubmit = (data: JavascriptNodeConfig) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure JavaScript Node</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4 py-2">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Node Name</label>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: "Node name is required" }}
                  render={({ field }) => <Input {...field} placeholder="Enter node name" className="text-xs" maxLength={64} autoFocus />}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">JavaScript Code</label>
                <Controller
                  name="code"
                  control={control}
                  rules={{ required: "Code is required" }}
                  render={({ field }) => (
                    <MarkdownTextArea
                      initialValue={field.value}
                      onChange={field.onChange}
                      placeholder={"// Write your JavaScript code here\nreturn input;"}
                      className="h-full"
                    />
                  )}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} size="dialog">
              Cancel
            </Button>
            <Button type="submit" size="dialog" disabled={!isDirty || !isValid}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const JavascriptNode = ({ id, data, selected }: NodeProps) => {
  const config = (data.config || {}) as JavascriptNodeConfig;

  // Define inputs
  const inputs: NodeInput[] = [
    { id: "in-json", label: "JSON", edgeType: "json" },
    { id: "in-string", label: "String", edgeType: "string" },
  ];

  // Define outputs
  const outputs: NodeOutput[] = [
    { id: "out-json", label: "JSON", edgeType: "json" },
    { id: "out-string", label: "String", edgeType: "string" },
  ];

  // Ensure React Flow updates handle positions when handles change
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputs.length, outputs.length, updateNodeInternals]);

  // Node display name fallback
  const nodeName = `JavaScript: ${config.name?.trim()}`;

  return (
    <NodeBase title={nodeName} nodeType="javascript" data={data} selected={!!selected} inputs={inputs} outputs={outputs}>
      <div className="text-foreground text-xs text-center">Double-click to configure JavaScript code</div>
    </NodeBase>
  );
};
