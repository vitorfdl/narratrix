import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormatTemplate, useTemplateActions } from "@/hooks/templateStore";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { SYSTEM_PROMPT_DEFAULT_CONTENT, SYSTEM_PROMPT_TYPES, SystemPromptSection, SystemPromptType } from "@/schema/template-format-schema";
import { estimateTokens } from "@/services/inference-steps/apply-context-limit";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Paperclip, Plus, SeparatorVertical, Trash } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import "../styles/shared.css";

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

  // Local state for the content being edited
  const [localContent, setLocalContent] = useState(prompt.content);

  // Debounce the call to the parent update function for content changes
  const debouncedParentUpdate = useDebouncedCallback((newContent: string) => {
    onUpdate(prompt.id, { content: newContent });
  }, 300); // 300ms debounce, adjust as needed

  // Update local state immediately, debounce parent update
  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    debouncedParentUpdate(newContent);
  };

  // Effect to sync local state if the prop changes from outside (e.g., initial load, reset)
  // Avoids infinite loops by checking if content actually differs
  useEffect(() => {
    if (prompt.content !== localContent) {
      setLocalContent(prompt.content);
      // Cancel any pending debounced updates if the prop changes externally
      debouncedParentUpdate.cancel();
    }
    // Only run this effect if prompt.content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.content]);

  // Handler for UI changes (like collapse) that should update parent immediately
  const handleCollapseToggle = () => {
    onUpdate(prompt.id, { isCollapsed: !prompt.isCollapsed });
  };

  // Format name helper
  const formatName = (name: string) => {
    return name
      .replace(/-/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Card ref={setNodeRef} style={{ ...style, backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
      <CardContent className="px-1 py-0 space-y-1 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div {...attributes} {...listeners} className={disabled ? "cursor-not-allowed" : "cursor-grab"}>
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={handleCollapseToggle}>
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
            <div className="mb-2 mr-1 ml-1 md:text-xs xl:text-sm">
              <MarkdownTextArea
                key={prompt.id}
                initialValue={localContent}
                onChange={handleContentChange}
                className=" overflow-y-auto max-h-[400px]"
                suggestions={promptReplacementSuggestionList}
                editable={!disabled}
              />
              <div className="flex items-center justify-between">
                <div />
                <span className="text-xs text-muted-foreground p-0.5">{estimateTokens(localContent, 0)} tokens</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SystemPromptSectionProps {
  formatTemplateID: string | null;
}

export function SystemPromptTemplateSection({ formatTemplateID }: SystemPromptSectionProps) {
  const currentTemplate = useFormatTemplate(formatTemplateID ?? "");
  const { updateFormatTemplate } = useTemplateActions();

  // const profile = useProfile();

  // Local state for UI
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [contextSeparator, setContextSeparator] = useState("");
  const [lorebookSeparator, setLorebookSeparator] = useState("");

  const isDisabled = !formatTemplateID;

  // Transform template sections to UI items when template changes
  useEffect(() => {
    if (!currentTemplate) {
      setPrompts([]);
      setContextSeparator("\n---\n");
      setLorebookSeparator("\n---\n");
      return;
    }

    // Set separators from template
    setContextSeparator(currentTemplate.config.context_separator);
    setLorebookSeparator(currentTemplate.config.lorebook_separator);

    // Transform sections to items with UI state while preserving collapse state
    const items = currentTemplate.prompts.map((section, index) => {
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
    if (!formatTemplateID || !currentTemplate || isDisabled) {
      return;
    }

    // Convert UI items back to the schema format
    const config = prompts.map(({ type, content }) => ({
      type,
      content,
    }));

    try {
      await updateFormatTemplate(formatTemplateID, {
        prompts: config,
        config: {
          ...currentTemplate.config,
          context_separator: contextSeparator,
          lorebook_separator: lorebookSeparator,
        },
      });
    } catch (error) {
      console.error("Failed to update template:", error);
    }
  }, 120);

  // Handle adding a new prompt section
  const handleAddPrompt = useCallback(
    (type: SystemPromptType) => {
      if (isDisabled) {
        return;
      }

      const newPrompt: PromptItem = {
        id: crypto.randomUUID(),
        type,
        content: SYSTEM_PROMPT_DEFAULT_CONTENT[type],
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
          // Use the debouncedUpdate directly without setTimeout to prevent race conditions
          debouncedUpdate();
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

  // Handle separator changes
  const handleContextSeparatorChange = useCallback((value: string) => {
    setContextSeparator(value);
  }, []);

  const handleLorebookSeparatorChange = useCallback((value: string) => {
    setLorebookSeparator(value);
  }, []);

  // Debounced effect for separators
  useEffect(() => {
    if (isDisabled || !formatTemplateID || !currentTemplate) {
      return;
    }
    const handler = setTimeout(() => {
      updateFormatTemplate(formatTemplateID, {
        prompts: prompts.map(({ type, content }) => ({ type, content })),
        config: {
          ...currentTemplate.config,
          context_separator: contextSeparator,
          lorebook_separator: lorebookSeparator,
        },
      }).catch((error) => {
        console.error("Failed to update template:", error);
      });
    }, 400); // 400ms debounce
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextSeparator, lorebookSeparator]);

  // Filter available types that are not already used
  const availableTypes = useMemo(() => SYSTEM_PROMPT_TYPES.filter((type) => !prompts.some((prompt) => prompt.type === type)), [prompts.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inference-section-header flex items-center gap-1 pb-2 border-b ">
          <div className="flex items-center gap-1">
            <Paperclip className="h-5 w-5" /> System Prompts
            <HelpTooltip>
              <p>
                Define the AI's core behavior and instructions using System Prompts. Multiple prompts added here are automatically combined into a
                single system message sent to the AI.
              </p>
              <br />
              <p>
                <strong>Context-specific prompts</strong> (like 'character-context', 'chapter-context', 'user-context') are only included if the
                relevant information (e.g., active character, chapter scenario, user persona) is available in the current chat configuration.
              </p>
            </HelpTooltip>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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

        <Card className="mt-4">
          <CardHeader className="template-card-header">
            <CardTitle className="template-card-title">
              <SeparatorVertical className="h-4 w-4" /> Separators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="context-separator">Context Separator</Label>
                <Input
                  value={contextSeparator}
                  placeholder={"\n\n"}
                  onChange={(e) => handleContextSeparatorChange(e.target.value)}
                  onBlur={() => debouncedUpdate()}
                  key={`context-separator-${formatTemplateID}`}
                  className="w-full resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Separator used between different context sections</p>
              </div>
              <div>
                <Label htmlFor="lorebook-separator">Lorebook Separator</Label>
                <Input
                  value={lorebookSeparator}
                  placeholder={"\n---\n"}
                  onChange={(e) => handleLorebookSeparatorChange(e.target.value)}
                  onBlur={() => debouncedUpdate()}
                  key={`lorebook-separator-${formatTemplateID}`}
                  className="w-full resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Separator used between different lorebook entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
