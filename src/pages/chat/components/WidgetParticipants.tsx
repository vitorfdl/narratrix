import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PlayIcon, Settings, Trash2, UserPlus } from "lucide-react";
import React, { useState } from "react";

// Types
export interface Participant {
  id: string;
  name: string;
  type: "character" | "agent" | "user";
  avatar?: string;
  isEnabled?: boolean;
}

interface WidgetParticipantsProps {
  participants?: Participant[];
  onAddParticipant?: () => void;
  onRemoveParticipant?: (id: string) => void;
  onToggleParticipant?: (id: string) => void;
  onTriggerMessage?: (id: string) => void;
  onOpenConfig?: () => void;
  onReorder?: (participants: Participant[]) => void;
}

interface SortableParticipantProps {
  participant: Participant;
  onToggleParticipant?: (id: string) => void;
  onTriggerMessage?: (id: string) => void;
  onRemoveParticipant?: (id: string) => void;
}

const SortableParticipant: React.FC<SortableParticipantProps> = ({ participant, onToggleParticipant, onTriggerMessage, onRemoveParticipant }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: participant.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center text-xs justify-between p-2 rounded-lg ${
        participant.type !== "user" && !participant.isEnabled ? "bg-muted/30 text-muted-foreground" : "bg-muted/50 hover:bg-muted/80"
      } transition-colors min-w-0`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {participant.avatar ? (
          <img
            src={participant.avatar}
            alt={participant.name}
            className={`w-8 h-8 object-cover rounded-full flex-shrink-0 ${participant.type !== "user" && !participant.isEnabled ? "opacity-50" : ""}`}
          />
        ) : (
          <div
            className={`w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 ${
              participant.type !== "user" && !participant.isEnabled ? "opacity-50" : ""
            }`}
          >
            {participant.name[0]}
          </div>
        )}
        <div className={`min-w-0 flex-1 ${participant.type !== "user" && !participant.isEnabled ? "opacity-70" : ""}`}>
          <div className="font-medium truncate">{participant.name}</div>
          <div className="text-[0.6rem] text-muted-foreground capitalize truncate">{participant.type}</div>
        </div>
      </div>

      {participant.type !== "user" && (
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <Switch
            checked={participant.isEnabled}
            onCheckedChange={() => onToggleParticipant?.(participant.id)}
            className="h-4 data-[state=checked]:bg-primary"
            aria-label={participant.isEnabled ? "Disable" : "Enable"}
            size={"sm"}
          />
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5"
            disabled={!participant.isEnabled}
            onClick={() => onTriggerMessage?.(participant.id)}
            title="Trigger Message"
          >
            <PlayIcon className="h-2 w-2" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5"
            disabled={!participant.isEnabled}
            onClick={() => onRemoveParticipant?.(participant.id)}
            title="Remove"
          >
            <Trash2 className="h-2 w-2" />
          </Button>
        </div>
      )}
    </div>
  );
};

const WidgetParticipants: React.FC<WidgetParticipantsProps> = ({
  participants = [],
  onAddParticipant,
  onRemoveParticipant,
  onToggleParticipant,
  onTriggerMessage,
  onOpenConfig,
  onReorder,
}) => {
  // Mock data for testing
  const mockParticipants: Participant[] = [
    { id: "1", name: "User", type: "user", avatar: "/avatars/vitor.png" },
    {
      id: "2",
      name: "Assistant",
      type: "agent",
      avatar: "/avatars/assistant.png",
      isEnabled: false,
    },
    {
      id: "3",
      name: "Character 1",
      type: "character",
      avatar: "/avatars/narratrixav.jpeg",
      isEnabled: true,
    },
  ];

  const [items, setItems] = useState<Participant[]>(participants.length > 0 ? participants : mockParticipants);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id);
        const newIndex = currentItems.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(currentItems, oldIndex, newIndex);
        onReorder?.(newItems);
        return newItems;
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Participants List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-0.5 custom-scrollbar">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {items.map((participant) => (
                <SortableParticipant
                  key={participant.id}
                  participant={participant}
                  onToggleParticipant={onToggleParticipant}
                  onTriggerMessage={onTriggerMessage}
                  onRemoveParticipant={onRemoveParticipant}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Footer */}
      <div className="py-0.5 px-1 border-t flex justify-start gap-2">
        <Button variant="ghost" size="icon" onClick={onAddParticipant} title="Add Participant">
          <UserPlus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenConfig} title="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default WidgetParticipants;
