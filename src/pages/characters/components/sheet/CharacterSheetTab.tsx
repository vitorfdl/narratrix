import { useState } from "react";
import { LuPencil, LuPencilOff } from "react-icons/lu";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { TemplatePicker } from "@/components/shared/TemplatePicker";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useCharacterSheetTemplate, useCharacterSheetTemplateList, useTemplateActions } from "@/hooks/templateStore";
import type { SheetSection, SheetValues } from "@/schema/template-character-sheet-schema";
import { SheetRenderer } from "./SheetRenderer";
import { SheetTemplateEditor } from "./SheetTemplateEditor";

interface CharacterSheetTabProps {
  templateId: string | null;
  onTemplateChange: (id: string | null) => void;
  values: SheetValues;
  onValuesChange: (values: SheetValues) => void;
  characterName?: string;
  scopeHint?: string;
}

export function CharacterSheetTab({ templateId, onTemplateChange, values, onValuesChange, characterName, scopeHint }: CharacterSheetTabProps) {
  const currentProfile = useCurrentProfile();
  const templates = useCharacterSheetTemplateList();
  const template = useCharacterSheetTemplate(templateId);
  const { createCharacterSheetTemplate, updateCharacterSheetTemplate, deleteCharacterSheetTemplate } = useTemplateActions();
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);

  const handleNewTemplate = async (name: string, sourceTemplateId?: string) => {
    try {
      const source = sourceTemplateId ? templates.find((t) => t.id === sourceTemplateId) : undefined;
      const newTemplate = await createCharacterSheetTemplate({
        name,
        profile_id: currentProfile!.id,
        favorite: false,
        sections: source ? structuredClone(source.sections) : [],
      });
      onTemplateChange(newTemplate.id);
      setIsEditingTemplate(true);
    } catch (error) {
      toast.error(`Failed to create sheet template: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const success = await deleteCharacterSheetTemplate(id);
    if (!success) {
      toast.error("Failed to delete sheet template");
      return;
    }
    if (templateId === id) {
      onTemplateChange(null);
      setIsEditingTemplate(false);
    }
  };

  const handleEditName = async (id: string, name: string) => {
    const updated = await updateCharacterSheetTemplate(id, { name });
    if (!updated) {
      toast.error("Failed to rename sheet template");
    }
  };

  const handleSectionsChange = async (sections: SheetSection[]) => {
    if (!templateId) {
      return;
    }
    const updated = await updateCharacterSheetTemplate(templateId, { sections });
    if (!updated) {
      toast.error("Failed to save sheet template changes");
    }
  };

  return (
    <div className="flex min-h-[200px] flex-col space-y-3 pb-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TemplatePicker
            templates={templates.map((t) => ({ id: t.id, name: t.name, favorite: t.favorite }))}
            selectedTemplateId={templateId}
            onTemplateSelect={(id) => {
              onTemplateChange(id);
              setIsEditingTemplate(false);
            }}
            onNewTemplate={handleNewTemplate}
            onDelete={handleDeleteTemplate}
            onEditName={handleEditName}
            clearable={true}
          />
        </div>
        {template && (
          <Button type="button" variant={isEditingTemplate ? "default" : "outline"} size="sm" className="h-8 px-3" onClick={() => setIsEditingTemplate((prev) => !prev)}>
            {isEditingTemplate ? <LuPencilOff className="!size-3.5" /> : <LuPencil className="!size-3.5" />}
            {isEditingTemplate ? "Done" : "Edit Template"}
          </Button>
        )}
        <HelpTooltip>
          <p>Template changes save immediately for all characters using it.{scopeHint ? " Values apply only to this chat, not the character's defaults." : ""}</p>
          <p>Drag sections or fields to move them, drag their right edge to resize, and click titles or labels to rename. Field keys appear beside labels.</p>
        </HelpTooltip>
      </div>

      {!template && (
        <div className="flex flex-grow items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Select or create a sheet template to define this character's sheet.
        </div>
      )}

      {template && isEditingTemplate && <SheetTemplateEditor sections={template.sections} onChange={handleSectionsChange} />}
      {template && !isEditingTemplate && <SheetRenderer sections={template.sections} values={values} onValuesChange={onValuesChange} characterName={characterName} />}
    </div>
  );
}
