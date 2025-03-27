import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProfile } from "@/hooks/ProfileContext";
import { useFormatTemplateList, useTemplateActions } from "@/hooks/templateStore";
import { FormatTemplate, TemplateSettings } from "@/schema/template-format-schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { TemplatePicker } from "./TemplatePicker";

interface TemplateHeaderProps {
  formatTemplateID: string | null;
  // Tell the parent that the template has changed
  onTemplateChange: (templateId: string) => void;
}

export function TemplateHeader({ formatTemplateID, onTemplateChange }: TemplateHeaderProps) {
  // Use atomic selectors for each piece of state/action
  const formatTemplates = useFormatTemplateList();
  const { updateFormatTemplate, deleteFormatTemplate, createFormatTemplate, fetchFormatTemplates } = useTemplateActions();

  const [currentTemplate, setCurrentTemplate] = useState<FormatTemplate | null>(null);
  const [localSettings, setLocalSettings] = useState<TemplateSettings | null>(null);

  // Memoize settings to prevent unnecessary re-renders
  const memoizedSettings = useMemo(
    () =>
      localSettings || {
        trim_assistant_incomplete: false,
        trim_double_spaces: true,
        collapse_consecutive_lines: true,
        completion_type: "chat" as const,
        prefix_messages: "never" as const,
        apply_censorship: false,
        merge_messages_on_user: false,
        merge_subsequent_messages: true,
      },
    [localSettings],
  );

  // Memoize finding the current template for better performance
  const selectedTemplate = useMemo(() => {
    if (!formatTemplateID || formatTemplates.length === 0) {
      return null;
    }
    return formatTemplates.find((t) => t.id === formatTemplateID) || null;
  }, [formatTemplateID, formatTemplates]);

  // Instead of using useDebounce hook for values, use useDebouncedCallback for the update function
  const debouncedUpdate = useDebouncedCallback(async (template: FormatTemplate, settings: TemplateSettings) => {
    await updateFormatTemplate(template.id, {
      config: {
        ...template.config,
        settings,
      },
    });
  }, 500);

  const profile = useProfile();

  // Fetch templates on component mount if not already loaded
  useEffect(() => {
    if (formatTemplates.length === 0) {
      fetchFormatTemplates();
    }
  }, [fetchFormatTemplates, formatTemplates.length]);

  // Update current template when selectedTemplate changes
  useEffect(() => {
    setCurrentTemplate(selectedTemplate);
    if (selectedTemplate?.config.settings) {
      setLocalSettings(selectedTemplate.config.settings);
    } else {
      setLocalSettings(null);
    }
  }, [selectedTemplate]);

  // Handler for updating template settings
  const handleSettingChange = useCallback(
    <K extends keyof TemplateSettings>(key: K, value: TemplateSettings[K]) => {
      if (!currentTemplate || !localSettings) {
        return;
      }

      // Update local state immediately for responsive UI
      const updatedSettings = {
        ...localSettings,
        [key]: value,
      };

      setLocalSettings(updatedSettings);

      // Debounce the API call to update the template
      debouncedUpdate(currentTemplate, updatedSettings);
    },
    [currentTemplate, localSettings, debouncedUpdate],
  );

  // Handler for template selection
  const handleTemplateSelect = (templateId: string) => {
    if (templateId !== formatTemplateID) {
      onTemplateChange(templateId);
    }
  };

  // Handler for template deletion
  const handleDeleteTemplate = async (templateId: string) => {
    await deleteFormatTemplate(templateId);
    if (formatTemplateID === templateId) {
      // If the deleted template was the current one, select another one or null
      const nextTemplate = formatTemplates.find((t) => t.id !== templateId);
      onTemplateChange(nextTemplate?.id || "");
    }
  };

  // Handler for creating a new template
  const handleNewTemplate = async () => {
    const newTemplate = await createFormatTemplate({
      name: "New Format Template",
      profile_id: profile?.currentProfile?.id || "",
      inference_template_id: null,
      prompt_template_id: null,
      config: {
        settings: {
          trim_assistant_incomplete: false,
          trim_double_spaces: true,
          collapse_consecutive_lines: true,
          completion_type: "chat",
          prefix_messages: "never",
          apply_censorship: false,
          merge_messages_on_user: false,
          merge_subsequent_messages: true,
        },
        reasoning: {
          prefix: "",
          suffix: "",
        },
        use_global_context: false,
      },
    });

    onTemplateChange(newTemplate.id);
  };

  // Handlers for editing name, importing, and exporting
  const handleEditName = async (templateId: string, newName: string) => {
    if (!currentTemplate) {
      return;
    }
    await updateFormatTemplate(templateId, { name: newName });
  };

  const handleImport = () => {
    // To be implemented
    console.log("Import template");
  };

  const handleExport = (templateId: string) => {
    // To be implemented
    console.log("Export template", templateId);
  };

  // Memoize complex components to prevent re-rendering
  const templatePickerMemo = useMemo(
    () => (
      <TemplatePicker
        templates={formatTemplates}
        selectedTemplateId={formatTemplateID}
        onTemplateSelect={handleTemplateSelect}
        onDelete={() => formatTemplateID && handleDeleteTemplate(formatTemplateID)}
        onNewTemplate={handleNewTemplate}
        onEditName={() => formatTemplateID && handleEditName(formatTemplateID, "Renamed Template")}
        onImport={handleImport}
        onExport={() => formatTemplateID && handleExport(formatTemplateID)}
      />
    ),
    [formatTemplateID, formatTemplates],
  );

  return (
    <div className="space-y-4 bg-card p-4 rounded-sm border">
      {templatePickerMemo}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 ">
        {/* Left Column - Checkboxes */}
        <div className="space-y-2 md:justify-self-start">
          <h3 className="text-sm font-medium text-muted-foreground">Text Cleanup</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="trimAssistant"
              checked={memoizedSettings.trim_assistant_incomplete}
              onCheckedChange={useCallback(
                (checked: boolean | "indeterminate") => handleSettingChange("trim_assistant_incomplete", checked as boolean),
                [handleSettingChange],
              )}
              disabled={!currentTemplate}
            />
            <Label htmlFor="trimAssistant">Trim Assistant Incomplete Sequences</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="trimSpaces"
              checked={memoizedSettings.trim_double_spaces}
              onCheckedChange={useCallback(
                (checked: boolean | "indeterminate") => handleSettingChange("trim_double_spaces", checked as boolean),
                [handleSettingChange],
              )}
              disabled={!currentTemplate}
            />
            <Label htmlFor="trimSpaces">Trim Double+ Spaces</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="collapseLines"
              checked={memoizedSettings.collapse_consecutive_lines}
              onCheckedChange={useCallback(
                (checked: boolean | "indeterminate") => handleSettingChange("collapse_consecutive_lines", checked as boolean),
                [handleSettingChange],
              )}
              disabled={!currentTemplate}
            />
            <Label htmlFor="collapseLines">Collapse Consecutive Lines</Label>
          </div>
        </div>

        {/* Middle Column - Template Type and Prefix Messages */}
        <div className="space-y-4 md:justify-self-center">
          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground">Template Type</Label>
            <RadioGroup
              value={memoizedSettings.completion_type}
              onValueChange={useCallback(
                (value: string) => handleSettingChange("completion_type", value as "chat" | "text" | "both"),
                [handleSettingChange],
              )}
              className="flex space-x-4"
              disabled={!currentTemplate}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="chat" id="chat" />
                <Label htmlFor="chat">Chat Completion</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="text" id="text" />
                <Label htmlFor="text">Text Completion</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="both" />
                <Label htmlFor="both">Both</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground">Prefix Messages with Character Names</Label>
            <RadioGroup
              value={memoizedSettings.prefix_messages}
              onValueChange={useCallback(
                (value: string) => handleSettingChange("prefix_messages", value as "never" | "always" | "characters"),
                [handleSettingChange],
              )}
              className="flex space-x-4"
              disabled={!currentTemplate}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="never" id="never" />
                <Label htmlFor="never">Never</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="always" id="always" />
                <Label htmlFor="always">Always</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="characters" id="characters" />
                <Label htmlFor="characters">Only 2+ Characters</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Right Column - Additional Checkboxes */}
        <div className="space-y-2 md:justify-self-end">
          <h3 className="text-sm font-medium text-muted-foreground">Message Formatting</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mergeMessages"
              checked={memoizedSettings.merge_messages_on_user}
              onCheckedChange={useCallback(
                (checked: boolean | "indeterminate") => handleSettingChange("merge_messages_on_user", checked as boolean),
                [handleSettingChange],
              )}
              disabled={!currentTemplate}
            />
            <Label htmlFor="mergeMessages">Merge all messages on User</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="applyCensorship"
              checked={memoizedSettings.apply_censorship}
              onCheckedChange={useCallback(
                (checked: boolean | "indeterminate") => handleSettingChange("apply_censorship", checked as boolean),
                [handleSettingChange],
              )}
              disabled={!currentTemplate}
            />
            <Label htmlFor="applyCensorship">Apply censorship to messages</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mergeSubsequent"
              checked={memoizedSettings.merge_subsequent_messages}
              onCheckedChange={useCallback(
                (checked: boolean | "indeterminate") => handleSettingChange("merge_subsequent_messages", checked as boolean),
                [handleSettingChange],
              )}
              disabled={!currentTemplate}
            />
            <Label htmlFor="mergeSubsequent">Merge subsquent Messages</Label>
          </div>
        </div>
      </div>
    </div>
  );
}
