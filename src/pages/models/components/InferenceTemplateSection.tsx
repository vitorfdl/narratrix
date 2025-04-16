import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Label } from "@/components/ui/label";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useInferenceTemplate, useInferenceTemplateList, useTemplateActions } from "@/hooks/templateStore";
import { CreateInferenceTemplateParams, InferenceTemplate } from "@/schema/template-inferance-schema";
import { Bot, MessageSquare, Settings, StopCircle, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { TemplatePicker } from "../../formatTemplates/components/TemplatePicker";
// Helper component for labeled input to reduce nesting
interface LabeledInputProps {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const defaultConfig = {
  name: "New Template",
  config: {
    systemPromptFormatting: {
      prefix: "",
      suffix: "",
    },
    userMessageFormatting: {
      prefix: "",
      suffix: "",
    },
    assistantMessageFormatting: {
      prefix: "",
      suffix: "",
      prefill: "",
      prefillOnlyCharacters: false,
    },
    agentMessageFormatting: {
      prefix: "",
      suffix: "",
      useSameAsUser: false,
      useSameAsSystemPrompt: false,
    },
    customStopStrings: ["{{char}}:", "{{user}}:"] as string[],
  },
};

const defaultTemplate: CreateInferenceTemplateParams = {
  ...defaultConfig,
  profile_id: "",
};

export const LabeledInput: React.FC<LabeledInputProps> = ({ label, value, placeholder, disabled, onChange }) => (
  <div>
    <Label>{label}</Label>
    <Input value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  </div>
);

// Helper component for checkbox with label
interface CheckboxWithLabelProps {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const CheckboxWithLabel: React.FC<CheckboxWithLabelProps> = ({ id, label, checked, disabled, onCheckedChange }) => (
  <div className="flex items-center space-x-2">
    <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(checked) => onCheckedChange(checked as boolean)} />
    <Label htmlFor={id} className="font-normal">
      {label}
    </Label>
  </div>
);

interface InstructTemplateSectionProps {
  onChange: (instructTemplateID: string | null) => void;
  modelTemplateID: string | null;
  disabled?: boolean;
}

export function InstructTemplateSection({ disabled, onChange, modelTemplateID }: InstructTemplateSectionProps) {
  const instructTemplateID = modelTemplateID;
  const setInstructTemplateID = (id: string | null) => {
    onChange(id);
  };
  const { updateInferenceTemplate, createInferenceTemplate, deleteInferenceTemplate } = useTemplateActions();
  const templateList = useInferenceTemplateList();
  const currentProfile = useCurrentProfile();

  // Track if we're currently updating to prevent loops
  const isUpdating = useRef(false);

  const currentTemplate = useInferenceTemplate(instructTemplateID ?? "");

  // Use a ref to track the last saved state (full template structure) for comparison
  const lastSavedState = useRef<InferenceTemplate | CreateInferenceTemplateParams | null>(null);

  // Initialize template state with default values, matching the expected structure
  const [templateState, setTemplateState] = useState<CreateInferenceTemplateParams>(defaultTemplate);

  // Debounced update function to avoid too many API calls
  const debouncedUpdate = useDebouncedCallback(async () => {
    if (!instructTemplateID || isUpdating.current) {
      return;
    }

    // Check if config has actually changed before updating
    const currentConfigStr = JSON.stringify(templateState.config);
    const lastSavedConfigStr = JSON.stringify(lastSavedState.current?.config);

    if (currentConfigStr === lastSavedConfigStr) {
      return;
    }

    try {
      isUpdating.current = true;
      // Only send the config part for updates triggered by config changes
      await updateInferenceTemplate(instructTemplateID, { config: templateState.config });
      lastSavedState.current = structuredClone(templateState);
    } catch (error) {
      console.error("Failed to update template:", error);
    } finally {
      isUpdating.current = false;
    }
  }, 100);

  // Use effect to trigger update when config state changes
  useEffect(() => {
    if (instructTemplateID && !isUpdating.current && lastSavedState.current) {
      // Trigger debounce if config changed
      if (JSON.stringify(templateState.config) !== JSON.stringify(lastSavedState.current.config)) {
        debouncedUpdate();
      }
    }
  }, [templateState.config, instructTemplateID, debouncedUpdate]);

  // Update handler for template fields
  const handleUpdate = useCallback((path: string[], value: any) => {
    // Special handling for customStopStrings to prevent empty string entries
    if (path[0] === "customStopStrings") {
      const filteredValues = Array.isArray(value) ? value.filter((str) => str !== "") : value;

      setTemplateState((prevState) => {
        const newState = structuredClone(prevState);
        newState.config.customStopStrings = filteredValues;
        return newState;
      });
      return;
    }

    setTemplateState((prevState) => {
      const newState = structuredClone(prevState);
      let current: any = newState.config;

      // Navigate to the correct property
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }

      // Update the value
      const lastKey = path[path.length - 1];
      current[lastKey] = value;

      return newState;
    });
  }, []);

  // Template management handlers
  const handleDeleteTemplate = useCallback(async () => {
    if (instructTemplateID) {
      onChange(null);
      await deleteInferenceTemplate(instructTemplateID);
    }
  }, [deleteInferenceTemplate, instructTemplateID, onChange]);

  const handleNewTemplate = useCallback(
    async (name: string, sourceTemplateId?: string) => {
      try {
        if (!currentProfile?.id) {
          console.error("No profile selected");
          return;
        }

        let newTemplateData: CreateInferenceTemplateParams;

        if (sourceTemplateId) {
          // Duplicate scenario: Find the source template from the list
          const sourceTemplate = templateList.find((t) => t.id === sourceTemplateId);
          if (!sourceTemplate) {
            console.error(`Source template with ID ${sourceTemplateId} not found for duplication.`);
            return;
          }
          newTemplateData = {
            profile_id: currentProfile.id,
            name: `${sourceTemplate.name} (Copy)`, // Use source name for copy
            config: structuredClone(sourceTemplate.config), // Deep clone config
          };
        } else {
          // New/Default scenario: Use the provided name (or default) and default config
          newTemplateData = {
            ...defaultTemplate, // Start with default config structure
            name: name || "New Template", // Use provided name or fallback
            profile_id: currentProfile.id,
          };
        }

        const response = await createInferenceTemplate(newTemplateData);

        if (response) {
          onChange(response.id); // Select the newly created template
        }
      } catch (error) {
        console.error("Failed to create new template:", error);
      }
    },
    [createInferenceTemplate, currentProfile?.id, onChange, templateList],
  );

  const handleEditName = useCallback(
    async (_unused: string, name: string) => {
      if (!instructTemplateID) {
        return;
      }

      try {
        await updateInferenceTemplate(instructTemplateID, { name: name });
        // Optimistically update local state name and lastSavedState
        setTemplateState((prev) => ({ ...prev, name }));
        if (lastSavedState.current) {
          lastSavedState.current = { ...lastSavedState.current, name };
        }
      } catch (error) {
        console.error("Failed to update template name:", error);
      }
    },
    [updateInferenceTemplate, instructTemplateID],
  );

  const handleImportTemplate = useCallback(() => {
    // To be implemented
    console.log("Import template");
  }, []);

  const handleExportTemplate = useCallback(() => {
    // To be implemented
    console.log("Export template", instructTemplateID);
  }, [instructTemplateID]);

  // Sync local state with the selected template from the store
  useEffect(() => {
    if (currentTemplate && !isUpdating.current) {
      // Create a structure matching the state, including profile_id
      const newState: CreateInferenceTemplateParams = {
        profile_id: currentTemplate.profile_id,
        name: currentTemplate.name,
        config: currentTemplate.config,
      };
      const newStateStr = JSON.stringify(newState);
      // Compare full state to avoid loops if only profile_id changed upstream
      if (newStateStr !== JSON.stringify(templateState)) {
        setTemplateState(newState);
        lastSavedState.current = structuredClone(newState); // Initialize last saved state
      }
    } else if (!currentTemplate && instructTemplateID === null) {
      // Reset only if ID is null
      const defaultStateStr = JSON.stringify(defaultTemplate);
      if (JSON.stringify(templateState) !== defaultStateStr) {
        setTemplateState(defaultTemplate);
        lastSavedState.current = structuredClone(defaultTemplate); // Reset last saved state
      }
    }
  }, [currentTemplate, instructTemplateID]);

  const isDisabled = !instructTemplateID || disabled;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className={`inference-section-header flex items-center gap-1 pb-2 border-b ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
            <Settings className="h-5 w-5" /> Inference Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="bg-foreground/5 p-3 rounded-md text-sm mb-4">
            <p className="text-muted-foreground mb-2">
              Inference templates control how messages are formatted when sent to text completion models. Each section below allows you to customize
              prefixes, suffixes, and other formatting options that will be applied to different message types in the conversation.
            </p>
          </div>

          <TemplatePicker
            templates={templateList}
            selectedTemplateId={instructTemplateID}
            onTemplateSelect={setInstructTemplateID}
            onDelete={handleDeleteTemplate}
            onNewTemplate={handleNewTemplate}
            onEditName={handleEditName}
            onImport={handleImportTemplate}
            onExport={() => {}}
            compact
            disabled={disabled}
          />
          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className={`template-card-title ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
                <Settings className="h-4 w-4" /> System Prompt Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  label="Prefix"
                  value={templateState.config.systemPromptFormatting.prefix}
                  placeholder="<s>[SYSTEM]"
                  disabled={isDisabled}
                  onChange={(val) => handleUpdate(["systemPromptFormatting", "prefix"], val)}
                />
                <LabeledInput
                  label="Suffix"
                  value={templateState.config.systemPromptFormatting.suffix}
                  placeholder="[/SYSTEM]</s>"
                  disabled={isDisabled}
                  onChange={(val) => handleUpdate(["systemPromptFormatting", "suffix"], val)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className={`template-card-title ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
                <MessageSquare className="h-4 w-4" /> User Message Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  label="Prefix"
                  value={templateState.config.userMessageFormatting.prefix}
                  placeholder="<|user|>"
                  disabled={isDisabled}
                  onChange={(val) => handleUpdate(["userMessageFormatting", "prefix"], val)}
                />
                <LabeledInput
                  label="Suffix"
                  value={templateState.config.userMessageFormatting.suffix}
                  placeholder="</|user|>"
                  disabled={isDisabled}
                  onChange={(val) => handleUpdate(["userMessageFormatting", "suffix"], val)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className={`template-card-title ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
                <Bot className="h-4 w-4" /> Assistant Message Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Prefix"
                    value={templateState.config.assistantMessageFormatting.prefix}
                    placeholder="<|assistant|>"
                    disabled={isDisabled}
                    onChange={(val) => handleUpdate(["assistantMessageFormatting", "prefix"], val)}
                  />
                  <LabeledInput
                    label="Suffix"
                    value={templateState.config.assistantMessageFormatting.suffix}
                    placeholder="</|assistant|>"
                    disabled={isDisabled}
                    onChange={(val) => handleUpdate(["assistantMessageFormatting", "suffix"], val)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Assistant Prefill"
                    value={templateState.config.assistantMessageFormatting.prefill}
                    placeholder="I'll help you with that."
                    disabled={isDisabled}
                    onChange={(val) => handleUpdate(["assistantMessageFormatting", "prefill"], val)}
                  />
                  <CheckboxWithLabel
                    id="prefillOnlyCharacters"
                    label="Prefill only on Characters"
                    checked={templateState.config.assistantMessageFormatting.prefillOnlyCharacters}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => handleUpdate(["assistantMessageFormatting", "prefillOnlyCharacters"], checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className={`template-card-title ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
                <Wrench className="h-4 w-4" /> Agent Message Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <CheckboxWithLabel
                    id="useSameAsUser"
                    label="Use same as User"
                    checked={templateState.config.agentMessageFormatting.useSameAsUser}
                    disabled={isDisabled || templateState.config.agentMessageFormatting.useSameAsSystemPrompt}
                    onCheckedChange={(checked) => handleUpdate(["agentMessageFormatting", "useSameAsUser"], checked)}
                  />
                  <CheckboxWithLabel
                    id="useSameAsSystemPrompt"
                    label="Use same as System Prompt"
                    checked={templateState.config.agentMessageFormatting.useSameAsSystemPrompt}
                    disabled={isDisabled || templateState.config.agentMessageFormatting.useSameAsUser}
                    onCheckedChange={(checked) => handleUpdate(["agentMessageFormatting", "useSameAsSystemPrompt"], checked)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Prefix"
                    value={templateState.config.agentMessageFormatting.prefix}
                    placeholder="<|function|>"
                    disabled={
                      isDisabled ||
                      templateState.config.agentMessageFormatting.useSameAsUser ||
                      templateState.config.agentMessageFormatting.useSameAsSystemPrompt
                    }
                    onChange={(val) => handleUpdate(["agentMessageFormatting", "prefix"], val)}
                  />
                  <LabeledInput
                    label="Suffix"
                    value={templateState.config.agentMessageFormatting.suffix}
                    placeholder="</|function|>"
                    disabled={
                      isDisabled ||
                      templateState.config.agentMessageFormatting.useSameAsUser ||
                      templateState.config.agentMessageFormatting.useSameAsSystemPrompt
                    }
                    onChange={(val) => handleUpdate(["agentMessageFormatting", "suffix"], val)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className="template-card-title">
                <StopCircle className="h-4 w-4" /> Custom Stop Strings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CommandTagInput
                value={templateState.config.customStopStrings}
                placeholder="e.g., </s>, [DONE], [END]"
                className={isDisabled ? "opacity-60 pointer-events-none" : ""}
                onChange={(newValues) => handleUpdate(["customStopStrings"], newValues.filter(Boolean))}
              />
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
