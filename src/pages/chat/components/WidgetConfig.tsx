import { BookOpenCheck, ChevronDown, Layers, Layers2, PaperclipIcon, Pencil, PlusIcon, ServerIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { TemplatePicker } from "@/components/shared/TemplatePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { StepButton } from "@/components/ui/step-button";
import { useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatParticipants, useCurrentChatTemplateID } from "@/hooks/chatStore";
import { useChatTemplate, useChatTemplateActions, useChatTemplateList } from "@/hooks/chatTemplateStore";
import { useLorebookStoreActions, useLorebooks } from "@/hooks/lorebookStore";
import { useModelManifestById } from "@/hooks/manifestStore";
import { useModels, useModelsActions } from "@/hooks/modelsStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useFormatTemplateList, useTemplateActions } from "@/hooks/templateStore";
import { Model } from "@/schema/models-schema";
import { ChatTemplate, ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import type { SectionField } from "@/schema/template-chat-settings-types";
import { parseChatTemplateContent, validateAndTransformChatTemplateData } from "@/services/imports/import-chat-template";
import { validateAndTransformFormatTemplateData } from "@/services/imports/import-format-template";
import { importLorebook, validateAndTransformLorebookData } from "@/services/imports/import-lorebook";
import { prepareLorebooksForEmbedding } from "@/services/imports/shared/lorebook-export";
import { getChatTemplateById, NewChatTemplateParams } from "@/services/template-chat-service";
import { createFormatTemplate, getFormatTemplateById } from "@/services/template-format-service";
import { ExportType, exportSingleToJsonFile } from "@/utils/export-utils";
import { sortTemplatesByFavoriteAndName } from "@/utils/sorting";
import { configFields } from "../manifests/configFields";
import { CustomPromptModal } from "./custom-prompt/CustomPromptModal";
import { CustomPromptsList } from "./custom-prompt/CustomPromptsList";
import { ExportOptions, ExportOptionsDialog } from "./ExportOptionsDialog";
import { ConfigItem } from "./fields/ConfigItems";
import FormatTemplateModal from "./format-template/FormatTemplateModal";
import { ImportOptions, ImportOptionsDialog } from "./ImportOptionsDialog";

const bigScreenBreakpoints = "@[18rem]:flex";

interface ChatTemplateConfigProps {
  currentChatTemplateID?: string | null;
  onChatTemplateChange?: (chatTemplateID: string) => void;
}

/**
 * WidgetConfig component
 *
 * This component is used to configure the widget settings.
 * It allows you to add custom prompts, inference settings, and other configuration options.
 *
 */
const WidgetConfig = ({ currentChatTemplateID, onChatTemplateChange }: ChatTemplateConfigProps) => {
  const chatTemplateList = useChatTemplateList();
  const { updateChatTemplate } = useChatTemplateActions();
  const { fetchFormatTemplates, updateFormatTemplate } = useTemplateActions();
  const models = useModels();
  const { updateModel } = useModelsActions();
  const formatTemplates = useFormatTemplateList();
  const lorebooks = useLorebooks();
  const participants = useCurrentChatParticipants();
  const characterList = useCharacters();

  const { loadLorebooks } = useLorebookStoreActions();

  const participantHaveLorebook = useMemo(() => {
    return participants?.some((participant) => characterList.find((character) => character.id === participant.id)?.lorebook_id);
  }, [participants, characterList]);

  const currentProfile = useCurrentProfile();
  const profileId = currentProfile?.id;

  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [, setSelectedField] = useState<string | null>("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedFormatTemplateId, setSelectedFormatTemplateId] = useState<string | null>(null);
  const [selectedLorebookList, setSelectedLorebookList] = useState<string[]>([]);
  const [contextSize, setContextSize] = useState<number>(4096);
  const [responseLength, setResponseLength] = useState<number>(1024);
  const [maxDepth, setMaxDepth] = useState<number>(1000);
  const [lorebookTokenBudget, setLorebookTokenBudget] = useState<number>(2048);
  const [isFormatTemplateModalOpen, setIsFormatTemplateModalOpen] = useState(false);
  const [isExportOptionsDialogOpen, setIsExportOptionsDialogOpen] = useState(false);
  const [pendingExportTemplateId, setPendingExportTemplateId] = useState<string | null>(null);
  const [isImportOptionsDialogOpen, setIsImportOptionsDialogOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    fileName: string;
    templateData: any;
    parsedData: any;
    hasFormatTemplate: boolean;
    hasLorebooks: boolean;
    lorebookCount: number;
  } | null>(null);

  if (!currentChatTemplateID && !onChatTemplateChange) {
    currentChatTemplateID = useCurrentChatTemplateID();
  }
  const currentTemplate = useChatTemplate(currentChatTemplateID || "");

  // Add debounce timer ref
  const saveTimeoutRef = useRef<number | null>(null);

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

      // Set lorebooks if available
      if (currentTemplate.lorebook_list) {
        setSelectedLorebookList(currentTemplate.lorebook_list);
      }

      // Set context size, response length, max depth, and lorebook budget from config
      if (currentTemplate.config) {
        setContextSize(currentTemplate.config.max_context || 4096);
        setResponseLength(currentTemplate.config.max_tokens || 1024);
        setMaxDepth(currentTemplate.config.max_depth || 100);
        setLorebookTokenBudget(currentTemplate.config.lorebook_token_budget ?? 2048);
      }

      // Set custom prompts
      setCustomPrompts(currentTemplate.custom_prompts || []);

      // Set other config values as active fields
      const templateConfig = currentTemplate.config || {};
      const configKeys = Object.keys(templateConfig).filter((key) => key !== "max_tokens" && key !== "max_context" && key !== "max_depth");

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
      setMaxDepth(100);
      setLorebookTokenBudget(2048);
      setCustomPrompts([]);
      setSelectedLorebookList([]);
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
      favorite: template.favorite,
    }));
  }, [chatTemplateList]);

  const formatTemplateOptions = useMemo(() => {
    return sortTemplatesByFavoriteAndName(formatTemplates).map((template) => ({
      label: template.name,
      value: template.id,
      favorite: template.favorite,
      onFavoriteToggle: () => updateFormatTemplate(template.id, { favorite: !template.favorite }),
    }));
  }, [formatTemplates]);

  const lorebookOptions = useMemo(() => {
    return sortTemplatesByFavoriteAndName(lorebooks).map((lorebook) => ({
      label: lorebook.name,
      value: lorebook.id,
    }));
  }, [lorebooks]);

  // Check if component should be disabled (no template selected)
  const isDisabled = !currentChatTemplateID;

  // Template picker handlers
  const { createChatTemplate, deleteChatTemplate, updateChatTemplate: chatTemplateUpdate } = useChatTemplateActions();
  const { updateSelectedChat } = useChatActions();

  const handleTemplateSelect = (templateId: string | null) => {
    if (templateId === null) {
      return;
    }

    if (currentChatTemplateID === templateId) {
      return;
    }

    if (onChatTemplateChange) {
      onChatTemplateChange(templateId);
    } else {
      // Update the current chat to use the selected template
      updateSelectedChat({ chat_template_id: templateId });
    }
  };

  const handleCreateTemplate = (name: string, sourceTemplateId?: string) => {
    if (!profileId) {
      return;
    }

    let newChatTemplate: NewChatTemplateParams = {
      profile_id: profileId,
      name,
      model_id: null,
      lorebook_list: [],
      config: {
        max_tokens: 4096,
        max_context: 4096 * 2,
        max_depth: 100,
        lorebook_token_budget: 2048,
      },
      custom_prompts: [],
    };

    if (sourceTemplateId) {
      const sourceTemplate = chatTemplateList.find((template) => template.id === sourceTemplateId);
      if (sourceTemplate) {
        const sourceConfig = JSON.parse(JSON.stringify(sourceTemplate.config || {}));
        newChatTemplate = {
          ...sourceTemplate,
          name: `${name}`,
          config: {
            ...sourceConfig,
            lorebook_token_budget: sourceConfig.lorebook_token_budget ?? 2048,
          },
        };
      }
    }

    createChatTemplate(newChatTemplate).then((newTemplate) => {
      if (onChatTemplateChange) {
        onChatTemplateChange(newTemplate.id);
      } else {
        updateSelectedChat({ chat_template_id: newTemplate.id });
      }
    });
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
      })
      .sort((a, b) => (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0));
  }, [activeFields, selectedModelId, availableInferenceFields, isDisabled]);

  const modelOptions = sortTemplatesByFavoriteAndName(models.filter((model: Model) => model.type === "llm")).map((model: Model) => ({
    label: model.name,
    value: model.id,
    favorite: model.favorite,
    onFavoriteToggle: () => updateModel(model.id, { favorite: !model.favorite }),
  }));

  /**
   * Handles adding a field to the active fields list.
   *
   * @param fieldName - The name of the field to add.
   */
  const handleAddField = (fieldName: string | null) => {
    if (isDisabled) {
      return;
    }

    if (!fieldName) {
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
      const configValues: ChatTemplate["config"] = {
        ...values,
        max_tokens: responseLength,
        max_context: contextSize,
        max_depth: maxDepth,
      };

      // Only include lorebook budget if lorebooks are selected
      if (selectedLorebookList.length > 0) {
        configValues.lorebook_token_budget = lorebookTokenBudget;
      } else {
        // Optionally remove or nullify if no lorebooks are selected
        delete configValues.lorebook_token_budget;
      }

      // Update template
      updateChatTemplate(currentChatTemplateID, {
        model_id: selectedModelId || null,
        format_template_id: selectedFormatTemplateId || null,
        lorebook_list: selectedLorebookList,
        config: configValues,
        custom_prompts: customPrompts,
      });

      saveTimeoutRef.current = null;
    }, 100); // Keep debounce delay at 500ms for stability
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
  }, [selectedModelId, selectedFormatTemplateId, selectedLorebookList, contextSize, responseLength, maxDepth, lorebookTokenBudget, values, customPrompts, currentChatTemplateID]);

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

  const handleToggleCustomPromptEnabled = (promptId: string, enabled: boolean) => {
    if (isDisabled) {
      return;
    }

    setCustomPrompts((prev) => prev.map((prompt) => (prompt.id === promptId ? { ...prompt, enabled } : prompt)));
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

  const handleExportTemplate = async (templateId: string) => {
    if (!templateId) {
      return;
    }

    try {
      const template: any = await getChatTemplateById(templateId);
      if (!template) {
        toast.error("Export failed", {
          description: "Template not found.",
        });
        return;
      }

      // Check if template has format template or lorebooks
      const hasFormatTemplate = !!template.format_template_id;
      const hasLorebooks = template.lorebook_list && template.lorebook_list.length > 0;

      // If template has additional resources, show options dialog
      if (hasFormatTemplate || hasLorebooks) {
        setPendingExportTemplateId(templateId);
        setIsExportOptionsDialogOpen(true);
      } else {
        // Export directly if no additional resources
        await performExport(template, { includeFormatTemplate: false, includeLorebooks: false, exportFormat: "json" });
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "An unexpected error occurred during export.",
      });
    }
  };

  const handleExportOptionsConfirm = async (options: ExportOptions) => {
    if (!pendingExportTemplateId) {
      return;
    }

    try {
      const template: any = await getChatTemplateById(pendingExportTemplateId);
      if (!template) {
        toast.error("Export failed", {
          description: "Template not found.",
        });
        return;
      }

      await performExport(template, options);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "An unexpected error occurred during export.",
      });
    } finally {
      setPendingExportTemplateId(null);
    }
  };

  const performExport = async (template: any, options: ExportOptions) => {
    const exportedTemplates: any = structuredClone(template);

    // Include format template if requested
    if (options.includeFormatTemplate && template.format_template_id) {
      const formatTemplate = await getFormatTemplateById(template.format_template_id).catch(() => null);
      if (formatTemplate) {
        const exportType: ExportType = "format_template";
        exportedTemplates.format_template = { ...formatTemplate, export_type: exportType };
      }
    }

    // Include lorebooks if requested
    if (options.includeLorebooks && template.lorebook_list && template.lorebook_list.length > 0) {
      const lorebooks = await prepareLorebooksForEmbedding(template.lorebook_list);
      exportedTemplates.lorebooks = lorebooks;
    } else {
      delete exportedTemplates.lorebook_list;
    }

    // Remove unused fields
    delete exportedTemplates.model_id;
    delete exportedTemplates.format_template_id;

    // Use the export utility to handle the export
    const success = await exportSingleToJsonFile(exportedTemplates, "chat_template", `chat_template_${template.name.replace(/[^a-zA-Z0-9]/g, "_")}`);

    if (!success) {
      console.warn("Export was cancelled or failed");
    }
  };

  const handleImportTemplate = async (fileName: string, templateData: any) => {
    if (!profileId) {
      toast.error("No profile selected", {
        description: "Please select a profile before importing templates.",
      });
      return;
    }

    try {
      // Parse the template content if it's a string
      let parsedData = templateData;
      if (typeof templateData === "string") {
        parsedData = parseChatTemplateContent(templateData);
      }

      // Check if the template contains embedded resources
      const hasFormatTemplate = !!parsedData.format_template;
      const hasLorebooks = !!parsedData.lorebooks;
      const lorebookCount = parsedData.lorebooks?.length || 0;

      // If template has additional resources, show options dialog
      if (hasFormatTemplate || hasLorebooks) {
        setPendingImportData({
          fileName,
          templateData,
          parsedData,
          hasFormatTemplate,
          hasLorebooks,
          lorebookCount,
        });
        setIsImportOptionsDialogOpen(true);
      } else {
        // Import directly if no additional resources
        await performImport(fileName, templateData, parsedData, { includeFormatTemplate: false, includeLorebooks: false });
      }
    } catch (error) {
      console.error("Template import error:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred during import.";
      toast.error("Import failed", {
        description: message,
      });
    }
  };

  const handleImportOptionsConfirm = async (options: ImportOptions) => {
    if (!pendingImportData) {
      return;
    }

    try {
      await performImport(pendingImportData.fileName, pendingImportData.templateData, pendingImportData.parsedData, options);
    } catch (error) {
      console.error("Template import error:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred during import.";
      toast.error("Import failed", {
        description: message,
      });
    } finally {
      setPendingImportData(null);
    }
  };

  const performImport = async (fileName: string, _templateData: any, parsedData: any, options: ImportOptions) => {
    if (!profileId) {
      return;
    }

    let formatTemplateId: string | null = null;
    const importedLorebookIds: string[] = [];

    try {
      // Import format template if requested and available
      if (options.includeFormatTemplate) {
        const formatTemplateData = parsedData.format_template;
        if (formatTemplateData) {
          try {
            const formatValidationResult = validateAndTransformFormatTemplateData(formatTemplateData, profileId, `${fileName}_format`);
            if (formatValidationResult.valid && formatValidationResult.data) {
              const importedFormatTemplate = await createFormatTemplate(formatValidationResult.data);
              formatTemplateId = importedFormatTemplate.id;
              toast.success("Format template imported", {
                description: `Format template "${importedFormatTemplate.name}" has been imported.`,
              });
            }
          } catch (error) {
            console.warn("Failed to import format template:", error);
            toast.error("Format template import failed", {
              description: "The format template could not be imported, but the chat template will still be imported.",
            });
          }
        }
      }

      // Import lorebooks if requested and available
      if (options.includeLorebooks) {
        const lorebooksData = parsedData.lorebooks;
        if (lorebooksData && Array.isArray(lorebooksData)) {
          for (const lorebookData of lorebooksData) {
            try {
              const lorebookValidationResult = validateAndTransformLorebookData(lorebookData, profileId, `${fileName}_${lorebookData.name || "unnamed"}`);
              if (lorebookValidationResult.valid && lorebookValidationResult.data) {
                const importedLorebook = await importLorebook(lorebookValidationResult.data);
                importedLorebookIds.push(importedLorebook.id);
              }
            } catch (error) {
              console.warn("Failed to import lorebook:", error);
            }
          }
          if (importedLorebookIds.length > 0) {
            toast.success("Lorebooks imported", {
              description: `${importedLorebookIds.length} lorebook(s) have been imported.`,
            });
          }
        }
      }

      // Validate and transform the chat template data
      const validationResult = validateAndTransformChatTemplateData(parsedData, profileId, fileName);

      if (!validationResult.valid) {
        toast.error("Invalid template format", {
          description: `Import failed: ${validationResult.errors.join(", ")}`,
        });
        return;
      }

      if (!validationResult.data) {
        toast.error("No template data found", {
          description: "The imported file does not contain valid template data.",
        });
        return;
      }

      // Update the template data with imported resources
      const templateToImport = { ...validationResult.data };
      if (formatTemplateId) {
        templateToImport.format_template_id = formatTemplateId;
      }
      if (importedLorebookIds.length > 0) {
        templateToImport.lorebook_list = [...(templateToImport.lorebook_list || []), ...importedLorebookIds];
      } else {
        templateToImport.lorebook_list = [];
      }

      // Import the template
      const importedTemplate = await createChatTemplate(templateToImport);

      toast.success("Template imported successfully", {
        description: `${importedTemplate.name} (Format: ${validationResult.format}) has been imported.`,
      });

      // Switch to the newly imported template
      if (onChatTemplateChange) {
        onChatTemplateChange(importedTemplate.id);
      } else {
        updateSelectedChat({ chat_template_id: importedTemplate.id });
      }
    } catch (error) {
      console.error("Template import error:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred during import.";
      toast.error("Import failed", {
        description: message,
      });
    } finally {
      await fetchFormatTemplates(profileId);
      await loadLorebooks(profileId);
    }
  };

  return (
    <div className="space-y-1 p-1 @container">
      {/* Template Picker Section */}
      <div className="space-y-1 mb-3 mx-1">
        <TemplatePicker
          compact={true}
          templates={templateOptions}
          selectedTemplateId={currentChatTemplateID || null}
          onFavoriteChange={(templateId, favorite) => {
            updateChatTemplate(templateId, { favorite });
          }}
          onTemplateSelect={handleTemplateSelect}
          onDelete={handleDeleteTemplate}
          onNewTemplate={handleCreateTemplate}
          onEditName={handleEditTemplateName}
          onImport={handleImportTemplate}
          onExport={handleExportTemplate}
        />
      </div>
      <Separator className="my-2" />

      {/* Model Selection Section */}
      <div className={`p-1 space-y-2 bg-foreground/5 rounded-lg ${isDisabled ? "opacity-50" : ""}`}>
        <div className={`${bigScreenBreakpoints} items-center gap-2`}>
          <div className="flex items-center gap-1">
            <ServerIcon className="!h-3 !w-3" />
            <h3 className="text-xs font-normal my-auto">Model:</h3>
          </div>
          <div className="flex-1">
            <Combobox
              items={modelOptions}
              onChange={setSelectedModelId}
              selectedValue={selectedModelId}
              placeholder="Search a model..."
              trigger={
                <Button variant={selectedFormatTemplateId ? "outline" : "destructive"} className="w-full justify-between text-xs px-2" disabled={isDisabled}>
                  {selectedModelId ? modelOptions.find((model) => model.value === selectedModelId)?.label || "Select a model..." : "Select a model..."}
                  <ChevronDown className="ml-auto !h-3 !w-3" />
                </Button>
              }
            />
          </div>
        </div>

        {/* Format Template Selection */}
        <div className={`${bigScreenBreakpoints} items-center gap-2`}>
          <div className="flex items-center gap-1">
            <PaperclipIcon className="!h-3 !w-3" />
            <h3 className="text-xs font-normal my-auto">Format:</h3>
          </div>
          <div className="flex flex-row items-center gap-1 flex-1">
            <div className="flex-1">
              <Combobox
                items={formatTemplateOptions}
                onChange={setSelectedFormatTemplateId}
                placeholder="Search a format..."
                selectedValue={selectedFormatTemplateId}
                trigger={
                  <Button variant={selectedFormatTemplateId ? "outline" : "destructive"} className="w-full justify-between text-xs px-2" disabled={isDisabled}>
                    {selectedFormatTemplateId ? formatTemplates.find((template) => template.id === selectedFormatTemplateId)?.name || "Select a format..." : "Select a format..."}
                    <ChevronDown className="ml-auto !h-3 !w-3" />
                  </Button>
                }
              />
            </div>
            {selectedFormatTemplateId && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setIsFormatTemplateModalOpen(true)} disabled={isDisabled} aria-label="Edit Format Template">
                <Pencil className="!h-3 !w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Lorebook Selection */}
        <div className={`${bigScreenBreakpoints} items-center gap-2`}>
          <div className="flex items-center gap-1">
            <BookOpenCheck className="!h-3 !w-3" />
            <h3 className="text-xs font-normal my-auto">Lorebooks:</h3>
          </div>
          <div className="flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-xs px-2 h-auto min-h-7" disabled={isDisabled}>
                  <div className="flex gap-1 flex-wrap items-center">
                    {selectedLorebookList.length > 0 ? (
                      selectedLorebookList.map((lorebookId) => {
                        const lorebook = lorebooks.find((lb) => lb.id === lorebookId);
                        return (
                          <Badge
                            variant="default"
                            key={lorebookId}
                            className="px-1 py-0 rounded-sm text-[10px] flex items-center gap-0.5"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent popover from closing
                              setSelectedLorebookList((prev) => prev.filter((id) => id !== lorebookId));
                            }}
                          >
                            {lorebook?.name || lorebookId}
                            <XIcon className="h-2 w-2" />
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-muted-foreground">Select lorebooks...</span>
                    )}
                  </div>
                  <ChevronDown className="ml-auto !h-3 !w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search lorebooks..." className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty>No lorebooks found.</CommandEmpty>
                    <CommandGroup>
                      {lorebookOptions.map((option) => {
                        const isSelected = selectedLorebookList.includes(option.value);
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            className="text-xs"
                            onSelect={() => {
                              setSelectedLorebookList((prev) => (isSelected ? prev.filter((id) => id !== option.value) : [...prev, option.value]));
                            }}
                          >
                            <Checkbox checked={isSelected} className="mr-2 h-4 w-4" />
                            <span>{option.label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Context Size */}
        <div className={`${bigScreenBreakpoints} items-center gap-2 pb-4`}>
          <div className="flex items-center gap-1 col-span-2 min-w-0">
            <HelpTooltip>Defines the total token limit for the model's input history. Excess history is truncated.</HelpTooltip>
            <h3 className="text-xs font-normal  truncate">Context Size:</h3>
          </div>
          <div className="flex-1">
            <StepButton value={contextSize} showSlider onValueChange={setContextSize} min={512} max={32768 * 10} step={512} className="h-7" disabled={isDisabled} />
          </div>
        </div>

        {/* Lorebook Token Budget - Conditionally Rendered */}
        {(selectedLorebookList.length > 0 || participantHaveLorebook) && (
          <div className={`${bigScreenBreakpoints} items-center gap-2`}>
            <div className="flex items-center gap-1 col-span-2 min-w-0">
              <HelpTooltip>Specifies the maximum number of tokens allocated to lorebook entries within the context.</HelpTooltip>
              <h3 className="text-xs font-norma  truncate">Lorebook Budget:</h3>
            </div>
            <div className="flex-1">
              <StepButton value={lorebookTokenBudget} onValueChange={setLorebookTokenBudget} min={0} max={contextSize} step={64} className="h-7" disabled={isDisabled} />
            </div>
          </div>
        )}

        {/* Response Length */}
        <div className={`${bigScreenBreakpoints} items-center gap-2`}>
          <div className="flex items-center gap-1 col-span-2 min-w-0">
            <HelpTooltip>Sets the maximum number of tokens the model is allowed to generate in a single response.</HelpTooltip>
            <h3 className="text-xs font-normal truncate">Response Length:</h3>
          </div>
          <div className="flex-1">
            <StepButton value={responseLength} onValueChange={setResponseLength} min={1} max={99999} step={50} className="h-7" disabled={isDisabled} />
          </div>
        </div>

        {/* Max Depth */}
        <div className={`${bigScreenBreakpoints} items-center gap-2`}>
          <div className="flex items-center gap-1 col-span-2 min-w-0">
            <HelpTooltip>Limits the number of recent messages included in the context sent to the model. Older messages are dropped.</HelpTooltip>
            <h3 className="text-xs font-normal">Max Depth:</h3>
          </div>
          <div className="flex-1">
            <StepButton
              value={maxDepth}
              onValueChange={(value) => {
                setMaxDepth(value);
              }}
              min={0}
              max={10000}
              step={10}
              className="h-7"
              disabled={isDisabled}
            />
          </div>
        </div>
      </div>

      <Separator className="my-2" />

      {/* Custom Prompts Section */}
      <div className={`space-y-2 mb-4 ${isDisabled ? "opacity-50" : ""}`}>
        <div className="flex justify-between items-center py-2 @sm:ml-2">
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
          onToggleEnabled={handleToggleCustomPromptEnabled}
          disabled={isDisabled}
        />

        <CustomPromptModal open={isCustomPromptModalOpen} onClose={() => setIsCustomPromptModalOpen(false)} onSave={handleSaveCustomPrompt} initialData={getCustomPromptToEdit()} />
      </div>

      <Separator className="my-2" />

      {/* Inference Settings Section */}
      <div className={`${isDisabled ? "opacity-50" : ""}`}>
        <div className="flex justify-between items-center py-2 @sm:ml-2">
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

      <FormatTemplateModal
        open={isFormatTemplateModalOpen}
        onOpenChange={setIsFormatTemplateModalOpen}
        selectedTemplateId={selectedFormatTemplateId || null}
        onTemplateChange={(templateId) => setSelectedFormatTemplateId(templateId || "none")}
      />

      <ExportOptionsDialog
        open={isExportOptionsDialogOpen}
        onOpenChange={setIsExportOptionsDialogOpen}
        onConfirm={handleExportOptionsConfirm}
        templateName={currentTemplate?.name || ""}
        hasFormatTemplate={!!currentTemplate?.format_template_id}
        hasLorebooks={!!(currentTemplate?.lorebook_list && currentTemplate.lorebook_list.length > 0)}
      />

      <ImportOptionsDialog
        open={isImportOptionsDialogOpen}
        onOpenChange={setIsImportOptionsDialogOpen}
        onConfirm={handleImportOptionsConfirm}
        templateName={pendingImportData?.fileName || ""}
        hasFormatTemplate={pendingImportData?.hasFormatTemplate || false}
        hasLorebooks={pendingImportData?.hasLorebooks || false}
        lorebookCount={pendingImportData?.lorebookCount || 0}
      />
    </div>
  );
};

export default WidgetConfig;
