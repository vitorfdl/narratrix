import { BorderBeam } from "@/components/magicui/border-beam";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatMessages, useCurrentChatParticipants, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useImageUrl } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { CharacterForm } from "@/pages/characters/components/AddCharacterForm";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { Character } from "@/schema/characters-schema";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, PlayCircleIcon, Settings, StopCircleIcon, Trash2, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
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
}

interface SortableParticipantProps {
  participant: Participant;
  onToggleParticipant?: (id: string) => void;
  onTriggerMessage?: (id: string) => void;
  onRemoveParticipant?: (id: string) => void;
  inInferenceQueue: boolean;
  setIsEditCharacterModalOpen: (characterId: string) => void;
}

const SortableParticipant: React.FC<SortableParticipantProps> = ({
  participant,
  onToggleParticipant,
  onTriggerMessage,
  onRemoveParticipant,
  inInferenceQueue,
  setIsEditCharacterModalOpen,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: participant.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleAvatarClick = () => {
    if (participant.type === "character") {
      setIsEditCharacterModalOpen(participant.id);
    }
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
        <Avatar
          onClick={handleAvatarClick}
          className={cn("w-8 h-8", participant.type !== "user" && "cursor-pointer", !participant.isEnabled && "opacity-50")}
        >
          <AvatarImage className="object-cover rounded-full" src={participant.avatar} alt={participant.name} />
          <AvatarFallback className="bg-secondary">{participant.name[0]}</AvatarFallback>
        </Avatar>
      </div>

      {/* Column 2: Content and Actions */}
      <div className={cn("flex flex-col min-w-0 flex-1", participant.type !== "user" && !participant.isEnabled && "opacity-70")}>
        {/* Row 1: Name */}
        <div className="flex items-center justify-between gap-1">
          <div className="font-normal truncate text-sm">{participant.name}</div>
          {participant.type !== "user" && (
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5"
              disabled={!participant.isEnabled}
              onClick={() => onTriggerMessage?.(participant.id)}
              title="Trigger Message"
            >
              {inInferenceQueue ? (
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 0, 0, 0, 0, -10, 10, -10, 10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                >
                  <StopCircleIcon className="!h-5 !w-5 text-destructive" />
                </motion.div>
              ) : (
                <PlayCircleIcon className="!h-5 !w-5" />
              )}
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

        {/* Row 2: User Character if it exists */}
        {participant.type === "user" && (
          <div className="flex items-center justify-between mt-0 text-xs">
            <div className="text-[0.6rem] text-muted-foreground capitalize truncate">You</div>
            <div className="text-[0.6rem] capitalize truncate text-muted-foreground justify-between">{participant.type}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const WidgetParticipants: React.FC<WidgetParticipantsProps> = ({ onOpenConfig }) => {
  const characterList = useCharacters();
  const currentProfile = useCurrentProfile();
  const { url: currentProfileAvatarUrl } = useImageUrl(currentProfile?.avatar_path);
  const [isEditCharacterModalOpen, setIsEditCharacterModalOpen] = useState<string | null>(null);

  const messages = useCurrentChatMessages();
  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const participants = useCurrentChatParticipants() || [];
  const { addParticipant, removeParticipant, toggleParticipantEnabled, updateSelectedChat } = useChatActions();

  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const inferenceService = useInferenceServiceFromContext();
  // Get user character if it exists
  const userCharacter = currentChatUserCharacterID ? characterList.find((char) => char.id === currentChatUserCharacterID) : null;

  const { urlMap: avatarUrlMap } = useCharacterAvatars();

  // Map chat participants to the Participant interface for this component
  const mappedParticipants: Participant[] = participants.map((p) => {
    // Find the associated character
    const associatedCharacter = characterList.find((char) => char.id === p.id);

    const type = (associatedCharacter?.type as "character" | "agent") || "character";

    // Get avatar from the associated character
    const avatar = avatarUrlMap[associatedCharacter?.id || ""];

    return {
      id: p.id,
      name: associatedCharacter?.name || "Unknown",
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
          name: userCharacter?.name || currentProfile!.name,
          type: "user" as const,
          isEnabled: true,
          avatar: avatarUrlMap[userCharacter?.id || ""] || currentProfileAvatarUrl!,
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

  const handleTriggerMessage = useCallback(
    async (participantId: string) => {
      // Don't allow triggering for user or if already in progress
      if (participantId === "user") {
        return;
      }

      if (inferenceService.getStreamingState().characterId === participantId) {
        inferenceService.cancelGeneration();
        return;
      }

      try {
        // Find the associated character
        const character = characterList.find((char) => char.id === participantId);
        if (!character) {
          console.error("Character not found");
          return;
        }

        // Use the inference service to generate a message
        await inferenceService.generateMessage({
          characterId: participantId,
        });
      } catch (error) {
        console.error("Error triggering message:", error);
        // Remove from triggering list if there was an error
      }
    },
    [characterList, messages, inferenceService],
  );

  const streamingState = inferenceService.getStreamingState();
  const isInQueue = (participantId: string) =>
    (streamingState.characterId === participantId && streamingState.messageId !== "generate-input-area") ||
    (participantId === "user" && streamingState.messageId === "generate-input-area");

  return (
    <div className="flex flex-col h-full bg-none">
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
                  onTriggerMessage={handleTriggerMessage}
                  onRemoveParticipant={handleRemoveParticipant}
                  inInferenceQueue={isInQueue(participant.id)}
                  setIsEditCharacterModalOpen={setIsEditCharacterModalOpen}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Footer */}
      <div className="py-0 px-1 border-t flex justify-start gap-2">
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
        {/* TODO: Add settings support */}
        <Button disabled variant="ghost" size="icon" onClick={onOpenConfig} title="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Edit Character Dialog */}
      <CharacterForm
        open={isEditCharacterModalOpen !== null}
        onOpenChange={(open: boolean) => setIsEditCharacterModalOpen(open ? isEditCharacterModalOpen : null)}
        mode="edit"
        initialData={characterList.find((char) => char.id === isEditCharacterModalOpen) as Character}
        setIsEditing={() => {}}
        onSuccess={() => {
          setIsEditCharacterModalOpen(null);
          // Optionally refresh the character data
        }}
      />
    </div>
  );
};

export default WidgetParticipants;
