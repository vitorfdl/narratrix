import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { getRoleIcon } from "./CustomPromptModal";

interface CustomPromptsListProps {
  prompts: ChatTemplateCustomPrompt[];
  onEdit: (promptId: string) => void;
  onDelete: (promptId: string) => void;
  onReorder?: (newPrompts: ChatTemplateCustomPrompt[]) => void;
  onToggleEnabled?: (promptId: string, enabled: boolean) => void;
  disabled?: boolean;
}

interface SortablePromptItemProps {
  prompt: ChatTemplateCustomPrompt;
  onEdit: (promptId: string) => void;
  onDelete: (promptId: string) => void;
  onToggleEnabled?: (promptId: string, enabled: boolean) => void;
  disabled?: boolean;
}

const SortablePromptItem = ({ prompt, onEdit, onDelete, onToggleEnabled, disabled }: SortablePromptItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prompt.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`bg-foreground/5 flex items-center gap-2 p-0.5 mb-1 border-none ${isDragging ? "shadow-lg opacity-80 border-primary" : ""} ${!prompt.enabled ? "opacity-60" : ""}`}
    >
      <div {...attributes} {...listeners} className={`${disabled ? "cursor-not-allowed" : "cursor-grab"} touch-none`}>
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="text-muted-foreground">{getRoleIcon(prompt.role)}</div>
        <span className={`text-xs font-medium flex-1 truncate ${!prompt.enabled ? "text-muted-foreground" : ""}`}>{prompt.name}</span>
      </div>

      <div className="flex items-center gap-1">
        <Switch
          checked={prompt.enabled}
          onCheckedChange={(checked) => onToggleEnabled?.(prompt.id, checked)}
          disabled={disabled}
          size="sm"
          className="mr-1"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(prompt.id)} disabled={disabled}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(prompt.id)} disabled={disabled}>
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
};

export function CustomPromptsList({ prompts, onEdit, onDelete, onReorder, onToggleEnabled, disabled }: CustomPromptsListProps) {
  const [items, setItems] = useState<ChatTemplateCustomPrompt[]>(prompts);

  // Update local state when props change
  useEffect(() => {
    setItems(prompts);
  }, [prompts]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Activate only from the drag handle
      activationConstraint: {
        distance: 5, // Minimum distance required before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) {
      return;
    }

    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id);
        const newIndex = currentItems.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(currentItems, oldIndex, newIndex);

        // Call onReorder if provided
        onReorder?.(newItems);

        return newItems;
      });
    }
  };

  return (
    <div className={`w-full ${disabled ? "opacity-70" : ""}`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((prompt) => (
              <SortablePromptItem
                key={prompt.id}
                prompt={prompt}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleEnabled={onToggleEnabled}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
