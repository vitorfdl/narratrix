import { BorderBeam } from "@/components/magicui/border-beam";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/ProfileContext";
import { useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatParticipants, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { cn } from "@/lib/utils";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, PlayCircleIcon, Settings, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import AddParticipantPopover from "./AddParticipantPopover";

// Types
export interface Participant {
  id: string;
  name: string;
  type: "character" | "agent" | "user";
  avatar?: string;
  isEnabled?: boolean;
}

interface WidgetParticipantsProps {
  onOpenConfig?: () => void;
  inferenceQueue?: string[];
}

interface SortableParticipantProps {
  participant: Participant;
  onToggleParticipant?: (id: string) => void;
  onTriggerMessage?: (id: string) => void;
  onRemoveParticipant?: (id: string) => void;
  inInferenceQueue: boolean;
}

const SortableParticipant: React.FC<SortableParticipantProps> = ({
  participant,
  onToggleParticipant,
  onTriggerMessage,
  onRemoveParticipant,
  inInferenceQueue,
}) => {
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
      className={cn(
        "flex items-start gap-2 px-2 py-1 rounded-lg transition-colors min-w-0 relative overflow-hidden",
        participant.type !== "user" && !participant.isEnabled ? "bg-muted/30 text-muted-foreground" : "bg-muted/50 hover:bg-muted/80",
      )}
    >
      {inInferenceQueue && <BorderBeam colorFrom="hsl(var(--primary))" size={60} duration={1.5} />}
      <div className="flex items-center gap-2 flex-shrink-0 justify-center self-center h-full">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex items-center">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {participant.avatar ? (
          <img
            src={participant.avatar}
            alt={participant.name}
            className={`w-8 h-8 object-cover rounded-full ${participant.type !== "user" && !participant.isEnabled ? "opacity-50" : ""}`}
          />
        ) : (
          <div
            className={`w-8 h-8 rounded-full bg-secondary flex items-center justify-center ${
              participant.type !== "user" && !participant.isEnabled ? "opacity-50" : ""
            }`}
          >
            {participant.name[0]}
          </div>
        )}
      </div>

      {/* Column 2: Content and Actions */}
      <div className={cn("flex flex-col min-w-0 flex-1", participant.type !== "user" && !participant.isEnabled && "opacity-70")}>
        {/* Row 1: Name */}
        <div className="flex items-center justify-between gap-1">
          <div className="font-medium truncate text-xs">{participant.name}</div>
          {participant.type !== "user" && (
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5"
              disabled={!participant.isEnabled}
              onClick={() => onTriggerMessage?.(participant.id)}
              title="Trigger Message"
            >
              {inInferenceQueue ? <Loader2 className="!h-4 !w-4 animate-spin" /> : <PlayCircleIcon className="!h-4 !w-4" />}
            </Button>
          )}
        </div>

        {/* Row 2: Buttons and Type - Only for non-user types */}
        {participant.type !== "user" && (
          <div className="flex items-center justify-between mt-0 text-xs">
            <div className="flex items-center gap-3">
              <Switch
                checked={participant.isEnabled}
                onCheckedChange={() => onToggleParticipant?.(participant.id)}
                className="data-[state=checked]:bg-primary"
                aria-label={participant.isEnabled ? "Disable" : "Enable"}
                size={"xs"}
              />
              <Button
                variant="ghost"
                size="icon"
                className="w-4 h-4 hover:text-destructive"
                onClick={() => onRemoveParticipant?.(participant.id)}
                title="Remove"
              >
                <Trash2 className="!h-3 !w-3" />
              </Button>
            </div>
            <div className="text-[0.6rem] text-muted-foreground capitalize truncate">{participant.type}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const WidgetParticipants: React.FC<WidgetParticipantsProps> = ({ onOpenConfig, inferenceQueue = [] }) => {
  const characterList = useCharacters();
  const profile = useProfile();
  const profileAvatar = profile!.currentProfile!.avatar_path;

  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const participants = useCurrentChatParticipants();
  const { addParticipant, removeParticipant, toggleParticipantEnabled, updateSelectedChat } = useChatActions();

  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);

  // Get user character if it exists
  const userCharacter = currentChatUserCharacterID ? characterList.find((char) => char.id === currentChatUserCharacterID) : null;

  // Map chat participants to the Participant interface for this component
  const mappedParticipants: Participant[] = participants.map((p) => {
    // Find the associated character if it's a character or agent type
    const associatedCharacter = p.id !== "user" ? characterList.find((char) => char.id === p.id) : null;

    const type = p.id === "user" ? "user" : (associatedCharacter?.type as "character" | "agent") || "character";

    // For user, use character avatar if user character is set, otherwise use profile avatar
    const avatar =
      p.id === "user"
        ? userCharacter
          ? (userCharacter.avatar_path as string | undefined)
          : profileAvatar
        : (associatedCharacter?.avatar_path as string | undefined);

    return {
      id: p.id,
      name: p.id === "user" && userCharacter ? userCharacter.name : associatedCharacter?.name || (p.id === "user" ? "User" : "Unknown"),
      type,
      avatar,
      isEnabled: p.enabled,
    };
  });

  // If no user is in the participants, add one
  const hasUser = mappedParticipants.some((p) => p.id === "user");
  const displayedParticipants: Participant[] = hasUser
    ? mappedParticipants
    : [
        {
          id: "user",
          name: "User",
          type: "user" as const,
          isEnabled: true,
        },
        ...mappedParticipants,
      ];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = displayedParticipants.findIndex((item) => item.id === active.id);
      const newIndex = displayedParticipants.findIndex((item) => item.id === over.id);

      // Create a new order using arrayMove
      const newParticipantsOrder = arrayMove(displayedParticipants, oldIndex, newIndex);

      // Get the actual participants to update in the store (excluding visual-only participants)
      // and maintaining their original properties
      const currentParticipants = participants.slice();

      // Create a new array with the updated order
      const reorderedParticipants = newParticipantsOrder
        .filter((p) => p.id !== "user" || participants.some((storeP) => storeP.id === "user"))
        .map((p) => {
          // Find the original participant data
          const originalParticipant = currentParticipants.find((storeP) => storeP.id === p.id);
          // If found, return it, otherwise it's probably the user that's not in the store yet
          return (
            originalParticipant || {
              id: p.id,
              enabled: true,
              settings: {},
            }
          );
        });

      // Update the chat with the new participants order
      updateSelectedChat({
        participants: reorderedParticipants,
      });
    }
  };

  const handleAddParticipant = (characterId: string) => {
    // Add participant to chat
    addParticipant({
      id: characterId,
      enabled: true,
      settings: {},
    });

    setIsAddParticipantOpen(false);
  };

  const handleRemoveParticipant = (id: string) => {
    if (id !== "user") {
      removeParticipant(id);
    }
  };

  const handleToggleParticipant = (id: string) => {
    if (id !== "user") {
      toggleParticipantEnabled(id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Participants List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-0.5 custom-scrollbar">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={displayedParticipants.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {displayedParticipants.map((participant) => (
                <SortableParticipant
                  key={participant.id}
                  participant={participant}
                  onToggleParticipant={handleToggleParticipant}
                  onTriggerMessage={(id) => console.log("Trigger message for", id)}
                  onRemoveParticipant={handleRemoveParticipant}
                  inInferenceQueue={inferenceQueue.includes(participant.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Footer */}
      <div className="py-0.5 px-1 border-t flex justify-start gap-2">
        <AddParticipantPopover
          isOpen={isAddParticipantOpen}
          onOpenChange={setIsAddParticipantOpen}
          onSelectCharacter={handleAddParticipant}
          existingParticipantIds={participants.map((p) => p.id)}
        >
          <Button variant="ghost" size="icon" title="Add Participant">
            <UserPlus className="h-4 w-4" />
          </Button>
        </AddParticipantPopover>
        <Button variant="ghost" size="icon" onClick={onOpenConfig} title="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default WidgetParticipants;
