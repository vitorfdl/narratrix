import { useReactFlow, useStore } from "@xyflow/react";
import { Bot, MessageCircle, Settings } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useChatStore } from "@/hooks/chatStore";
import { useChatTemplate, useChatTemplateStore } from "@/hooks/chatTemplateStore";
import WidgetConfig from "@/pages/chat/components/WidgetConfig";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { estimateTokens } from "@/services/inference/formatter/apply-context-limit";
import { NodeBase, NodeInput, NodeOutput, useNodeRef } from "../tool-components/NodeBase";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

export interface AgentNodeConfig {
  chatTemplateID?: string;
  systemPromptOverride: string;
  inputPrompt: string;
}

/**
 * Node Execution
 */
export const executeAgentNode: NodeExecutor = async (node, inputs, _ctx, _agent, deps): Promise<NodeExecutionResult> => {
  const cfg = (node.config as AgentNodeConfig) || {};

  let inputPrompt: string = (cfg.inputPrompt as string) || "{{input}}";
  if (typeof inputs.input === "string") {
    inputPrompt = inputPrompt.replace("{{input}}", inputs.input);
  }

  const chatTemplateId: string | undefined = cfg.chatTemplateID;
  const systemPrompt: string | undefined = inputs.systemPrompt || cfg.systemPromptOverride || "";
  // Toolset input reserved for future use

  // Hard fail when required dependencies are unavailable
  if (!deps || !deps.runInference || !deps.formatPrompt || !deps.getModelById || !deps.getManifestById || !deps.removeNestedFields) {
    return { success: false, error: "Agent node missing workflow dependencies" };
  }

  // If no chat template configured, treat as configuration error to stop the workflow
  if (!chatTemplateId) {
    return { success: false, error: "Agent node is missing chat template configuration" };
  }

  try {
    const chatTemplate = await deps.getChatTemplateById(chatTemplateId);
    if (!chatTemplate) {
      return { success: false, error: `Chat template not found: ${chatTemplateId}` };
    }

    const model = chatTemplate?.model_id ? await deps.getModelById(chatTemplate.model_id) : null;
    if (!model) {
      return { success: false, error: `Model not found for chat template ${chatTemplateId}` };
    }

    const manifest = deps.getManifestById(model.manifest_id);
    if (!manifest) {
      return { success: false, error: `Manifest not found for model ${model.id}` };
    }

    const inferenceTemplate = model.inference_template_id ? await deps.getInferenceTemplateById(model.inference_template_id).catch(() => null) : null;
    const formatTemplate = chatTemplate.format_template_id ? await deps.getFormatTemplateById(chatTemplate.format_template_id).catch(() => null) : null;

    const promptResult = await deps.formatPrompt({
      messageHistory: Array.isArray(inputs.history) ? inputs.history : [],
      userPrompt: inputPrompt,
      modelSettings: model,
      inferenceTemplate: inferenceTemplate || undefined,
      formatTemplate,
      chatTemplate,
      systemOverridePrompt: systemPrompt,
      chatConfig: {
        character: inputs.characterId && inputs.characterId !== "user" ? ({ id: inputs.characterId } as any) : undefined,
        user_character: inputs.characterId === "user" ? ({ name: "You", custom: { personality: "" } } as any) : undefined,
      },
    });

    const { inferenceMessages, systemPrompt: formattedSystemPrompt, customStopStrings } = promptResult;
    const paramsBase = deps.removeNestedFields(chatTemplate?.config || {});
    const fixedParameters = deps.removeNestedFields({ ...(paramsBase || {}), ...((cfg as any).parameters || {}), ...(inputs.parameters || {}) });
    if (customStopStrings) {
      (fixedParameters as any).stop = (fixedParameters as any).stop ? [...(fixedParameters as any).stop, ...customStopStrings] : customStopStrings;
    }

    const modelSpecs = {
      id: model.id as string,
      model_type: model.inference_template_id ? ("completion" as const) : ("chat" as const),
      config: model.config,
      max_concurrent_requests: model.max_concurrency || 1,
      engine: manifest.engine as string,
    };

    const result = await deps.runInference({ messages: inferenceMessages, modelSpecs, systemPrompt: formattedSystemPrompt, parameters: fixedParameters, stream: false });
    if (typeof result === "string" && result.length > 0) {
      return { success: true, value: result };
    }

    return { success: false, error: "Agent inference returned no result" };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Agent background inference failed";
    return { success: false, error: message };
  }
};

/**
 * UI and Node Configuration
 */
const AGENT_NODE_METADATA = {
  type: "agent",
  label: "LLM Agent",
  description: "AI agent with customizable prompts and tools",
  icon: Bot,
  category: "Inference",
  theme: createNodeTheme("purple"),
  deletable: true,
  inputs: [
    { id: "in-input", label: "Input", edgeType: "string" as const, targetRef: "input-section" },
    { id: "in-toolset", label: "Toolset", edgeType: "toolset" as const, targetRef: "tools-section", allowMultipleConnections: true },
    { id: "in-history", label: "History", edgeType: "message-list" as const, targetRef: "history-section" },
    { id: "in-system-prompt", label: "System Prompt Override", edgeType: "string" as const, targetRef: "system-prompt-section" },
    { id: "in-character", label: "Participant ID", edgeType: "string" as const, targetRef: "participant-section" },
  ] as NodeInput[],
  outputs: [{ id: "response", label: "Message", edgeType: "string" as const }] as NodeOutput[],
  defaultConfig: {
    chatTemplateID: "",
    systemPromptOverride: "",
    inputPrompt: "",
  } as AgentNodeConfig,
};

// Configuration provider namespace
export namespace AgentNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: AGENT_NODE_METADATA.label,
      config: AGENT_NODE_METADATA.defaultConfig,
    };
  }
}

export interface AgentNodeConfigDialogProps {
  open: boolean;
  config: AgentNodeConfig;
  onSave: (config: AgentNodeConfig) => void;
  onCancel: () => void;
}

const DEFAULT_CONFIG_STATE: AgentNodeConfig = {
  chatTemplateID: "",
  systemPromptOverride: "",
  inputPrompt: "",
};

export const AgentNodeConfigDialog: React.FC<AgentNodeConfigDialogProps> = ({ open, config, onSave, onCancel }) => {
  const [currentConfig, setCurrentConfig] = useState<AgentNodeConfig>(DEFAULT_CONFIG_STATE);

  useEffect(() => {
    if (open) {
      setCurrentConfig(config || DEFAULT_CONFIG_STATE);
    }
  }, [open, config]);

  const handleSave = (_runNow = false) => {
    onSave(currentConfig);
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleFieldChange = (field: keyof AgentNodeConfig, value: string) => {
    setCurrentConfig((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent size="window">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1 text-lg">
            <Bot className="h-4 w-4 text-primary" />
            Agent Configuration
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="systemPromptOverride" className="text-sm font-medium flex items-center gap-1">
                      <Settings className="h-3 w-3" /> System Prompt Override
                    </Label>
                    <span className="text-xs text-muted-foreground">{estimateTokens(currentConfig.systemPromptOverride, 0) || 0} tokens</span>
                  </div>
                  <MarkdownTextArea
                    initialValue={currentConfig.systemPromptOverride}
                    editable={true}
                    suggestions={promptReplacementSuggestionList}
                    onChange={(value) => handleFieldChange("systemPromptOverride", value)}
                    placeholder="Leave empty to use the default system prompt from the selected template"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">Override the system instructions for this agent instance</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="inputPrompt" className="text-sm font-medium flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> Input Prompt Template
                    </Label>
                    <span className="text-xs text-muted-foreground">{estimateTokens(currentConfig.inputPrompt, 0) || 0} tokens</span>
                  </div>
                  <MarkdownTextArea
                    initialValue={currentConfig.inputPrompt}
                    editable={true}
                    suggestions={promptReplacementSuggestionList}
                    onChange={(value) => handleFieldChange("inputPrompt", value)}
                    placeholder="{{input}}"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">Template for processing input data. Use {"{{input}}"} to reference the input value.</p>
                </div>
              </div>

              <div className="space-y-1 row-span-2 overflow-y-auto">
                <Label htmlFor="templateId" className="text-sm font-medium">
                  Chat Template
                </Label>
                <div className="border border-input rounded-md">
                  <WidgetConfig currentChatTemplateID={currentConfig.chatTemplateID || null} onChatTemplateChange={(chatTemplateId) => handleFieldChange("chatTemplateID", chatTemplateId)} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Select the chat template that defines the model and inference settings for this agent</p>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} className="border-input hover:bg-secondary transition-colors h-8 px-3 py-1">
            Cancel
          </Button>
          <Button type="button" onClick={() => handleSave()} className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors h-8 px-3 py-1">
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Memoized content component to prevent unnecessary re-renders
 */
const AgentContent = memo<{
  nodeId: string;
  config: AgentNodeConfig;
  onConfigClick: () => void;
}>(({ nodeId, config, onConfigClick }) => {
  const registerElementRef = useNodeRef();
  const chatTemplate = useChatTemplate(config.chatTemplateID || "");

  // Subscribe to edges from React Flow store to get real-time updates
  const edges = useStore((state) => state.edges);

  // Count connected tool edges
  const connectedToolsCount = useMemo(() => {
    return edges.filter((edge) => edge.target === nodeId && edge.targetHandle === "in-toolset").length;
  }, [edges, nodeId]);

  // Prevent event propagation to React Flow
  const handleConfigButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onConfigClick();
    },
    [onConfigClick],
  );

  return (
    <div className="space-y-4 w-full">
      {/* Chat Template Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Chat Template</label>
          <Button variant="ghost" size="sm" onClick={handleConfigButtonClick} className="h-6 w-6 p-0 hover:bg-primary/10">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <span className="text-xs text-muted-foreground font-medium">{chatTemplate?.name || "No template selected"}</span>
        </div>
      </div>

      {/* System Prompt Override Section */}
      <div ref={(el) => registerElementRef?.("system-prompt-section", el)} className="space-y-2">
        <label className="text-xs font-medium">System Prompt Override</label>
        <div className="p-2 bg-muted/50 rounded-md max-h-20 overflow-y-auto border-l-2 border-purple-400 dark:border-purple-500">
          <p className="text-xs text-muted-foreground line-clamp-3">{config.systemPromptOverride || "Using template default"}</p>
        </div>
      </div>

      {/* Tools Section - This aligns with the "tools" input handle */}
      <div ref={(el) => registerElementRef?.("tools-section", el)} className="space-y-2">
        <label className="text-xs font-medium">Toolset{connectedToolsCount > 0 && ` (${connectedToolsCount})`}</label>
      </div>

      {/* Participant Section - This aligns with the "in-character" input handle */}
      <div ref={(el) => registerElementRef?.("participant-section", el)} className="space-y-2">
        <label className="text-xs font-medium">Participant/Character (optional)</label>
      </div>

      {/* History Section - This aligns with the "history" input handle */}
      <div ref={(el) => registerElementRef?.("history-section", el)} className="space-y-2">
        <label className="text-xs font-medium">Chat History</label>
      </div>

      {/* Input Section - This aligns with the "input" input handle */}
      <div ref={(el) => registerElementRef?.("input-section", el)} className="space-y-2">
        <label className="text-xs font-medium">User Prompt</label>
        <div className="p-2 bg-muted/50 rounded-md border-l-2 border-purple-400 dark:border-purple-500">
          <span className="text-xs italic text-muted-foreground line-clamp-3">{config.inputPrompt || "{{input}}"}</span>
        </div>
      </div>
    </div>
  );
});

AgentContent.displayName = "AgentContent";

/**
 * Agent Node Component
 */
export const AgentNode = memo(({ data, selected, id }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const config = (data.config as AgentNodeConfig) || AGENT_NODE_METADATA.defaultConfig;

  const handleConfigSave = useCallback(
    (newConfig: AgentNodeConfig) => {
      // Use React Flow's setNodes to properly update the node
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes],
  );

  const handleConfigClick = useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <AgentContent nodeId={id} config={config} onConfigClick={handleConfigClick} />
      </NodeBase>

      <AgentNodeConfigDialog open={configDialogOpen} config={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

AgentNode.displayName = "AgentNode";

// Register the node
NodeRegistry.register({
  metadata: AGENT_NODE_METADATA,
  component: AgentNode,
  configProvider: AgentNodeConfigProvider,
  executor: executeAgentNode,
});
