import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { BiSolidZap } from "react-icons/bi";
import { LuCirclePlay, LuCircleStop, LuGripVertical, LuSettings, LuTrash2, LuUserPlus, LuZap } from "react-icons/lu";
import { toast } from "sonner";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAgents } from "@/hooks/agentStore";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatId, useCurrentChatParticipants, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { type AgentWorkflowState, useAgentWorkflow } from "@/hooks/useAgentWorkflow";
import { useInferenceServiceFromContext } from "@/hooks/useChatInference";
import { useImageUrl } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { CharacterForm } from "@/pages/characters/components/AddCharacterForm";
import type { AgentType } from "@/schema/agent-schema";
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

// ─── Shared DnD Wrapper ───────────────────────────────────────────────────────

interface SortableParticipantWrapperProps {
  id: string;
  children: React.ReactNode;
}

const SortableParticipantWrapper: React.FC<SortableParticipantWrapperProps> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-1.5 group/row">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex items-center flex-shrink-0 opacity-30 group-hover/row:opacity-70 transition-opacity">
        <LuGripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

// ─── User Card ────────────────────────────────────────────────────────────────

interface UserParticipantCardProps {
  participant: Participant;
}

const UserParticipantCard: React.FC<UserParticipantCardProps> = ({ participant }) => {
  return (
    <div className="flex items-center gap-2 px-2 h-9 rounded-lg bg-muted/30">
      <Avatar className="w-7 h-7 flex-shrink-0 rounded-md">
        {participant.avatar ? (
          <AvatarImage className="object-cover rounded-md" src={participant.avatar} alt={participant.name} />
        ) : (
          <AvatarFallback className="bg-secondary text-xs rounded-md">{participant.name[0]}</AvatarFallback>
        )}
      </Avatar>
      <span className="font-medium truncate text-xs flex-1 min-w-0">{participant.name}</span>
      <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 uppercase tracking-wider">You</span>
    </div>
  );
};

// ─── Character Card ───────────────────────────────────────────────────────────

interface CharacterParticipantCardProps {
  participant: Participant;
  inInferenceQueue: boolean;
  onToggle: (id: string) => void;
  onTrigger: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
}

const CharacterParticipantCard: React.FC<CharacterParticipantCardProps> = ({ participant, inInferenceQueue, onToggle, onTrigger, onRemove, onEdit }) => {
  const isEnabled = participant.isEnabled ?? true;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-1 h-9 rounded-lg transition-colors min-w-0 relative overflow-hidden group/char",
        isEnabled ? "bg-muted/50 hover:bg-muted/80" : "bg-muted/30 text-muted-foreground",
      )}
    >
      {inInferenceQueue && <BorderBeam colorFrom="hsl(var(--primary))" size={60} duration={1.5} />}

      <Avatar onClick={() => onEdit(participant.id)} className={cn("w-7 h-7 flex-shrink-0 rounded-xl cursor-pointer hover:scale-110 transition-all duration-200", !isEnabled && "opacity-50")}>
        {participant.avatar ? (
          <AvatarImage className="object-cover rounded-xl" src={participant.avatar} alt={participant.name} />
        ) : (
          <AvatarFallback className="bg-secondary text-xs rounded-xl">{participant.name[0]}</AvatarFallback>
        )}
      </Avatar>

      <span onClick={() => onEdit(participant.id)} className={cn("text-xs font-medium truncate flex-1 min-w-0 cursor-pointer", !isEnabled && "opacity-60")}>
        {participant.name}
      </span>

      {/* Hover controls */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/char:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="w-5 h-5 hover:text-destructive" onClick={() => onRemove(participant.id)} title="Remove">
          <LuTrash2 className="!h-3 !w-3" />
        </Button>
        <Switch checked={isEnabled} onCheckedChange={() => onToggle(participant.id)} className="data-[state=checked]:bg-primary" aria-label={isEnabled ? "Disable" : "Enable"} size={"xs"} />
      </div>

      {/* Play/Stop — always visible */}
      <Button variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0" disabled={!isEnabled} onClick={() => onTrigger(participant.id)} title="Trigger Message">
        {inInferenceQueue ? (
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.2, 1], rotate: [0, 0, 0, 0, 0, -10, 10, -10, 10, 0] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            <LuCircleStop className="!h-4 !w-4 text-destructive" />
          </motion.div>
        ) : (
          <LuCirclePlay className="!h-5 !w-5" />
        )}
      </Button>
    </div>
  );
};

// ─── Agent Card ───────────────────────────────────────────────────────────────

type TriggerType = "manual" | "every_message" | "scheduled";

const TRIGGER_LABEL: Record<TriggerType, string> = {
  manual: "Manual",
  every_message: "Auto",
  scheduled: "Timed",
};

interface AgentParticipantCardProps {
  participant: Participant;
  agent: AgentType;
  workflowState: AgentWorkflowState;
  inQueue: boolean;
  onToggle: (id: string) => void;
  onTrigger: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
}

const AgentParticipantCard: React.FC<AgentParticipantCardProps> = ({ participant, agent, workflowState, inQueue, onToggle, onTrigger, onRemove, onEdit }) => {
  const isEnabled = participant.isEnabled ?? true;
  const triggerType: TriggerType = (agent.settings?.run_on?.type as TriggerType) ?? "manual";
  const triggerLabel = TRIGGER_LABEL[triggerType] ?? TRIGGER_LABEL.manual;
  const isRunning = workflowState.isRunning && inQueue;

  const nodeCount = agent.nodes?.length ?? 0;
  const executedCount = workflowState.executedNodes.length;
  const progressPct = nodeCount > 0 ? Math.round((executedCount / nodeCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-0.5 group/agent">
      {/* Single-row chip */}
      <div
        className={cn(
          "flex items-center gap-1.5 h-9 pl-2 pr-1 rounded-md border border-dashed transition-all min-w-0 relative overflow-hidden",
          isEnabled ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-muted-foreground/20 bg-muted/20 opacity-60",
          isRunning && "border-primary border-solid bg-primary/10",
        )}
      >
        {isRunning && <BorderBeam colorFrom="hsl(var(--primary))" size={50} duration={1} />}

        {/* Bot icon — clickable to edit */}
        <BiSolidZap onClick={() => onEdit(participant.id)} className={cn("h-3.5 w-3.5 flex-shrink-0 cursor-pointer", isEnabled ? "text-primary" : "text-muted-foreground")} />

        {/* Name */}
        <span onClick={() => onEdit(participant.id)} className={cn("text-xs font-medium truncate cursor-pointer flex-1 min-w-0", !isEnabled && "text-muted-foreground")}>
          {participant.name}
        </span>

        {/* Trigger label — subtle, always visible */}
        <span className="text-[10px] text-muted-foreground/70 flex-shrink-0 uppercase tracking-wider">{triggerLabel}</span>

        {/* Hover controls: toggle + delete */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/agent:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="w-5 h-5 hover:text-destructive" onClick={() => onRemove(participant.id)} title="Remove">
            <LuTrash2 className="!h-3 !w-3" />
          </Button>
          <Switch checked={isEnabled} onCheckedChange={() => onToggle(participant.id)} className="data-[state=checked]:bg-primary" aria-label={isEnabled ? "Disable" : "Enable"} size={"xs"} />
        </div>

        {/* Play/Stop — always visible */}
        <Button variant="ghost" size="icon" className="w-6 h-6 flex-shrink-0" disabled={!isEnabled} onClick={() => onTrigger(participant.id)} title={isRunning ? "Stop Agent" : "Run Agent"}>
          {isRunning ? (
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}>
              <LuCircleStop className="!h-4 !w-4 text-destructive" />
            </motion.div>
          ) : (
            <LuCirclePlay className="!h-4 !w-4" />
          )}
        </Button>
      </div>

      {/* Progress bar — only when running */}
      {isRunning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-1">
          <div className="h-0.5 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3 }} />
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Widget ──────────────────────────────────────────────────────────────

const WidgetParticipants: React.FC<WidgetParticipantsProps> = ({ onOpenConfig }) => {
  const characterList = useCharacters();
  const agentList = useAgents();
  const currentProfile = useCurrentProfile();
  const { url: currentProfileAvatarUrl } = useImageUrl(currentProfile?.avatar_path);
  const [isEditCharacterModalOpen, setIsEditCharacterModalOpen] = useState<string | null>(null);
  const [isEditAgentModalOpen, setIsEditAgentModalOpen] = useState<string | null>(null);

  const currentChatId = useCurrentChatId();
  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const participants = useCurrentChatParticipants() || [];
  const { addParticipant, removeParticipant, toggleParticipantEnabled, updateSelectedChat } = useChatActions();

  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const inferenceService = useInferenceServiceFromContext();
  const { executeWorkflow: executeAgentWorkflow, workflowState } = useAgentWorkflow();

  const [streamingState, setStreamingState] = useState(() => inferenceService.getStreamingState(currentChatId));

  const userCharacter = currentChatUserCharacterID ? characterList.find((char) => char.id === currentChatUserCharacterID) : null;
  const { urlMap: avatarUrlMap } = useCharacterAvatars();

  useEffect(() => {
    const unsubscribe = inferenceService.subscribeToStateChanges((newState) => {
      setStreamingState(newState);
    }, currentChatId);

    setStreamingState(inferenceService.getStreamingState(currentChatId));

    return unsubscribe;
  }, [inferenceService, currentChatId]);

  const mappedParticipants: Participant[] = participants.map((p) => {
    const associatedCharacter = characterList.find((char) => char.id === p.id);
    const associatedAgent = agentList.find((agent) => agent.id === p.id);

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
      avatar = "";
    }

    return { id: p.id, name, type, avatar, isEnabled: p.enabled };
  });

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = displayedParticipants.findIndex((item) => item.id === active.id);
      const newIndex = displayedParticipants.findIndex((item) => item.id === over.id);
      const newParticipantsOrder = arrayMove(displayedParticipants, oldIndex, newIndex);
      const currentParticipants = participants.slice();
      const reorderedParticipants = newParticipantsOrder
        .filter((p) => p.id !== "user" || participants.some((storeP) => storeP.id === "user"))
        .map((p) => currentParticipants.find((storeP) => storeP.id === p.id) || { id: p.id, enabled: true, settings: {} });
      updateSelectedChat({ participants: reorderedParticipants });
    }
  };

  const handleAddParticipant = (participantId: string) => {
    addParticipant({ id: participantId, enabled: true, settings: {} });
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
      if (participantId === "user") {
        return;
      }

      if (streamingState.characterId === participantId) {
        inferenceService.cancelGeneration(currentChatId);
        return;
      }

      try {
        const character = characterList.find((char) => char.id === participantId);
        const agent = agentList.find((a) => a.id === participantId);

        if (!character && !agent) {
          console.error("Character or agent not found");
          return;
        }

        if (agent) {
          if (workflowState.isRunning) {
            return;
          }
          try {
            const result = await executeAgentWorkflow(agent, "", (nodeId, result) => {
              console.log(`Node ${nodeId} executed:`, result);
            });
            if (result) {
              toast.success(`Agent ${agent.name} completed successfully`);
            } else {
              toast.success(`Agent ${agent.name} completed`);
            }
          } catch (error) {
            toast.error(`Agent ${agent.name} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        } else if (character) {
          await inferenceService.generateMessage({ chatId: currentChatId, characterId: participantId });
        }
      } catch (error) {
        console.error("Error triggering message:", error);
        toast.error(error instanceof Error ? error.message : "An unknown error occurred");
      }
    },
    [characterList, agentList, inferenceService, streamingState.characterId, currentChatId, workflowState.isRunning, executeAgentWorkflow],
  );

  const isInQueue = (participantId: string): boolean => {
    const inCharacterQueue =
      (streamingState.characterId === participantId && streamingState.messageId !== "generate-input-area") || (participantId === "user" && streamingState.messageId === "generate-input-area");
    const agent = agentList.find((a) => a.id === participantId);
    const inAgentQueue = !!(agent && workflowState.isRunning);
    return inCharacterQueue || inAgentQueue;
  };

  const renderParticipantCard = (participant: Participant) => {
    const inQueue = isInQueue(participant.id);

    if (participant.type === "user") {
      return <UserParticipantCard participant={participant} />;
    }

    if (participant.type === "character") {
      return (
        <CharacterParticipantCard
          participant={participant}
          inInferenceQueue={inQueue}
          onToggle={handleToggleParticipant}
          onTrigger={handleTriggerMessage}
          onRemove={handleRemoveParticipant}
          onEdit={setIsEditCharacterModalOpen}
        />
      );
    }

    if (participant.type === "agent") {
      const agent = agentList.find((a) => a.id === participant.id);
      if (!agent) {
        return null;
      }
      return (
        <AgentParticipantCard
          participant={participant}
          agent={agent}
          workflowState={workflowState}
          inQueue={inQueue}
          onToggle={handleToggleParticipant}
          onTrigger={handleTriggerMessage}
          onRemove={handleRemoveParticipant}
          onEdit={setIsEditAgentModalOpen}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-none">
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
                <SortableParticipantWrapper key={participant.id} id={participant.id}>
                  {renderParticipantCard(participant)}
                </SortableParticipantWrapper>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="py-0 px-1 border-t flex justify-start gap-2">
        <AddParticipantPopover isOpen={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen} onSelectCharacter={handleAddParticipant} existingParticipantIds={participants.map((p) => p.id)}>
          <Button variant="ghost" size="icon" title="Add Participant">
            <LuUserPlus className="h-4 w-4" />
          </Button>
        </AddParticipantPopover>
        <Button disabled variant="ghost" size="icon" onClick={onOpenConfig} title="Settings">
          <LuSettings className="h-4 w-4" />
        </Button>
      </div>

      <CharacterForm
        open={isEditCharacterModalOpen !== null}
        onOpenChange={(open: boolean) => setIsEditCharacterModalOpen(open ? isEditCharacterModalOpen : null)}
        mode="edit"
        initialData={characterList.find((char) => char.id === isEditCharacterModalOpen) as Character}
        setIsEditing={() => {}}
        onSuccess={() => setIsEditCharacterModalOpen(null)}
      />

      {/* TODO: Add Agent Edit Dialog when available */}
      {isEditAgentModalOpen && <div className="hidden" />}
    </div>
  );
};

export default WidgetParticipants;
