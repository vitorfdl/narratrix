import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReactFlow } from "@xyflow/react";
import { Code, Settings } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import JsonSchemaCreator from "../json-schema/JsonSchemaCreator";
import { SchemaDefinition } from "../json-schema/types";
import { NodeBase, NodeInput, NodeOutput, useNodeRef } from "./NodeBase";
import { NodeConfigProvider, NodeConfigRegistry } from "./NodeConfigRegistry";
import { NodeProps } from "./nodeTypes";

/**
 * JavascriptNode: Node for executing custom JavaScript code
 */
export interface JavascriptNodeConfig {
  name: string;
  code: string;
  inputSchema?: SchemaDefinition | null;
}

// Define inputs with precise positioning using targetRef
const inputs: NodeInput[] = [];

// Define outputs - these will be positioned in the response section
const outputs: NodeOutput[] = [
  { id: "out-toolset", label: "Toolset", edgeType: "toolset" },
];

/**
 * Configuration provider for Javascript nodes
 */
export class JavascriptNodeConfigProvider implements NodeConfigProvider {
  getDefaultConfig() {
    return {
      label: "Javascript Node",
      config: {
        name: "Javascript Node",
        code: "// Write your JavaScript code here\nreturn input;",
      } as JavascriptNodeConfig,
    };
  }
}

// Register the configuration provider
NodeConfigRegistry.register("javascript", new JavascriptNodeConfigProvider());

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
    watch,
    setValue,
    formState: { isValid, isDirty },
  } = useForm<JavascriptNodeConfig>({
    defaultValues: initialConfig,
    mode: "onChange",
  });

  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
  const currentInputSchema = watch("inputSchema");

  // Reset form only when dialog opens (not when it closes or on other changes)
  useEffect(() => {
    if (open) {
      reset(initialConfig);
    }
  }, [open, reset]); // Removed initialConfig from dependencies

  // Save handler
  const onSubmit = (data: JavascriptNodeConfig) => {
    onSave(data);
  };

  const handleSchemaConfigSave = (schema: SchemaDefinition) => {
    setValue("inputSchema", schema, { shouldDirty: true });
    setSchemaDialogOpen(false);
  };

  const handleSchemaConfigCancel = () => {
    setSchemaDialogOpen(false);
  };

  const removeInputSchema = () => {
    setValue("inputSchema", null, { shouldDirty: true });
  };

  return (
    <>
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
                    render={({ field }) => <Input {...field} placeholder="Enter node name" className="text-xs" maxLength={64} autoFocus />}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Input Schema</label>
                  <div className="space-y-1">
                    {currentInputSchema ? (
                      <div className="px-3 py-1 bg-muted/50 rounded-md border">
                        <div className="flex items-center justify-between mb-0">
                          <span className="text-xs font-medium">{currentInputSchema.title || "Input Schema"}</span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSchemaDialogOpen(true)}
                              className="h-6 px-2 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={removeInputSchema}
                              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                        {currentInputSchema.description && (
                          <p className="text-xs text-muted-foreground mb-2">{currentInputSchema.description}</p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {Object.keys(currentInputSchema.properties || {}).length} properties defined
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-muted/20 rounded-md border-dashed border">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-2">No input schema configured</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSchemaDialogOpen(true)}
                            className="h-7 px-3 text-xs"
                          >
                            Configure Schema
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">JavaScript Code</label>
                  <Controller
                    name="code"
                    control={control}
                    render={({ field }) => (
                      <MarkdownTextArea
                        key={open ? 'open' : 'closed'} // Force remount when dialog opens
                        initialValue={field.value}
                        onChange={field.onChange}
                        placeholder={"// Write your JavaScript code here\n// Input data will be available as 'input' variable\nreturn input;"}
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

      <JsonSchemaCreator
        open={schemaDialogOpen}
        onOpenChange={setSchemaDialogOpen}
        initialSchema={currentInputSchema}
        onSave={handleSchemaConfigSave}
        onCancel={handleSchemaConfigCancel}
      />
    </>
  );
};

/**
 * Memoized content component to prevent unnecessary re-renders
 */
const JavascriptContent = memo<{ config: JavascriptNodeConfig; onConfigureSchema: () => void; onConfigureCode: () => void }>(({ config, onConfigureSchema, onConfigureCode }) => {
  const registerElementRef = useNodeRef();
  
  // Prevent event propagation to React Flow
  const handleSchemaButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onConfigureSchema();
  }, [onConfigureSchema]);

  const handleCodeButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onConfigureCode();
  }, [onConfigureCode]);
  
  return (
    <div className="space-y-4 w-full">
      {/* Input Section - Aligns with input handles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Inputs</label>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 hover:bg-primary/10"
            onClick={handleCodeButtonClick}
            title="Configure JavaScript code"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1">
          <div 
            ref={(el) => registerElementRef?.("json-input-section", el)}
            className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-md"
          >
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-muted-foreground">
              {config.inputSchema ? 
                `${config.inputSchema.title || "Input Schema"} (${Object.keys(config.inputSchema.properties || {}).length} props)` :
                "JSON Data (No schema)"
              }
            </span>
          </div>
        </div>
      </div>

      {/* Code Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Code</label>
        </div>
        <div className="p-2 bg-muted/50 rounded-md max-h-16 overflow-y-auto font-mono">
          <span className="text-xxs text-muted-foreground">
            {config.code ? 
              config.code.split('\n').slice(0, 3).join('\n') + (config.code.split('\n').length > 3 ? '\n...' : '')
              : "// No code configured"
            }
          </span>
        </div>
      </div>
    </div>
  );
});

JavascriptContent.displayName = 'JavascriptContent';

export const JavascriptNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || {}) as JavascriptNodeConfig;

  // Node display name fallback
  const nodeName = config.name?.trim() || "JavaScript";

  const handleConfigSave = useCallback((newConfig: JavascriptNodeConfig) => {
    // Use React Flow's setNodes to properly update the node
    setNodes((nodes) => 
      nodes.map((node) => 
        node.id === id 
          ? { ...node, data: { ...node.data, config: newConfig } }
          : node
      )
    );
    setConfigDialogOpen(false);
  }, [id, setNodes]);

  const handleConfigCancel = useCallback(() => {
    setConfigDialogOpen(false);
  }, []);

  const handleSchemaConfigSave = useCallback((schema: SchemaDefinition) => {
    // Use React Flow's setNodes to properly update the node
    const updatedConfig = { ...config, inputSchema: schema };
    setNodes((nodes) => 
      nodes.map((node) => 
        node.id === id 
          ? { ...node, data: { ...node.data, config: updatedConfig } }
          : node
      )
    );
    setSchemaDialogOpen(false);
  }, [config, id, setNodes]);

  const handleSchemaConfigCancel = useCallback(() => {
    setSchemaDialogOpen(false);
  }, []);

  const handleConfigureCode = useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  const handleConfigureSchema = useCallback(() => {
    setSchemaDialogOpen(true);
  }, []);

  return (
    <>
      <NodeBase 
        title={nodeName} 
        nodeType="javascript" 
        data={data} 
        selected={!!selected} 
        inputs={inputs} 
        outputs={outputs}
        icon={<Code className="h-4 w-4" />}
        nodeId={id}
        // onConfigure={() => setConfigDialogOpen(true)}
      >
        <JavascriptContent 
          config={config} 
          onConfigureSchema={handleConfigureSchema}
          onConfigureCode={handleConfigureCode}
        />
      </NodeBase>

      <JavascriptNodeConfigDialog
        open={configDialogOpen}
        initialConfig={config}
        onSave={handleConfigSave}
        onCancel={handleConfigCancel}
      />

      <JsonSchemaCreator
        open={schemaDialogOpen}
        onOpenChange={setSchemaDialogOpen}
        initialSchema={config.inputSchema || null}
        onSave={handleSchemaConfigSave}
        onCancel={handleSchemaConfigCancel}
      />
    </>
  );
});

JavascriptNode.displayName = 'JavascriptNode';
