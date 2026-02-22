import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { LuBot, LuCirclePlay, LuCircleStop, LuCpu, LuGripVertical, LuSettings, LuSparkles, LuTrash2, LuUserPlus, LuZap } from "react-icons/lu";
import { toast } from "sonner";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAgents } from "@/hooks/agentStore";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatId, useCurrentChatMessages, useCurrentChatParticipants, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useAgentWorkflow } from "@/hooks/useAgentWorkflow";
import { useInferenceServiceFromContext } from "@/hooks/useChatInference";
import { useImageUrl } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { CharacterForm } from "@/pages/characters/components/AddCharacterForm";
import { Character } from "@/schema/characters-schema";
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
  setIsEditAgentModalOpen: (agentId: string) => void;
}

const SortableParticipant: React.FC<SortableParticipantProps> = ({
  participant,
  onToggleParticipant,
  onTriggerMessage,
  onRemoveParticipant,
  inInferenceQueue,
  setIsEditCharacterModalOpen,
  setIsEditAgentModalOpen,
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
    } else if (participant.type === "agent") {
      setIsEditAgentModalOpen(participant.id);
    }
  };

  // Agent icon variations for visual interest
  const agentIcons = [LuBot, LuCpu, LuZap];
  const AgentIcon = agentIcons[participant.id.charCodeAt(0) % agentIcons.length];

  const getAvatarContent = () => {
    if (participant.avatar) {
      return <AvatarImage className="object-cover rounded-full" src={participant.avatar} alt={participant.name} />;
    }

    if (participant.type === "agent") {
      return (
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 relative overflow-hidden rounded-none">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-primary/5 animate-pulse" />
          <AgentIcon className="h-4 w-4 text-primary relative z-10" />
          <LuSparkles className="absolute -top-1 -right-1 h-2 w-2 text-primary/60" />
        </AvatarFallback>
      );
    }

    return <AvatarFallback className="bg-secondary">{participant.name[0]}</AvatarFallback>;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 px-2 py-1 rounded-lg transition-colors min-w-0 relative overflow-hidden",
        participant.type !== "user" && !participant.isEnabled ? "bg-muted/30 text-muted-foreground" : "bg-muted/50 hover:bg-muted/80",
        participant.type === "agent" && participant.isEnabled && "bg-gradient-to-r from-primary/5 to-transparent",
      )}
    >
      {inInferenceQueue && <BorderBeam colorFrom="hsl(var(--primary))" size={60} duration={1.5} />}
      <div className="flex items-center gap-2 flex-shrink-0 justify-center self-center h-full">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex items-center">
          <LuGripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Avatar
          onClick={handleAvatarClick}
          className={cn(
            "w-8 h-8",
            participant.type !== "user" && "cursor-pointer hover:scale-110 transition-all duration-300",
            !participant.isEnabled && "opacity-50",
            participant.type === "agent" && "ring-1 ring-primary/20",
          )}
        >
          {getAvatarContent()}
        </Avatar>
      </div>

      {/* Column 2: Content and Actions */}
      <div className={cn("flex flex-col min-w-0 flex-1", participant.type !== "user" && !participant.isEnabled && "opacity-70")}>
        {/* Row 1: Name */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <div className="font-medium truncate text-xs">{participant.name}</div>
            {participant.type === "agent" && participant.isEnabled && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
                <LuSparkles className="h-3 w-3 text-primary/60 flex-shrink-0" />
              </motion.div>
            )}
          </div>
          {participant.type !== "user" && (
            <Button variant="ghost" size="icon" className="w-5 h-5" disabled={!participant.isEnabled} onClick={() => onTriggerMessage?.(participant.id)} title="Trigger Message">
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
                  <LuCircleStop className="!h-5 !w-5 text-destructive" />
                </motion.div>
              ) : (
                <LuCirclePlay className="!h-5 !w-5" />
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
              <Button variant="ghost" size="icon" className="w-4 h-4 hover:text-destructive" onClick={() => onRemoveParticipant?.(participant.id)} title="Remove">
                <LuTrash2 className="!h-3 !w-3" />
              </Button>
            </div>
            <div className={cn("text-xxs capitalize truncate flex items-center gap-1", participant.type === "agent" ? "text-primary/80 font-medium" : "text-muted-foreground")}>{participant.type}</div>
          </div>
        )}

        {/* Row 2: User Character if it exists */}
        {participant.type === "user" && (
          <div className="flex items-center justify-between mt-0 text-xs">
            <div className="text-xxs text-muted-foreground capitalize truncate">You</div>
            <div className="text-xxs capitalize truncate text-muted-foreground justify-between">{participant.type}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const WidgetParticipants: React.FC<WidgetParticipantsProps> = ({ onOpenConfig }) => {
  const characterList = useCharacters();
  const agentList = useAgents();
  const currentProfile = useCurrentProfile();
  const { url: currentProfileAvatarUrl } = useImageUrl(currentProfile?.avatar_path);
  const [isEditCharacterModalOpen, setIsEditCharacterModalOpen] = useState<string | null>(null);
  const [isEditAgentModalOpen, setIsEditAgentModalOpen] = useState<string | null>(null);

  const currentChatId = useCurrentChatId();
  const messages = useCurrentChatMessages();
  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const participants = useCurrentChatParticipants() || [];
  const { addParticipant, removeParticipant, toggleParticipantEnabled, updateSelectedChat } = useChatActions();

  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const inferenceService = useInferenceServiceFromContext();
  const { executeWorkflow: executeAgentWorkflow, workflowState } = useAgentWorkflow();

  const [streamingState, setStreamingState] = useState(() => inferenceService.getStreamingState(currentChatId));

  // Get user character if it exists
  const userCharacter = currentChatUserCharacterID ? characterList.find((char) => char.id === currentChatUserCharacterID) : null;

  const { urlMap: avatarUrlMap } = useCharacterAvatars();

  useEffect(() => {
    const unsubscribe = inferenceService.subscribeToStateChanges((newState) => {
      setStreamingState(newState);
    }, currentChatId);

    setStreamingState(inferenceService.getStreamingState(currentChatId));

    return unsubscribe;
  }, [inferenceService, currentChatId]);

  // Map chat participants to the Participant interface for this component
  const mappedParticipants: Participant[] = participants.map((p) => {
    // Find the associated character or agent
    const associatedCharacter = characterList.find((char) => char.id === p.id);
    const associatedAgent = agentList.find((agent) => agent.id === p.id);

    // Determine the type and get the appropriate data
    let name = "Unknown";
    let type: "character" | "agent" = "character";
    let avatar = "";

    if (associatedCharacter) {
      name = associatedCharacter.name;
      type = "character";
      avatar = avatarUrlMap[associatedCharacter.id] || "";
    } else if (associatedAgent) {
      name = associatedAgent.name;
      type = "agent";
      avatar = ""; // Agents don't have avatars currently
    }

    return {
      id: p.id,
      name,
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before activating
      },
    }),
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

  const handleAddParticipant = (participantId: string) => {
    // Add participant to chat
    addParticipant({
      id: participantId,
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

      if (streamingState.characterId === participantId) {
        inferenceService.cancelGeneration(currentChatId);
        return;
      }

      try {
        // Find the associated character or agent
        const character = characterList.find((char) => char.id === participantId);
        const agent = agentList.find((agent) => agent.id === participantId);

        if (!character && !agent) {
          console.error("Character or agent not found");
          return;
        }

        if (agent) {
          // Execute agent workflow
          console.log("Executing agent workflow:", agent.name);

          try {
            const result = await executeAgentWorkflow(
              agent,
              "", // No initial input for now
              (nodeId, result) => {
                console.log(`Node ${nodeId} executed:`, result);
              },
            );

            if (result) {
              console.log("Agent workflow completed with result:", result);
              toast.success(`Agent ${agent.name} completed successfully`);
            } else {
              console.log("Agent workflow completed with no output");
              toast.success(`Agent ${agent.name} completed`);
            }
          } catch (error) {
            console.error("Agent workflow execution failed:", error);
            toast.error(`Agent ${agent.name} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        } else if (character) {
          await inferenceService.generateMessage({
            chatId: currentChatId,
            characterId: participantId,
          });
        }
      } catch (error) {
        console.error("Error triggering message:", error);
        toast.error(error instanceof Error ? error.message : "An unknown error occurred");
      }
    },
    [characterList, agentList, messages, inferenceService, streamingState.characterId, currentChatId],
  );

  const isInQueue = (participantId: string) => {
    // Check if character is in inference queue
    const inCharacterQueue =
      (streamingState.characterId === participantId && streamingState.messageId !== "generate-input-area") || (participantId === "user" && streamingState.messageId === "generate-input-area");

    // Check if agent is in workflow execution
    const agent = agentList.find((a) => a.id === participantId);
    const inAgentQueue = agent && workflowState.isRunning;

    return inCharacterQueue || inAgentQueue;
  };

  return (
    <div className="flex flex-col h-full bg-none">
      {/* Participants List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-0.5 custom-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          autoScroll={false}
          modifiers={[restrictToVerticalAxis, restrictToParentElement, restrictToFirstScrollableAncestor]}
        >
          <SortableContext items={displayedParticipants.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {displayedParticipants.map((participant) => (
                <SortableParticipant
                  key={participant.id}
                  participant={participant}
                  onToggleParticipant={handleToggleParticipant}
                  onTriggerMessage={handleTriggerMessage}
                  onRemoveParticipant={handleRemoveParticipant}
                  inInferenceQueue={isInQueue(participant.id) || false}
                  setIsEditCharacterModalOpen={setIsEditCharacterModalOpen}
                  setIsEditAgentModalOpen={setIsEditAgentModalOpen}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Footer */}
      <div className="py-0 px-1 border-t flex justify-start gap-2">
        <AddParticipantPopover isOpen={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen} onSelectCharacter={handleAddParticipant} existingParticipantIds={participants.map((p) => p.id)}>
          <Button variant="ghost" size="icon" title="Add Participant">
            <LuUserPlus className="h-4 w-4" />
          </Button>
        </AddParticipantPopover>
        {/* TODO: Add settings support */}
        <Button disabled variant="ghost" size="icon" onClick={onOpenConfig} title="Settings">
          <LuSettings className="h-4 w-4" />
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

      {/* TODO: Add Agent Edit Dialog when available */}
      {isEditAgentModalOpen && (
        <div className="hidden">
          {/* Placeholder for agent edit modal */}
          {/* This will be implemented when agent editing is available */}
        </div>
      )}
    </div>
  );
};

export default WidgetParticipants;
