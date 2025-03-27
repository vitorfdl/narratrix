import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { useProfile } from "@/hooks/ProfileContext";
import { usePromptTemplate, usePromptTemplateList, useTemplateActions } from "@/hooks/templateStore";
import { SYSTEM_PROMPT_TYPES, SystemPromptSection, SystemPromptType } from "@/schema/template-prompt-schema";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import "../styles/shared.css";
import { TemplatePicker } from "./TemplatePicker";

// Extended interface for prompt items with UI state
interface PromptItem extends SystemPromptSection {
  id: string;
  isCollapsed: boolean;
  name: string;
}

interface SystemPromptItemProps {
  prompt: PromptItem;
  onUpdate: (id: string, updates: Partial<PromptItem>) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}

function SystemPromptItem({ prompt, onUpdate, onDelete, disabled }: SystemPromptItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prompt.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : disabled ? 0.6 : 1,
  };

  // Remove "-" and capitalize the first letter of each word
  const formatName = (name: string) => {
    return name
      .replace(/-/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Card ref={setNodeRef} style={{ ...style, backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
      <CardContent className="px-1 py-0.5 space-y-1 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div {...attributes} {...listeners} className={disabled ? "cursor-not-allowed" : "cursor-grab"}>
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onUpdate(prompt.id, { isCollapsed: !prompt.isCollapsed })}>
              {prompt.isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <div className="font-medium text-sm">{formatName(prompt.name)}</div>
          </div>
          <Button variant="ghost" size="icon" disabled={disabled} onClick={() => onDelete(prompt.id)}>
            <Trash className="h-4 w-4" />
          </Button>
        </div>

        {!prompt.isCollapsed && (
          <div className="space-y-4">
            <div className="mb-2 mr-1 ml-1">
              <TipTapTextArea initialValue={prompt.content} onChange={(e) => onUpdate(prompt.id, { content: e })} editable={!disabled} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SystemPromptSectionProps {
  useGlobal: boolean;
  setUseGlobal: (useGlobal: boolean) => void;
  systemTemplateID: string | null;
  onTemplateChange: (templateId: string | null) => void;
}

export function SystemPromptTemplateSection({ systemTemplateID, onTemplateChange, useGlobal, setUseGlobal }: SystemPromptSectionProps) {
  // Memoize selectors to avoid recreating them on each render
  const promptTemplates = usePromptTemplateList();
  const { updatePromptTemplate, createPromptTemplate, deletePromptTemplate } = useTemplateActions();
  const currentTemplate = usePromptTemplate(systemTemplateID ?? "");

  const profile = useProfile();

  // Local state for UI
  const [prompts, setPrompts] = useState<PromptItem[]>([]);

  const isDisabled = !systemTemplateID || useGlobal;

  // Transform template sections to UI items when template changes
  useEffect(() => {
    if (!currentTemplate) {
      setPrompts([]);
      return;
    }

    // Transform sections to items with UI state while preserving collapse state
    const items = currentTemplate.config.map((section, index) => {
      // Try to find existing prompt to preserve collapse state
      const existingPrompt = prompts.find((p) => p.type === section.type);

      return {
        ...section,
        id: `${section.type}-${index}`,
        // Preserve collapse state if it exists, otherwise default to true
        isCollapsed: existingPrompt ? existingPrompt.isCollapsed : true,
        name: section.type
          .replace(/([A-Z])/g, " $1")
          .toLowerCase()
          .replace(/^./, (str: string) => str.toUpperCase()),
      };
    });

    setPrompts(items);
  }, [currentTemplate]);

  // Single debounced update that uses current prompts state
  const debouncedUpdate = useDebouncedCallback(async () => {
    if (!systemTemplateID || !currentTemplate || isDisabled) {
      return;
    }

    // Convert UI items back to the schema format
    const config = prompts.map(({ type, content }) => ({
      type,
      content,
    }));

    try {
      await updatePromptTemplate(systemTemplateID, { config });
    } catch (error) {
      console.error("Failed to update template:", error);
    }
  }, 500);

  // Handle adding a new prompt section
  const handleAddPrompt = useCallback(
    (type: SystemPromptType) => {
      if (isDisabled) {
        return;
      }

      const newPrompt: PromptItem = {
        id: crypto.randomUUID(),
        type,
        content: "",
        isCollapsed: false,
        name: type
          .replace(/([A-Z])/g, " $1")
          .toLowerCase()
          .replace(/^./, (str: string) => str.toUpperCase()),
      };

      // Update local state without triggering template update immediately
      setPrompts((prevPrompts) => {
        const updatedPrompts = [...prevPrompts, newPrompt];

        // Schedule update for after state change is complete
        setTimeout(() => debouncedUpdate(), 0);

        return updatedPrompts;
      });
    },
    [isDisabled, debouncedUpdate],
  );

  // Handle updating a prompt section
  const handleUpdatePrompt = useCallback(
    (id: string, updates: Partial<PromptItem>) => {
      if (isDisabled) {
        return;
      }

      setPrompts((prevPrompts) => {
        const updatedPrompts = prevPrompts.map((prompt) => (prompt.id === id ? { ...prompt, ...updates } : prompt));

        // Only trigger update if content changed, not for UI state changes
        if (updates.content !== undefined) {
          setTimeout(() => debouncedUpdate(), 0);
        }

        return updatedPrompts;
      });
    },
    [isDisabled, debouncedUpdate],
  );

  // Handle deleting a prompt section
  const handleDeletePrompt = useCallback(
    (id: string) => {
      if (isDisabled) {
        return;
      }

      setPrompts((prevPrompts) => {
        const updatedPrompts = prevPrompts.filter((prompt) => prompt.id !== id);

        // Schedule update for after state change is complete
        setTimeout(() => debouncedUpdate(), 0);

        return updatedPrompts;
      });
    },
    [isDisabled, debouncedUpdate],
  );

  // Handle reordering prompt sections
  const handleSystemPromptReorder = useCallback(
    (reorderedPrompts: PromptItem[]) => {
      if (isDisabled) {
        return;
      }

      setPrompts(reorderedPrompts);

      // Delay update to prevent UI refresh issues
      setTimeout(() => debouncedUpdate(), 0);
    },
    [isDisabled, debouncedUpdate],
  );

  // Filter available types that are not already used
  const availableTypes = useMemo(() => SYSTEM_PROMPT_TYPES.filter((type) => !prompts.some((prompt) => prompt.type === type)), [prompts.length]);

  // Template management handlers - memoized to prevent recreation
  const handleDeleteTemplate = useCallback(async () => {
    if (systemTemplateID) {
      // If deleting currently selected template, clear selection first
      onTemplateChange(null);
      await deletePromptTemplate(systemTemplateID);
    }
  }, [deletePromptTemplate, systemTemplateID, onTemplateChange]);

  const handleNewTemplate = useCallback(async () => {
    try {
      const newTemplate = await createPromptTemplate({
        name: "New Template",
        config: [],
        profile_id: profile?.currentProfile?.id ?? "",
      });

      // Auto-select the new template
      if (newTemplate) {
        onTemplateChange(newTemplate.id);
      }
    } catch (error) {
      console.error("Failed to create new template:", error);
    }
  }, [createPromptTemplate, onTemplateChange, profile?.currentProfile?.id]);

  const handleEditName = useCallback(async () => {
    try {
      if (!systemTemplateID) {
        return;
      }
      await updatePromptTemplate(systemTemplateID, { name: "New Template" });
    } catch (error) {
      console.error("Failed to update template name:", error);
    }
  }, [updatePromptTemplate, systemTemplateID]);

  const handleImportTemplate = useCallback(() => {
    // To be implemented
    console.log("Import template");
  }, []);

  const handleExportTemplate = useCallback(() => {
    // To be implemented
    console.log("Export template", systemTemplateID);
  }, [systemTemplateID]);

  // Memoize the checkbox change handler to prevent recreation on each render
  const handleGlobalCheckChange = useCallback(
    (checked: boolean) => {
      setUseGlobal(checked);
    },
    [setUseGlobal],
  );

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="inference-section-header">System Prompts</CardTitle>
        <div className="flex items-center space-x-2">
          <Checkbox id="useGlobal" checked={useGlobal} onCheckedChange={handleGlobalCheckChange} />
          <Label htmlFor="useGlobal" className="text-sm text-muted-foreground">
            Use Global
          </Label>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!useGlobal && (
          <div className="">
            <TemplatePicker
              templates={promptTemplates}
              selectedTemplateId={systemTemplateID}
              onTemplateSelect={onTemplateChange}
              onDelete={handleDeleteTemplate}
              onNewTemplate={handleNewTemplate}
              onEditName={handleEditName}
              onImport={handleImportTemplate}
              onExport={handleExportTemplate}
            />
          </div>
        )}

        <div className={`space-y-1 ${isDisabled ? "opacity-70" : ""}`}>
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={({ active, over }) => {
              if (!isDisabled && over && active.id !== over.id) {
                const oldIndex = prompts.findIndex((item) => item.id === active.id);
                const newIndex = prompts.findIndex((item) => item.id === over.id);

                const newItems = [...prompts];
                const [removed] = newItems.splice(oldIndex, 1);
                newItems.splice(newIndex, 0, removed);

                handleSystemPromptReorder(newItems);
              }
            }}
          >
            <SortableContext items={prompts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {prompts.map((prompt) => (
                <SystemPromptItem key={prompt.id} prompt={prompt} onUpdate={handleUpdatePrompt} onDelete={handleDeletePrompt} disabled={isDisabled} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {!isDisabled && availableTypes.length > 0 && (
          <div className="flex justify-center pt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-dashed border-2 hover:border-solid" disabled={isDisabled}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Section
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                {availableTypes.map((type) => (
                  <DropdownMenuItem key={type} onClick={() => handleAddPrompt(type as SystemPromptType)}>
                    {type
                      .replace(/([A-Z])/g, " $1")
                      .toLowerCase()
                      .replace(/^./, (str: string) => str.toUpperCase())}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
