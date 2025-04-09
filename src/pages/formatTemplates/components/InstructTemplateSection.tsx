import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StringArray } from "@/components/ui/string-array";
import { useProfile } from "@/hooks/ProfileContext";
import { useInferenceTemplate, useInferenceTemplateList, useTemplateActions } from "@/hooks/templateStore";
import { Bot, MessageSquare, Settings, StopCircle, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { TemplatePicker } from "./TemplatePicker";

// Helper component for labeled input to reduce nesting
interface LabeledInputProps {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

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

export function InstructTemplateSection() {
  const [instructTemplateID, setInstructTemplateID] = useState<string | null>(null);
  const { updateInferenceTemplate, createInferenceTemplate, deleteInferenceTemplate } = useTemplateActions();
  const currentTemplate = useInferenceTemplate(instructTemplateID ?? "");
  const templateList = useInferenceTemplateList();
  // const error = useTemplateError();
  const profile = useProfile();

  // Track if we're currently updating to prevent loops
  const isUpdating = useRef(false);

  // Use a ref to track the last saved state for comparison
  const lastSavedState = useRef<any>(null);

  // Define default template state
  const defaultTemplateState = useMemo(
    () => ({
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
      customStopStrings: [] as string[],
    }),
    [],
  );

  // Initialize template state with default values
  const [templateState, setTemplateState] = useState(defaultTemplateState);

  // Update local state when selected template changes
  useEffect(() => {
    if (currentTemplate) {
      setTemplateState(currentTemplate.config);
      lastSavedState.current = JSON.stringify(currentTemplate.config);
    } else {
      setTemplateState(defaultTemplateState);
      lastSavedState.current = JSON.stringify(defaultTemplateState);
    }
  }, [currentTemplate, defaultTemplateState]);

  // Debounced update function to avoid too many API calls
  const debouncedUpdate = useDebouncedCallback(async () => {
    if (!instructTemplateID || isUpdating.current) {
      return;
    }

    // Check if state has actually changed before updating
    const currentStateStr = JSON.stringify(templateState);
    if (currentStateStr === lastSavedState.current) {
      return;
    }

    try {
      isUpdating.current = true;
      await updateInferenceTemplate(instructTemplateID, { config: templateState });
      lastSavedState.current = currentStateStr;
    } catch (error) {
      console.error("Failed to update template:", error);
    } finally {
      isUpdating.current = false;
    }
  }, 500);

  // Use effect to trigger update when state changes
  useEffect(() => {
    if (instructTemplateID && !isUpdating.current) {
      debouncedUpdate();
    }
  }, [templateState, instructTemplateID, debouncedUpdate]);

  // Update handler for template fields
  const handleUpdate = useCallback((path: string[], value: any) => {
    // Special handling for customStopStrings to prevent empty string entries
    if (path[0] === "customStopStrings") {
      // Filter out empty strings to prevent infinite loops
      const filteredValues = Array.isArray(value) ? value.filter((str) => str !== "") : value;

      setTemplateState((prevState) => {
        const newState = structuredClone(prevState);
        newState.customStopStrings = filteredValues;
        return newState;
      });
      return;
    }

    setTemplateState((prevState) => {
      // Create a new state with the updated value
      const newState = structuredClone(prevState);
      let current: any = newState;

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
      setInstructTemplateID(null);
      await deleteInferenceTemplate(instructTemplateID);
    }
  }, [deleteInferenceTemplate, instructTemplateID]);

  const handleNewTemplate = useCallback(
    async (name: string) => {
      try {
        if (!profile?.currentProfile?.id) {
          console.error("No profile selected");
          return;
        }

        const newTemplate = await createInferenceTemplate({
          name: name,
          config: defaultTemplateState,
          profile_id: profile.currentProfile.id,
        });

        if (newTemplate) {
          setInstructTemplateID(newTemplate.id);
        }
      } catch (error) {
        console.error("Failed to create new template:", error);
      }
    },
    [createInferenceTemplate, profile?.currentProfile?.id, defaultTemplateState],
  );

  const handleEditName = useCallback(
    async (_unused: string, name: string) => {
      if (!instructTemplateID) {
        return;
      }

      try {
        await updateInferenceTemplate(instructTemplateID, { name: name });
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

  const isDisabled = !instructTemplateID;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="inference-section-header flex items-center gap-1 pb-2 border-b">
            <Settings className="h-5 w-5" /> Inference Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TemplatePicker
            disabled
            templates={templateList}
            selectedTemplateId={instructTemplateID}
            onTemplateSelect={setInstructTemplateID}
            onDelete={handleDeleteTemplate}
            onNewTemplate={handleNewTemplate}
            onEditName={handleEditName}
            onImport={handleImportTemplate}
            onExport={handleExportTemplate}
          />

          <div className="bg-foreground/5 p-3 rounded-md text-sm mb-4">
            <h3 className="font-medium mb-1">About Inference Templates</h3>
            <p className="text-muted-foreground mb-2">
              Inference templates control how messages are formatted when sent to text completion models. Each section below allows you to customize
              prefixes, suffixes, and other formatting options that will be applied to different message types in the conversation.
            </p>
            <p className="text-muted-foreground">
              These settings are required for models using the Text Completion method, as they need specific formatting patterns to distinguish
              between different roles in the conversation.
            </p>
          </div>

          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className="template-card-title">
                <Settings className="h-4 w-4" /> System Prompt Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  label="Prefix"
                  value={templateState.systemPromptFormatting.prefix}
                  placeholder="<s>[SYSTEM]"
                  disabled={isDisabled}
                  onChange={(val) => handleUpdate(["systemPromptFormatting", "prefix"], val)}
                />
                <LabeledInput
                  label="Suffix"
                  value={templateState.systemPromptFormatting.suffix}
                  placeholder="[/SYSTEM]</s>"
                  disabled={isDisabled}
                  onChange={(val) => handleUpdate(["systemPromptFormatting", "suffix"], val)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className="template-card-title">
                <MessageSquare className="h-4 w-4" /> User Message Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  label="Prefix"
                  value={templateState.userMessageFormatting.prefix}
                  placeholder="<|user|>"
                  disabled={isDisabled}
                  onChange={(val) => handleUpdate(["userMessageFormatting", "prefix"], val)}
                />
                <LabeledInput
                  label="Suffix"
                  value={templateState.userMessageFormatting.suffix}
                  placeholder="</|user|>"
                  disabled={isDisabled}
                  onChange={(val) => handleUpdate(["userMessageFormatting", "suffix"], val)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className="template-card-title">
                <Bot className="h-4 w-4" /> Assistant Message Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Prefix"
                    value={templateState.assistantMessageFormatting.prefix}
                    placeholder="<|assistant|>"
                    disabled={isDisabled}
                    onChange={(val) => handleUpdate(["assistantMessageFormatting", "prefix"], val)}
                  />
                  <LabeledInput
                    label="Suffix"
                    value={templateState.assistantMessageFormatting.suffix}
                    placeholder="</|assistant|>"
                    disabled={isDisabled}
                    onChange={(val) => handleUpdate(["assistantMessageFormatting", "suffix"], val)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Assistant Prefill"
                    value={templateState.assistantMessageFormatting.prefill}
                    placeholder="I'll help you with that."
                    disabled={isDisabled}
                    onChange={(val) => handleUpdate(["assistantMessageFormatting", "prefill"], val)}
                  />
                  <CheckboxWithLabel
                    id="prefillOnlyCharacters"
                    label="Prefill only on Characters"
                    checked={templateState.assistantMessageFormatting.prefillOnlyCharacters}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => handleUpdate(["assistantMessageFormatting", "prefillOnlyCharacters"], checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className="template-card-title">
                <Wrench className="h-4 w-4" /> Agent Message Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <CheckboxWithLabel
                    id="useSameAsUser"
                    label="Use same as User"
                    checked={templateState.agentMessageFormatting.useSameAsUser}
                    disabled={isDisabled || templateState.agentMessageFormatting.useSameAsSystemPrompt}
                    onCheckedChange={(checked) => handleUpdate(["agentMessageFormatting", "useSameAsUser"], checked)}
                  />
                  <CheckboxWithLabel
                    id="useSameAsSystemPrompt"
                    label="Use same as System Prompt"
                    checked={templateState.agentMessageFormatting.useSameAsSystemPrompt}
                    disabled={isDisabled || templateState.agentMessageFormatting.useSameAsUser}
                    onCheckedChange={(checked) => handleUpdate(["agentMessageFormatting", "useSameAsSystemPrompt"], checked)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Prefix"
                    value={templateState.agentMessageFormatting.prefix}
                    placeholder="<|function|>"
                    disabled={
                      isDisabled || templateState.agentMessageFormatting.useSameAsUser || templateState.agentMessageFormatting.useSameAsSystemPrompt
                    }
                    onChange={(val) => handleUpdate(["agentMessageFormatting", "prefix"], val)}
                  />
                  <LabeledInput
                    label="Suffix"
                    value={templateState.agentMessageFormatting.suffix}
                    placeholder="</|function|>"
                    disabled={
                      isDisabled || templateState.agentMessageFormatting.useSameAsUser || templateState.agentMessageFormatting.useSameAsSystemPrompt
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
              <StringArray
                values={templateState.customStopStrings}
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
