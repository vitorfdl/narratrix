import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { StepButton } from "@/components/ui/step-button";
import { TemplatePicker } from "@/pages/formatTemplates/components/TemplatePicker";
import type { SectionField } from "@/schema/template-chat-settings-types";
import { Layers, Layers2, PaperclipIcon, PlusIcon, ServerIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useProfile } from "@/hooks/ProfileContext";
import { useChatStore, useCurrentChatTemplateID } from "@/hooks/chatStore";
import { useChatTemplate, useChatTemplateActions, useChatTemplateList } from "@/hooks/chatTemplateStore";
import { useModelManifestById } from "@/hooks/manifestStore";
import { useModels, useModelsActions } from "@/hooks/modelsStore";
import { useFormatTemplateList } from "@/hooks/templateStore";
import { Model } from "@/schema/models-schema";
import { ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { configFields } from "../manifests/configFields";
import { ConfigItem } from "./ConfigItems";
import { CustomPromptModal } from "./CustomPromptModal";
import { CustomPromptsList } from "./CustomPromptsList";

/**
 * WidgetConfig component
 *
 * This component is used to configure the widget settings.
 * It allows you to add custom prompts, inference settings, and other configuration options.
 *
 */
const WidgetConfig = () => {
  const currentChatTemplateID = useCurrentChatTemplateID();
  const chatTemplateList = useChatTemplateList();
  const currentTemplate = useChatTemplate(currentChatTemplateID || "");
  const { updateChatTemplate } = useChatTemplateActions();
  const models = useModels();
  const { fetchModels } = useModelsActions();
  const formatTemplates = useFormatTemplateList();

  const profile = useProfile();
  const profileId = profile!.currentProfile!.id;

  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [, setSelectedField] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedFormatTemplateId, setSelectedFormatTemplateId] = useState<string>("");
  const [contextSize, setContextSize] = useState<number>(4096);
  const [responseLength, setResponseLength] = useState<number>(1024);

  // Add debounce timer ref
  const saveTimeoutRef = useRef<number | null>(null);

  // Fetch models on component mount
  useEffect(() => {
    if (profileId) {
      fetchModels({ profile_id: profileId });
    }
  }, [profileId]);

  // Initialize state from current template
  useEffect(() => {
    if (currentTemplate) {
      // Set model ID if available
      if (currentTemplate.model_id) {
        setSelectedModelId(currentTemplate.model_id);
      }

      // Set inference template ID if available
      if (currentTemplate.format_template_id) {
        setSelectedFormatTemplateId(currentTemplate.format_template_id);
      }

      // Set context size and response length from config
      if (currentTemplate.config) {
        setContextSize(currentTemplate.config.max_tokens || 4096);
        setResponseLength(currentTemplate.config.max_response || 1024);
      }

      // Set custom prompts
      setCustomPrompts(currentTemplate.custom_prompts || []);

      // Set other config values as active fields
      const templateConfig = currentTemplate.config || {};
      const configKeys = Object.keys(templateConfig).filter((key) => key !== "max_tokens" && key !== "max_response");

      if (configKeys.length > 0) {
        setActiveFields(configKeys);

        const configValues: Record<string, any> = {};
        for (const key of configKeys) {
          configValues[key] = templateConfig[key];
        }
        setValues(configValues);
      }
    } else {
      // Reset to defaults if no template
      setActiveFields([]);
      setValues({});
      setSelectedModelId("");
      setSelectedFormatTemplateId("");
      setContextSize(4096);
      setResponseLength(1024);
      setCustomPrompts([]);
    }
  }, [currentTemplate?.id]);

  // Get model manifest
  const manifestId = useMemo(() => {
    return models.find((model) => model.id === selectedModelId)?.manifest_id;
  }, [models, selectedModelId]);
  const selectedModelManifest = useModelManifestById(manifestId || "");
  const availableInferenceFields = useMemo(() => selectedModelManifest?.inference_fields || [], [selectedModelManifest]);

  // Custom prompts state
  const [customPrompts, setCustomPrompts] = useState<ChatTemplateCustomPrompt[]>([]);
  const [isCustomPromptModalOpen, setIsCustomPromptModalOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  // Template options for picker
  const templateOptions = useMemo(() => {
    return chatTemplateList.map((template) => ({
      id: template.id,
      name: template.name,
    }));
  }, [chatTemplateList]);

  // Check if component should be disabled (no template selected)
  const isDisabled = !currentChatTemplateID;

  // Template picker handlers
  const { createChatTemplate, deleteChatTemplate, updateChatTemplate: chatTemplateUpdate } = useChatTemplateActions();
  const { updateSelectedChat } = useChatStore((state) => state.actions);

  const handleTemplateSelect = (templateId: string) => {
    if (currentChatTemplateID === templateId) {
      return;
    }

    // Update the current chat to use the selected template
    updateSelectedChat({ chat_template_id: templateId });
  };

  const handleCreateTemplate = (name: string) => {
    // Implementation will be done via dialog in the UI
    // The TemplatePicker just needs a callback without parameters
    if (name) {
      // Create new template with default settings
      createChatTemplate({
        profile_id: profileId,
        name,
        model_id: null,
        config: {
          max_tokens: 4096,
          max_response: 1024,
        },
        custom_prompts: [],
      }).then((newTemplate) => {
        // Select the newly created template
        updateSelectedChat({ chat_template_id: newTemplate.id });
      });
    }
  };

  const handleDeleteTemplate = () => {
    if (!currentChatTemplateID) {
      return;
    }

    // Delete the template
    deleteChatTemplate(currentChatTemplateID).then((success) => {
      // If the template was successfully deleted
      if (success) {
        // Clear the selection
        updateSelectedChat({ chat_template_id: undefined });
      }
    });
  };

  const handleEditTemplateName = (_unused: string, newName: string) => {
    if (!currentChatTemplateID) {
      return;
    }

    if (newName) {
      // Update the template name
      chatTemplateUpdate(currentChatTemplateID, { name: newName });
    }
  };

  /**
   * Determines if a field is supported by the currently selected model
   *
   * @param fieldName - The name of the field to check
   * @returns boolean indicating if the field is supported
   */
  const isFieldSupportedByModel = (fieldName: string): boolean => {
    if (!selectedModelId || !selectedModelManifest) {
      return true; // If no model selected, don't apply strikethrough
    }

    return availableInferenceFields.includes(fieldName);
  };

  const availableFields = useMemo(() => {
    return configFields
      .filter((field) => !activeFields.includes(field.name))
      .map((field) => {
        const isSupported = isFieldSupportedByModel(field.name);
        return {
          label: field.title,
          value: field.name,
          disabled: !isSupported || isDisabled,
        };
      });
  }, [activeFields, selectedModelId, availableInferenceFields, isDisabled]);

  const modelOptions = useMemo(() => {
    return models
      .filter((model: Model) => model.type === "llm")
      .map((model: Model) => ({
        label: model.name,
        value: model.id,
      }));
  }, [models]);

  const formatTemplateOptions = useMemo(() => {
    return formatTemplates.map((template) => ({
      label: template.name,
      value: template.id,
    }));
  }, [formatTemplates]);
  /**
   * Handles adding a field to the active fields list.
   *
   * @param fieldName - The name of the field to add.
   */
  const handleAddField = (fieldName: string) => {
    if (isDisabled) {
      return;
    }

    const field = configFields.find((f) => f.name === fieldName);
    if (!field) {
      return;
    }

    setActiveFields((prev) => [...prev, fieldName]);
    setSelectedField("");

    if (field.type === "section") {
      // Initialize section with default values for all nested fields
      const sectionField = field as SectionField;
      const sectionDefaults = sectionField.fields.reduce(
        (acc, nestedField) => {
          if ("default" in nestedField) {
            acc[nestedField.name] = nestedField.default;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      setValues((prev) => ({
        ...prev,
        [fieldName]: sectionDefaults,
      }));
    } else if ("default" in field) {
      const defaultValue = field.default;
      setValues((prev) => ({
        ...prev,
        [fieldName]: defaultValue,
      }));
    }
  };

  const handleRemoveField = (fieldName: string) => {
    if (isDisabled) {
      return;
    }

    setActiveFields((prev) => prev.filter((f) => f !== fieldName));
    setValues((prev) => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleValueChange = (fieldName: string, newValue: any) => {
    if (isDisabled) {
      return;
    }

    setValues((prev) => ({
      ...prev,
      [fieldName]: newValue,
    }));
  };

  // Save changes to template with debounce
  const debouncedSaveChanges = () => {
    // Clear any existing timeout
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    // Set a new timeout
    saveTimeoutRef.current = window.setTimeout(() => {
      if (!currentChatTemplateID || isDisabled) {
        return;
      }

      // Compile all config values
      const configValues = {
        ...values,
        max_tokens: contextSize,
        max_response: responseLength,
      };

      // Update template
      updateChatTemplate(currentChatTemplateID, {
        model_id: selectedModelId || null,
        format_template_id: selectedFormatTemplateId || null,
        config: configValues,
        custom_prompts: customPrompts,
      });

      saveTimeoutRef.current = null;
    }, 500); // 500ms debounce delay
  };

  // Save changes when relevant state changes
  useEffect(() => {
    if (currentChatTemplateID) {
      debouncedSaveChanges();
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [selectedModelId, selectedFormatTemplateId, contextSize, responseLength, values, customPrompts, currentChatTemplateID]);

  // Custom prompts handlers
  const handleAddCustomPrompt = () => {
    if (isDisabled) {
      return;
    }

    setEditingPromptId(null);
    setIsCustomPromptModalOpen(true);
  };

  const handleEditCustomPrompt = (promptId: string) => {
    if (isDisabled) {
      return;
    }

    setEditingPromptId(promptId);
    setIsCustomPromptModalOpen(true);
  };

  const handleDeleteCustomPrompt = (promptId: string) => {
    if (isDisabled) {
      return;
    }

    setCustomPrompts((prev) => prev.filter((p) => p.id !== promptId));
  };

  const handleSaveCustomPrompt = (prompt: ChatTemplateCustomPrompt) => {
    if (isDisabled) {
      return;
    }

    if (editingPromptId) {
      setCustomPrompts((prev) => prev.map((p) => (p.id === editingPromptId ? prompt : p)));
    } else {
      setCustomPrompts((prev) => [...prev, prompt]);
    }
    setEditingPromptId(null);
  };

  const handleReorderCustomPrompts = (reorderedPrompts: ChatTemplateCustomPrompt[]) => {
    if (isDisabled) {
      return;
    }

    setCustomPrompts(reorderedPrompts);
  };

  /**
   * Gets the custom prompt to edit.
   *
   * @returns The custom prompt to edit, or undefined if no prompt is being edited.
   */
  const getCustomPromptToEdit = () => {
    if (!editingPromptId) {
      return undefined;
    }
    return customPrompts.find((p) => p.id === editingPromptId);
  };

  return (
    <div className="space-y-1 p-1">
      {/* Template Picker Section */}
      <div className="space-y-1 mb-3">
        <TemplatePicker
          compact={true}
          templates={templateOptions}
          selectedTemplateId={currentChatTemplateID || null}
          onTemplateSelect={handleTemplateSelect}
          onDelete={handleDeleteTemplate}
          onNewTemplate={handleCreateTemplate}
          onEditName={handleEditTemplateName}
          onImport={() => {
            /* To be implemented later */
          }}
          onExport={() => {
            /* To be implemented later */
          }}
        />
      </div>
      <Separator className="my-2" />

      {/* Model Selection Section */}
      <div className={`p-1 space-y-2 bg-foreground/5 rounded-lg ${isDisabled ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <ServerIcon className="!h-3 !w-3" />
            <h3 className="text-xs font-normal my-auto">Model:</h3>
          </div>
          <div className="flex-1">
            <Combobox
              items={modelOptions}
              onChange={setSelectedModelId}
              placeholder="Search a model..."
              trigger={
                <Button variant="outline" className="w-full justify-between text-xs px-2" disabled={isDisabled}>
                  {selectedModelId
                    ? modelOptions.find((model) => model.value === selectedModelId)?.label || "Select a model..."
                    : "Select a model..."}
                </Button>
              }
            />
          </div>
        </div>

        {/* Format Template Selection */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <PaperclipIcon className="!h-3 !w-3" />
            <h3 className="text-xs font-normal my-auto">Format:</h3>
          </div>
          <div className="flex-1">
            <Combobox
              items={formatTemplateOptions}
              onChange={setSelectedFormatTemplateId}
              placeholder="Search a format..."
              trigger={
                <Button variant="outline" className="w-full justify-between text-xs px-2" disabled={isDisabled}>
                  {selectedFormatTemplateId
                    ? formatTemplates.find((template) => template.id === selectedFormatTemplateId)?.name || "Select a format..."
                    : "Select a format..."}
                </Button>
              }
            />
          </div>
        </div>

        {/* Context Size */}
        <div className="flex items-center gap-2">
          <div className="w-1/3 flex items-center">
            <h3 className="text-xs font-normal">Context Size:</h3>
          </div>
          <div className="flex-1">
            <StepButton value={contextSize} onValueChange={setContextSize} min={512} max={32768} step={512} className="h-7" disabled={isDisabled} />
          </div>
        </div>

        {/* Response Length */}
        <div className="flex items-center gap-2">
          <div className="w-1/3 flex items-center">
            <h3 className="text-xs font-normal">Response Length:</h3>
          </div>
          <div className="flex-1">
            <StepButton
              value={responseLength}
              onValueChange={setResponseLength}
              min={64}
              max={4096}
              step={64}
              className="h-7"
              disabled={isDisabled}
            />
          </div>
        </div>
      </div>
      <Separator className="my-2" />

      {/* Custom Prompts Section */}
      <div className={`space-y-2 mb-4 ${isDisabled ? "opacity-50" : ""}`}>
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center gap-1">
            <Layers className="!h-3 !w-3" />
            <h3 className="text-xs font-normal my-auto">Custom Prompts</h3>
          </div>
          <Button size="sm" variant="secondary" className="h-5" onClick={handleAddCustomPrompt} disabled={isDisabled}>
            <PlusIcon className="mr-1 !h-3 !w-3" />
            Prompt
          </Button>
        </div>

        <CustomPromptsList
          prompts={customPrompts}
          onEdit={handleEditCustomPrompt}
          onDelete={handleDeleteCustomPrompt}
          onReorder={handleReorderCustomPrompts}
        />

        <CustomPromptModal
          open={isCustomPromptModalOpen}
          onClose={() => setIsCustomPromptModalOpen(false)}
          onSave={handleSaveCustomPrompt}
          initialData={getCustomPromptToEdit()}
        />
      </div>

      <Separator className="my-2" />

      {/* Inference Settings Section */}
      <div className={`${isDisabled ? "opacity-50" : ""}`}>
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center gap-1">
            <Layers2 className="!h-3 !w-3" />
            <h3 className="text-xs font-normal my-auto">Inference Settings</h3>
          </div>
          <Combobox
            items={availableFields}
            onChange={(value) => {
              setSelectedField(value);
              handleAddField(value);
            }}
            trigger={
              <Button size="sm" variant="secondary" className="h-5" disabled={isDisabled}>
                <PlusIcon className="mr-1 !h-3 !w-3" />
                Field
              </Button>
            }
            placeholder="Select field to add..."
          />
        </div>

        <div className="space-y-2">
          {activeFields.map((fieldName) => {
            const field = configFields.find((f) => f.name === fieldName);
            if (!field) {
              return null;
            }

            const isSupported = isFieldSupportedByModel(fieldName);

            return (
              <ConfigItem
                key={fieldName}
                field={field}
                value={values[fieldName]}
                onChange={(newValue) => handleValueChange(fieldName, newValue)}
                onRemove={() => handleRemoveField(fieldName)}
                isStrikethrough={!isSupported}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WidgetConfig;
