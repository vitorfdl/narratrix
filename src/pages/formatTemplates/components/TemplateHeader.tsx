import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useFormatTemplateList, useTemplateActions } from "@/hooks/templateStore";
import { FormatTemplate, NewFormatTemplate, SYSTEM_PROMPT_DEFAULT_CONTENT, TemplateSettings } from "@/schema/template-format-schema";
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
  }, 100);

  const currentProfile = useCurrentProfile();

  // Fetch templates on component mount if not already loaded
  useEffect(() => {
    if (formatTemplates.length === 0) {
      fetchFormatTemplates(currentProfile?.id || "");
    }
  }, [fetchFormatTemplates, formatTemplates.length, currentProfile?.id]);

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
  const handleNewTemplate = async (name: string, sourceTemplateId?: string) => {
    let newTemplateObj: NewFormatTemplate = {
      name: name,
      profile_id: currentProfile?.id || "",
      config: {
        settings: {
          // Default settings for a brand new template
          trim_assistant_incomplete: true,
          trim_double_spaces: true,
          collapse_consecutive_lines: true,
          prefix_messages: "never",
          apply_censorship: false,
          merge_messages_on_user: false,
          merge_subsequent_messages: true,
        },
        reasoning: {
          prefix: "<think>",
          suffix: "</think>",
        },
        context_separator: "\\n\\n",
        lorebook_separator: "\\n---\\n",
      },
      prompts: [
        { type: "context", content: SYSTEM_PROMPT_DEFAULT_CONTENT.context },
        { type: "lorebook-top", content: SYSTEM_PROMPT_DEFAULT_CONTENT["lorebook-top"] },
        { type: "chapter-context", content: SYSTEM_PROMPT_DEFAULT_CONTENT["chapter-context"] },
        { type: "character-context", content: SYSTEM_PROMPT_DEFAULT_CONTENT["character-context"] },
        { type: "user-context", content: SYSTEM_PROMPT_DEFAULT_CONTENT["user-context"] },
        { type: "lorebook-bottom", content: SYSTEM_PROMPT_DEFAULT_CONTENT["lorebook-bottom"] },
      ],
    };

    if (sourceTemplateId) {
      // Find the template to duplicate using the provided sourceTemplateId
      const templateToDuplicate = formatTemplates.find((t) => t.id === sourceTemplateId);

      if (templateToDuplicate) {
        // Create the new template object based on the found template
        newTemplateObj = {
          name: `${templateToDuplicate.name} (Copy)`, // Use the duplicated template's name
          profile_id: templateToDuplicate.profile_id,
          config: templateToDuplicate.config, // Deep copy config
          prompts: templateToDuplicate.prompts, // Deep copy prompts
        };
        // Note: Ensure config and prompts are deep copied if they contain nested objects/arrays
        // For simplicity here, we assume a shallow copy is sufficient or that the structure allows it.
        // If deep cloning is needed, libraries like lodash.cloneDeep or structuredClone might be necessary.
      } else {
        console.error("Template to duplicate not found:", sourceTemplateId);
        // Handle error - maybe show a notification to the user
        return; // Exit if the source template isn't found
      }
    }

    const newTemplate = await createFormatTemplate(newTemplateObj);

    onTemplateChange(newTemplate.id); // Switch to the newly created/duplicated template
  };

  // Handlers for editing name, importing, and exporting
  const handleEditName = async (templateId: string, name: string) => {
    if (!currentTemplate) {
      return;
    }
    await updateFormatTemplate(templateId, { name: name });
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
        onEditName={handleEditName}
        onImport={handleImport}
        onExport={handleExport}
      />
    ),
    [formatTemplateID, formatTemplates, handleTemplateSelect, handleDeleteTemplate, handleNewTemplate, handleEditName, handleImport, handleExport],
  );

  return (
    <div className="space-y-4 bg-card p-4 rounded-md border border-border w-full max-w-[1200px] justify-self-center @container mx-auto">
      <div className="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-5 ">
        {/* Picker always on its own row */}
        <div className="col-span-full w-full">{templatePickerMemo}</div>

        {/* Text Cleanup - always starts a new row */}
        <div className="space-y-2">
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
            <Label htmlFor="trimAssistant">Trim Incomplete Sequences</Label>
            <HelpTooltip>
              <p>
                Removes any text following the last sentence-ending punctuation (e.g., '.', '?', '!') or emoji. Helps clean up responses that trail
                off mid-sentence.
                <br />
                <br />
                <strong>Example:</strong> <i>"The story ends here. And th"</i> becomes <i>"The story ends here."</i>
              </p>
            </HelpTooltip>
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
            <Label htmlFor="trimSpaces">Trim Double Spaces</Label>
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

        {/* Message Formatting */}
        <div className="space-y-2">
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
            <div className="flex items-center space-x-1">
              <Label htmlFor="mergeMessages">Squash all messages on User</Label>
              <HelpTooltip>
                <p>
                  Squash the entire chat history into a single user message before sending to model.
                  <br />
                  <br />
                  System Prompts are not included in the squashed message.
                </p>
              </HelpTooltip>
            </div>
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
            <div className="flex items-center space-x-1">
              <Label htmlFor="applyCensorship">Apply censorship to messages</Label>
              <HelpTooltip>
                <p>Setup words to be censored with asterisks in your Profile Settings.</p>
              </HelpTooltip>
            </div>
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
            <div className="flex items-center space-x-1">
              <Label htmlFor="mergeSubsequent">Squash subsequent Message</Label>
              <HelpTooltip>
                <p>Squash all messages from the same role into a single message before sending to model.</p>
                <br />
                <img src="/docs/merge_messages.png" alt="Merge subsequent messages example" className="max-w-xs block mx-auto" />
              </HelpTooltip>
            </div>
          </div>
        </div>

        {/* Prefix Messages */}
        <div className="space-y-2 2xl:col-span-1 2xl:justify-self-end">
          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground">Prefix Messages with Character Names</Label>
            <RadioGroup
              value={memoizedSettings.prefix_messages}
              onValueChange={useCallback(
                (value: string) => handleSettingChange("prefix_messages", value as "never" | "always" | "characters"),
                [handleSettingChange],
              )}
              className="flex flex-col space-y-0"
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
                <Label htmlFor="characters">2+ Characters</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
