import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { TemplatePicker } from "@/pages/formatTemplates/components/TemplatePicker";
import type { SectionField } from "@/schema/template-chat-settings-types";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { configFields } from "../manifests/configFields";
import { ConfigItem } from "./ConfigItems";
import { CustomPromptModal } from "./CustomPromptModal";
import { CustomPromptsList } from "./CustomPromptsList";

const WidgetConfig = () => {
  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [, setSelectedField] = useState<string>("");

  // Custom prompts state
  const [customPrompts, setCustomPrompts] = useState<ChatTemplateCustomPrompt[]>([]);
  const [isCustomPromptModalOpen, setIsCustomPromptModalOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  const availableFields = useMemo(() => {
    return configFields
      .filter((field) => !activeFields.includes(field.name))
      .map((field) => ({
        label: field.title,
        value: field.name,
      }));
  }, [activeFields]);

  const handleAddField = (fieldName: string) => {
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
    setActiveFields((prev) => prev.filter((f) => f !== fieldName));
    setValues((prev) => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleValueChange = (fieldName: string, newValue: any) => {
    setValues((prev) => ({
      ...prev,
      [fieldName]: newValue,
    }));
  };

  // Custom prompts handlers
  const handleAddCustomPrompt = () => {
    setEditingPromptId(null);
    setIsCustomPromptModalOpen(true);
  };

  const handleEditCustomPrompt = (promptId: string) => {
    setEditingPromptId(promptId);
    setIsCustomPromptModalOpen(true);
  };

  const handleDeleteCustomPrompt = (promptId: string) => {
    setCustomPrompts((prev) => prev.filter((p) => p.id !== promptId));
  };

  const handleSaveCustomPrompt = (prompt: ChatTemplateCustomPrompt) => {
    if (editingPromptId) {
      setCustomPrompts((prev) => prev.map((p) => (p.id === editingPromptId ? prompt : p)));
    } else {
      setCustomPrompts((prev) => [...prev, prompt]);
    }
    setEditingPromptId(null);
  };

  const handleReorderCustomPrompts = (reorderedPrompts: ChatTemplateCustomPrompt[]) => {
    setCustomPrompts(reorderedPrompts);
  };

  const getCustomPromptToEdit = () => {
    if (!editingPromptId) {
      return undefined;
    }
    return customPrompts.find((p) => p.id === editingPromptId);
  };

  return (
    <div className="space-y-1 p-1">
      <div className="space-y-1 mb-3">
        <TemplatePicker
          compact={true}
          templates={[
            { id: "none", name: "None" },
            { id: "default", name: "Default" },
          ]}
          selectedTemplateId="none"
          onTemplateSelect={() => {}}
          onDelete={() => {}}
          onNewTemplate={() => {}}
          onEditName={() => {}}
          onImport={() => {}}
          onExport={() => {}}
        />
      </div>
      <Separator className="my-2" />

      {/* Custom Prompts Section */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center py-2">
          <h3 className="text-sm font-normal my-auto">Custom Prompts</h3>
          <Button size="sm" variant="secondary" className="h-5" onClick={handleAddCustomPrompt}>
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
      <div className="flex justify-between items-center py-2">
        <h3 className="text-sm font-normal my-auto">Inference Settings</h3>
        <Combobox
          items={availableFields}
          onChange={(value) => {
            setSelectedField(value);
            handleAddField(value);
          }}
          trigger={
            <Button size="sm" variant="secondary" className="h-5">
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

          return (
            <ConfigItem
              key={fieldName}
              field={field}
              value={values[fieldName]}
              onChange={(newValue) => handleValueChange(fieldName, newValue)}
              onRemove={() => handleRemoveField(fieldName)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default WidgetConfig;
