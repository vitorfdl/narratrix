import { useReactFlow } from "@xyflow/react";
import { FileText, Settings } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NodeBase, NodeOutput } from "../tool-components/NodeBase";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

/**
 * TextNode: Node for outputting configured text content
 */
export interface TextNodeConfig {
  name: string;
  content: string;
}

// Define the node's metadata and properties
const TEXT_NODE_METADATA = {
  type: "text",
  label: "Text",
  category: "Utility",
  description: "Output configured text content as a string",
  icon: FileText,
  theme: createNodeTheme("blue"),
  deletable: true,
  inputs: [],
  outputs: [{ id: "out-text", label: "Text", edgeType: "string" }] as NodeOutput[],
  defaultConfig: {
    name: "Text Node",
    content: "Enter your text content here...",
  } as TextNodeConfig,
};

// Configuration provider namespace
export namespace TextNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: TEXT_NODE_METADATA.label,
      config: TEXT_NODE_METADATA.defaultConfig,
    };
  }
}

/**
 * TextNodeConfigDialog: Dialog for configuring Text node
 */
export interface TextNodeConfigDialogProps {
  open: boolean;
  initialConfig: TextNodeConfig;
  onSave: (config: TextNodeConfig) => void;
  onCancel: () => void;
}

export const TextNodeConfigDialog: React.FC<TextNodeConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = useForm<TextNodeConfig>({
    defaultValues: initialConfig,
    mode: "onChange",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset(initialConfig);
    }
  }, [open, reset]);

  // Save handler
  const onSubmit = (data: TextNodeConfig) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Text Node</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4 py-2">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Node Name</label>
                <Controller name="name" control={control} render={({ field }) => <Input {...field} placeholder="Enter node name" className="text-xs" maxLength={64} autoFocus />} />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Text Content</label>
                <Controller
                  name="content"
                  control={control}
                  render={({ field }) => (
                    <MarkdownTextArea
                      key={open ? "open" : "closed"} // Force remount when dialog opens
                      initialValue={field.value}
                      onChange={field.onChange}
                      placeholder="Enter your text content here..."
                      className="h-full"
                      useEditorOnly={true}
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

/**
 * Memoized content component to prevent unnecessary re-renders
 */
const TextContent = memo<{ config: TextNodeConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  // const registerElementRef = useNodeRef();

  // Prevent event propagation to React Flow
  const handleConfigureClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onConfigure();
    },
    [onConfigure],
  );

  return (
    <div className="space-y-4 w-full">
      {/* Content Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Content</label>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10" onClick={handleConfigureClick} title="Configure text content">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
        <div className="p-2 bg-muted/50 rounded-md max-h-16 custom-scrollbar overflow-y-auto border-l-2 border-blue-400 dark:border-blue-500">
          <span className="text-xxs  text-muted-foreground whitespace-pre-line leading-tight" style={{ lineHeight: "1.1", display: "block" }}>
            {config.content ? config.content.split("\n").slice(0, 3).join("\n") + (config.content.split("\n").length > 3 ? "\n..." : "") : "No content configured"}
          </span>
        </div>
      </div>
    </div>
  );
});

TextContent.displayName = "TextContent";

export const TextNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || TEXT_NODE_METADATA.defaultConfig) as TextNodeConfig;

  const handleConfigSave = useCallback(
    (newConfig: TextNodeConfig) => {
      // Use React Flow's setNodes to properly update the node
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes],
  );

  const handleConfigCancel = useCallback(() => {
    setConfigDialogOpen(false);
  }, []);

  const handleConfigure = useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <TextContent config={config} onConfigure={handleConfigure} />
      </NodeBase>

      <TextNodeConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={handleConfigCancel} />
    </>
  );
});

TextNode.displayName = "TextNode";

// Register the node
NodeRegistry.register({
  metadata: TEXT_NODE_METADATA,
  component: TextNode,
  configProvider: TextNodeConfigProvider,
});
