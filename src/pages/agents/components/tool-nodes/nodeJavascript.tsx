import { useReactFlow } from "@xyflow/react";
import { BookOpen, ChevronDown, Code, List, Maximize2, Minimize2, Save, TableProperties, X } from "lucide-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { JavascriptEditor, type JavascriptEditorRef } from "@/components/markdownRender/javascript-editor";
import { MarkdownViewer } from "@/components/markdownRender/markdown-viewer";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mapSourceHandleToReadableName } from "@/services/agent-workflow/handles";
import { runJavascript } from "@/services/agent-workflow/javascript-runner";
import { type NodeExecutionResult, type NodeExecutor, type WorkflowToolDefinition } from "@/services/agent-workflow/types";
import JsonSchemaCreator from "../json-schema/JsonSchemaCreator";
import type { SchemaDefinition } from "../json-schema/types";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

// ---------------------------------------------------------------------------
// Snippets
// ---------------------------------------------------------------------------
const CODE_SNIPPETS: { label: string; code: string }[] = [
  {
    label: "Echo input",
    code: "return input;",
  },
  {
    label: "Use chat history",
    code: "// When Chat History is connected, input is the messages array\nconst messages = Array.isArray(input) ? input : input.chatHistory;\nreturn utils.jsonStringify(messages);",
  },
  {
    label: "Use multiple inputs",
    code: "// When multiple nodes are connected, input is a named object\n// e.g. { chatHistory: [...], chatId: '...', participantId: '...' }\nconst { chatHistory, chatId } = input;\nreturn utils.jsonStringify({ chatId, messageCount: chatHistory?.length });",
  },
  {
    label: "Get chat messages",
    code: "const msgs = await stores.chat.fetchChatMessages();\nreturn utils.jsonStringify(msgs);",
  },
  {
    label: "Get character by ID",
    code: "// Connect a Trigger node's Participant ID output to get the ID in `input`\nconst char = await stores.characters.getCharacterById(String(input));\nreturn utils.jsonStringify(char);",
  },
  {
    label: "Add chat memory",
    code: "// Adds a short memory to the current chat\nawait stores.chat.addChatMemory({ content: String(input), type: 'short' });\nreturn 'Memory added';",
  },
  {
    label: "Delay + return",
    code: "await utils.delay(1000); // wait 1 second\nreturn input;",
  },
  {
    label: "Named function",
    code: "async function process(data) {\n  // your logic here\n  return data;\n}\n\nreturn await process(input);",
  },
];

// ---------------------------------------------------------------------------
// API Reference content
// ---------------------------------------------------------------------------
const API_REFERENCE_MARKDOWN = `
**\`input\` variable** 

The value of \`input\` depends on how many nodes are connected:

- **No connections** — \`undefined\`
- **Single connection** — the raw value from that node (e.g. a string, array of messages, or an ID)
- **Multiple connections** — a named object with one key per connected node:

| Source handle | Key in \`input\` |
|---------------|-----------------|
| Chat History → Chat History | \`chatHistory\` |
| Trigger → Chat ID | \`chatId\` |
| Trigger → Participant ID | \`participantId\` |
| Any text/string output | \`text\` |
| Any toolset output | \`toolset\` |

If two nodes produce the same key, the values are collected into an array.

---

**\`stores.chat\`**
- \`fetchChatMessages(chatId?, chapterId?)\`
- \`addChatMessage({ content, role, ... })\`
- \`deleteChatMessage(messageId)\`
- \`fetchChatList(profileId)\`

**\`stores.characters\`**
- \`getCharacterById(id)\`
- \`createCharacter(data)\`
- \`updateCharacter(profileId, id, data)\`
- \`deleteCharacter(id)\`
- \`fetchCharacters(profileId)\`

**\`stores.lorebook\`**
- \`loadLorebooks(profileId)\`
- \`createLorebook(data)\` / \`deleteLorebook(id)\`
- \`createLorebookEntry(data)\` / \`deleteLorebookEntry(profileId, id, lorebookId)\`

---

**\`utils\`**

| Function | Returns |
|----------|---------|
| \`utils.delay(ms)\` | \`Promise<void>\` |
| \`utils.jsonParse(text)\` | \`unknown \\| null\` |
| \`utils.jsonStringify(value)\` | \`string\` |
`.trim();

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

/**
 * Build a clean input value for user code from the edges connected to this JS node.
 *
 * - Single connection: returns the raw value directly (e.g. a string, array).
 * - Multiple connections: returns a named object using human-readable keys derived
 *   from the source handle ID (e.g. `out-messages` → `chatHistory`).
 * - Duplicate keys (two nodes with the same source handle): values are collected
 *   into an array under that key.
 */
function buildJavascriptInput(node: { id: string }, edges: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }[], contextValues: Map<string, any>): unknown {
  const incoming = edges.filter((e) => e.target === node.id);
  if (incoming.length === 0) {
    return undefined;
  }

  const resolved: { key: string; value: unknown }[] = [];
  for (const edge of incoming) {
    const handleScopedKey = `${edge.source}::${edge.sourceHandle}`;
    const value = contextValues.has(handleScopedKey) ? contextValues.get(handleScopedKey) : contextValues.get(edge.source);
    if (value !== undefined) {
      const key = mapSourceHandleToReadableName(edge.sourceHandle ?? "value");
      resolved.push({ key, value });
    }
  }

  if (resolved.length === 0) {
    return undefined;
  }

  // Single connection: unwrap the value directly for simplicity
  if (resolved.length === 1) {
    return resolved[0].value;
  }

  // Multiple connections: build a named object, collecting duplicate keys into arrays
  const result: Record<string, unknown> = {};
  for (const { key, value } of resolved) {
    if (key in result) {
      if (!Array.isArray(result[key])) {
        result[key] = [result[key]];
      }
      (result[key] as unknown[]).push(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const executeJavascriptNode: NodeExecutor = async (node, _inputs, context, agent, _deps): Promise<NodeExecutionResult> => {
  const cfg = (node.config as JavascriptNodeConfig) || {};
  const code = typeof cfg?.code === "string" ? cfg.code : "";

  // Determine which outputs are active based on mode (authoritative) or connected edges (legacy fallback)
  const outgoing = agent.edges.filter((e) => e.source === node.id);
  let wantText: boolean;
  let wantTool: boolean;
  if (cfg?.mode === "script") {
    wantText = true;
    wantTool = false;
  } else if (cfg?.mode === "tool") {
    wantText = false;
    wantTool = true;
  } else {
    wantText = outgoing.some((e) => e.sourceHandle === "out-string");
    wantTool = outgoing.some((e) => e.sourceHandle === "out-toolset");
  }

  const toolsetHandleKey = `${node.id}::out-toolset`;
  const textHandleKey = `${node.id}::out-string`;

  const name = cfg?.inputSchema?.title || node.label || "javascriptTool";
  const tool: WorkflowToolDefinition = {
    name,
    description: "Javascript node tool",
    inputSchema: cfg?.inputSchema || null,
    invoke: async (args: Record<string, any>) => {
      return await runJavascript(code, args);
    },
  };

  // Build a clean, user-friendly input value from connected edges
  const cleanInput = buildJavascriptInput(node, agent.edges, context.nodeValues);

  let textResult: string | undefined;
  if (wantText) {
    try {
      const result = await runJavascript(code, cleanInput);
      textResult = typeof result === "string" ? result : JSON.stringify(result ?? "");
      context.nodeValues.set(textHandleKey, textResult);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Javascript execution failed";
      return { success: false, error: message };
    }
  }

  if (wantTool && wantText) {
    return { success: true, value: { toolset: [tool], text: textResult } } as any;
  }

  if (wantTool) {
    context.nodeValues.set(toolsetHandleKey, [tool]);
    return { success: true, value: [tool] };
  }

  return { success: true, value: textResult || "" };
};

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------
export interface JavascriptNodeConfig {
  mode: "script" | "tool";
  code: string;
  inputSchema?: SchemaDefinition | null;
}

// ---------------------------------------------------------------------------
// Node metadata
// ---------------------------------------------------------------------------
const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-string", label: "Text", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];
const BOTH_OUTPUTS: NodeOutput[] = [
  { id: "out-toolset", label: "Toolset", edgeType: "toolset" },
  { id: "out-string", label: "Text", edgeType: "string" },
];

const JAVASCRIPT_NODE_METADATA = {
  type: "javascript",
  label: "Javascript",
  description: "Execute custom JavaScript code with configurable inputs",
  icon: Code,
  theme: createNodeTheme("orange"),
  deletable: true,
  category: "Code Runner",
  inputs: [{ id: "in-code-params", label: "Any", edgeType: "any" as const, targetRef: "code-section", allowMultipleConnections: true }] as NodeInput[],
  outputs: BOTH_OUTPUTS,
  defaultConfig: {
    mode: "script",
    code: "// Write your JavaScript code here\nreturn input;",
  } as JavascriptNodeConfig,
};

namespace JavascriptNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: JAVASCRIPT_NODE_METADATA.label,
      config: JAVASCRIPT_NODE_METADATA.defaultConfig,
    };
  }
}

// ---------------------------------------------------------------------------
// Helper: resolve dynamic outputs from mode
// ---------------------------------------------------------------------------
function getOutputsForMode(mode?: "script" | "tool"): NodeOutput[] {
  if (mode === "script") {
    return SCRIPT_OUTPUTS;
  }
  if (mode === "tool") {
    return TOOL_OUTPUTS;
  }
  // Legacy nodes without a mode: keep both
  return BOTH_OUTPUTS;
}

// ---------------------------------------------------------------------------
// Config dialog
// ---------------------------------------------------------------------------
export interface JavascriptNodeConfigDialogProps {
  open: boolean;
  initialConfig: JavascriptNodeConfig;
  onSave: (config: JavascriptNodeConfig) => void;
  onCancel: () => void;
}

const JavascriptNodeConfigDialog: React.FC<JavascriptNodeConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
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
  const [expanded, setExpanded] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const editorRef = useRef<JavascriptEditorRef>(null);

  const currentInputSchema = watch("inputSchema");
  const currentMode = watch("mode");

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset only when dialog opens, not on every config change
  useEffect(() => {
    if (open) {
      reset(initialConfig);
      setExpanded(false);
    }
  }, [open, reset]);

  const onSubmit = (data: JavascriptNodeConfig) => {
    onSave(data);
  };

  const handleSchemaConfigSave = (schema: SchemaDefinition) => {
    setValue("inputSchema", schema, { shouldDirty: true });
    setSchemaDialogOpen(false);
  };

  const removeInputSchema = () => {
    setValue("inputSchema", null, { shouldDirty: true });
  };

  const handleInsertSnippet = (code: string) => {
    editorRef.current?.replaceContent(code);
    setValue("code", code, { shouldDirty: true });
  };

  const editorMinHeight = expanded ? "320px" : "200px";

  return (
    <>
      <Dialog open={open} onOpenChange={onCancel}>
        <DialogContent size="window" className="overflow-hidden" allowEscapeKeyClose={false} allowClickOutsideClose={false}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogHeader>
              <div className="flex items-center justify-between w-full">
                <DialogTitle>Configure JavaScript Node</DialogTitle>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpanded((v) => !v)} title={expanded ? "Collapse editor" : "Expand editor"}>
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </DialogHeader>

            <DialogBody className="max-h-full">
              <div className="flex flex-col gap-4 py-2">
                {/* Mode selector */}
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <label className="text-xs font-medium text-foreground">Mode</label>
                    <HelpTooltip>
                      <p className="mb-1">
                        <span className="font-semibold">Script</span> — Code runs inline during the workflow. The return value flows to the next node.
                      </p>
                      <p>
                        <span className="font-semibold">Tool</span> — Code is exposed as a callable tool for Agent nodes. Define an input schema and a name.
                      </p>
                    </HelpTooltip>
                  </div>
                  <Controller
                    name="mode"
                    control={control}
                    render={({ field }) => (
                      <div className="inline-flex rounded-md border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => field.onChange("script")}
                          className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                            field.value === "script" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Script
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange("tool")}
                          className={`px-4 py-1.5 text-xs font-medium border-l border-border transition-colors ${
                            field.value === "tool" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Tool
                        </button>
                      </div>
                    )}
                  />
                </div>

                {/* Input schema — only in tool mode */}
                {currentMode === "tool" && (
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Input Schema</label>
                    <div className="space-y-1">
                      {currentInputSchema ? (
                        <div className="px-3 py-1 bg-muted/50 rounded-md border">
                          <div className="flex items-center justify-between mb-0">
                            <span className="text-xs font-medium">{currentInputSchema.title || "Input Schema"}</span>
                            <div className="flex gap-1">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSchemaDialogOpen(true)} className="h-6 px-2 text-xs">
                                Edit
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={removeInputSchema} className="h-6 px-2 text-xs text-destructive hover:text-destructive">
                                Remove
                              </Button>
                            </div>
                          </div>
                          {currentInputSchema.description && <p className="text-xs text-muted-foreground mb-2">{currentInputSchema.description}</p>}
                          <div className="text-xs text-muted-foreground">{Object.keys(currentInputSchema.properties || {}).length} properties defined</div>
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/20 rounded-md border-dashed border">
                          <div className="text-center">
                            <Button type="button" variant="outline" size="sm" onClick={() => setSchemaDialogOpen(true)} className="h-7 px-3 text-xs">
                              Configure Schema
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Code editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-foreground">JavaScript Code</label>
                    <div className="flex items-center gap-1">
                      {/* API Reference popover */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
                            <BookOpen className="h-3 w-3" />
                            API Reference
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="left" align="start" className="w-[420px] p-0 bg-background border border-border shadow-lg">
                          <div className="max-h-[60vh] overflow-y-auto p-3 custom-scrollbar">
                            <MarkdownViewer content={API_REFERENCE_MARKDOWN} className="text-xs" />
                          </div>
                        </PopoverContent>
                      </Popover>
                      {/* Snippet picker */}
                      <Popover open={snippetsOpen} onOpenChange={setSnippetsOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
                            <List className="h-3 w-3" />
                            Snippets
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" side="bottom" className="w-[220px] p-1 bg-background border border-border shadow-lg">
                          {CODE_SNIPPETS.map((snippet) => (
                            <button
                              key={snippet.label}
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors"
                              onClick={() => {
                                handleInsertSnippet(snippet.code);
                                setSnippetsOpen(false);
                              }}
                            >
                              {snippet.label}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Controller
                    name="code"
                    control={control}
                    render={({ field }) => (
                      <JavascriptEditor
                        ref={editorRef}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={"// Write your JavaScript code here\n// Input data is available as 'input'\nreturn input;"}
                        minHeight={editorMinHeight}
                      />
                    )}
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onCancel} size="dialog">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" size="dialog" disabled={!isDirty || !isValid}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <JsonSchemaCreator
        open={schemaDialogOpen}
        onOpenChange={setSchemaDialogOpen}
        initialSchema={currentInputSchema ?? null}
        onSave={handleSchemaConfigSave}
        onCancel={() => setSchemaDialogOpen(false)}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Node body content
// ---------------------------------------------------------------------------
const JavascriptContent = memo<{ config: JavascriptNodeConfig; onConfigureCode: () => void }>(({ config, onConfigureCode }) => {
  const mode = config.mode ?? "script";
  const isToolMode = mode === "tool";

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase ${
            isToolMode ? "bg-orange-400/20 text-orange-400 dark:text-orange-300" : "bg-sky-400/20 text-sky-500 dark:text-sky-400"
          }`}
        >
          {isToolMode ? "Tool" : "Script"}
        </span>
        <NodeConfigButton onClick={onConfigureCode} title="Configure JavaScript code" />
      </div>

      {isToolMode && (
        <NodeField label="Input Schema" icon={TableProperties}>
          <NodeConfigPreview variant="badge">
            <span className="text-xs text-muted-foreground">
              {config.inputSchema ? `${config.inputSchema.title || "Input"} (${Object.keys(config.inputSchema.properties || {}).length} props)` : "No schema defined"}
            </span>
          </NodeConfigPreview>
        </NodeField>
      )}

      <NodeField label="Code" icon={Code} refId="code-section">
        <NodeConfigPreview variant="text" className="font-mono" empty="// No code configured">
          {config.code ? config.code.split("\n").slice(0, 3).join("\n") + (config.code.split("\n").length > 3 ? "\n..." : "") : undefined}
        </NodeConfigPreview>
      </NodeField>
    </div>
  );
});

JavascriptContent.displayName = "JavascriptContent";

// ---------------------------------------------------------------------------
// Node component
// ---------------------------------------------------------------------------
export const JavascriptNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || JAVASCRIPT_NODE_METADATA.defaultConfig) as JavascriptNodeConfig;

  const handleConfigSave = useCallback(
    (newConfig: JavascriptNodeConfig) => {
      const dynamicOutputs = getOutputsForMode(newConfig.mode);
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig, dynamicOutputs } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes],
  );

  const handleConfigureCode = useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <JavascriptContent config={config} onConfigureCode={handleConfigureCode} />
      </NodeBase>

      <JavascriptNodeConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

JavascriptNode.displayName = "JavascriptNode";

// Register the node
NodeRegistry.register({
  metadata: JAVASCRIPT_NODE_METADATA,
  component: JavascriptNode,
  configProvider: JavascriptNodeConfigProvider,
  executor: executeJavascriptNode,
  getDynamicOutputs: (config) => {
    return getOutputsForMode((config as JavascriptNodeConfig)?.mode);
  },
});
