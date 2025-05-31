import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useChatTemplate } from "@/hooks/chatTemplateStore";
import WidgetConfig from "@/pages/chat/components/WidgetConfig";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { estimateTokens } from "@/services/inference-steps/apply-context-limit";
import { useReactFlow } from "@xyflow/react";
import { Bot, MessageCircle, Settings } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { NodeBase, NodeInput, NodeOutput, useNodeRef } from "./NodeBase";
import { NodeConfigProvider, NodeConfigRegistry } from "./NodeConfigRegistry";
import { NodeProps } from "./nodeTypes";

export interface AgentNodeConfig {
  chatTemplateID?: string;
  systemPromptOverride: string;
  inputPrompt: string;
}

// Define outputs - these will be positioned in the response section
const outputs: NodeOutput[] = [
  { id: "response", label: "Message", edgeType: "string" }
];

// Define inputs with precise positioning using targetRef
const inputs: NodeInput[] = [
  { id: "in-input", label: "Input", edgeType: "string", targetRef: "input-section" },
  { id: "in-toolset", label: "Toolset", edgeType: "toolset", targetRef: "tools-section" },
  { id: "in-system-prompt", label: "System Prompt Override", edgeType: "string", targetRef: "system-prompt-section" }
];

/**
 * Configuration provider for Agent nodes
 */
export class AgentNodeConfigProvider implements NodeConfigProvider {
  getDefaultConfig() {
    return {
      label: "Agent",
      config: {
        chatTemplateID: "",
        systemPromptOverride: "",
        inputPrompt: "",
      } as AgentNodeConfig,
    };
  }
}

// Register the configuration provider
NodeConfigRegistry.register("agent", new AgentNodeConfigProvider());

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

export const AgentNodeConfigDialog: React.FC<AgentNodeConfigDialogProps> = ({ 
  open, 
  config, 
  onSave, 
  onCancel 
}) => {
  const [currentConfig, setCurrentConfig] = useState<AgentNodeConfig>(DEFAULT_CONFIG_STATE);

  useEffect(() => {
    if (open) {
      setCurrentConfig(config || DEFAULT_CONFIG_STATE);
    }
  }, [open, config]);

  const handleSave = (runNow = false) => {
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
                  <WidgetConfig
                    currentChatTemplateID={currentConfig.chatTemplateID || null}
                    onChatTemplateChange={(chatTemplateId) => handleFieldChange("chatTemplateID", chatTemplateId)}
                  />
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
          <Button
            type="button"
            onClick={() => handleSave()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors h-8 px-3 py-1"
          >
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
  config: AgentNodeConfig; 
  onConfigClick: () => void; 
}>(({ config, onConfigClick }) => {
  const registerElementRef = useNodeRef();
  const chatTemplate = useChatTemplate(config.chatTemplateID || "");
  
  // Prevent event propagation to React Flow
  const handleConfigButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onConfigClick();
  }, [onConfigClick]);
  
  return (
    <div className="space-y-4 w-full">
      {/* Chat Template Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Chat Template</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConfigButtonClick}
            className="h-6 w-6 p-0 hover:bg-primary/10"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <span className="text-xs text-muted-foreground font-medium">
            {chatTemplate?.name || "No template selected"}
          </span>
        </div>
      </div>

      {/* System Prompt Override Section */}
      <div ref={(el) => registerElementRef?.("system-prompt-section", el)} className="space-y-2">
        <label className="text-xs font-medium">System Prompt Override</label>
        <div className="p-2 bg-muted/50 rounded-md max-h-20 overflow-y-auto">
          <p className="text-xs text-muted-foreground line-clamp-3">
            {config.systemPromptOverride || "Using template default"}
          </p>
        </div>
      </div>

      {/* Tools Section - This aligns with the "tools" input handle */}
      <div 
        ref={(el) => registerElementRef?.("tools-section", el)}
        className="space-y-2"
      >
        <label className="text-xs font-medium">Tools</label>
      </div>

      {/* Input Section - This aligns with the "input" input handle */}
      <div 
        ref={(el) => registerElementRef?.("input-section", el)}
        className="space-y-2"
      >
        <label className="text-xs font-medium">Input</label>
        <div className="p-2 bg-muted/50 rounded-md">
          <span className="text-xs italic text-muted-foreground">
            {config.inputPrompt || "{{input}}"}
          </span>
        </div>
      </div>
    </div>
  );
});

AgentContent.displayName = 'AgentContent';

/**
 * Agent Node Component with precise handle positioning
 */
export const AgentNode = memo(({ data, selected, id }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const config = (data.config as AgentNodeConfig) || {
    chatTemplateID: "",
    systemPromptOverride: "",
    inputPrompt: "",
  };

  const handleConfigSave = useCallback((newConfig: AgentNodeConfig) => {
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

  const handleConfigClick = useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  return (
    <>
      <NodeBase 
        title="Agent" 
        nodeType="agent" 
        data={data} 
        selected={!!selected} 
        outputs={outputs}
        inputs={inputs}
        icon={<Bot className="h-4 w-4" />}
        nodeId={id}
      >
        <AgentContent config={config} onConfigClick={handleConfigClick} />
      </NodeBase>

      <AgentNodeConfigDialog
        open={configDialogOpen}
        config={config}
        onSave={handleConfigSave}
        onCancel={() => setConfigDialogOpen(false)}
      />
    </>
  );
});

AgentNode.displayName = 'AgentNode'; 