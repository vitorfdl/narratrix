import { Plus } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useCurrentChatMessages, useCurrentChatParticipants } from "@/hooks/chatStore";
import { useCurrentProfile, useProfileActions } from "@/hooks/ProfileStore";
import { QuickAction } from "@/schema/profiles-schema";
import AddParticipantPopover from "../AddParticipantPopover";
import { QuickActionButton } from "./QuickActionButton";
import { QuickActionDialog } from "./QuickActionDialog";

interface QuickActionsProps {
  disableActions?: boolean;
  handleExecuteAction: (action: QuickAction, participantId?: string) => void;
}

const iconSize = "!w-4.5 !h-4.5";

export const QuickActions: React.FC<QuickActionsProps> = ({ handleExecuteAction, disableActions = false }) => {
  const currentProfile = useCurrentProfile();
  const participants = useCurrentChatParticipants();
  const { updateProfile } = useProfileActions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null);
  const actions = currentProfile?.quick_actions ?? [];
  const chatMessages = useCurrentChatMessages() || [];

  const [isParticipantDialogOpen, setIsParticipantDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  // Note: selection handled inline via onSelectCharacter; no local selection state needed

  const lastCharacterMessage = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i];
      if (msg?.type === "character") {
        return msg;
      }
    }
    return null;
  }, [chatMessages]);

  const handleOpenAddDialog = () => {
    setEditingAction(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (action: QuickAction) => {
    setEditingAction(action);
    setIsDialogOpen(true);
  };

  const handleSaveAction = async (actionData: QuickAction) => {
    try {
      let updatedActions: QuickAction[];
      if (editingAction) {
        // Edit mode
        updatedActions = actions.map((action) => (action.id === actionData.id ? actionData : action));
      } else {
        // Add mode
        updatedActions = [...actions, actionData];
      }
      await updateProfile({ quick_actions: updatedActions });
    } catch (error) {
      // Optionally handle error (toast, etc.)
      console.error("Failed to save quick action:", error);
    }
    // Dialog closes itself via QuickActionDialog
  };

  const handleDeleteAction = async (id: string) => {
    try {
      const updatedActions = actions.filter((action) => action.id !== id);
      await updateProfile({ quick_actions: updatedActions });
    } catch (error) {
      // Optionally handle error (toast, etc.)
      console.error("Failed to delete quick action:", error);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap w-full">
      {/* Add Button with Dialog properly nested */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button tabIndex={-1} variant="ghost" size="sm" onClick={handleOpenAddDialog} title="Add Quick Action / Right Click on existing actions to edit">
            <Plus className={iconSize} />
          </Button>
        </DialogTrigger>
        <QuickActionDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} isEditMode={!!editingAction} initialData={editingAction ?? undefined} onSave={handleSaveAction} />
      </Dialog>
      {/* Render Action Buttons */}
      {actions.map((action) => (
        <QuickActionButton
          key={action.id}
          action={action}
          disabled={disableActions}
          onExecute={(act) => {
            const needsParticipantSelection = act.streamOption === "participantMessage" && (act.participantMessageType === "new" || (act.participantMessageType === "swap" && !lastCharacterMessage));

            if (needsParticipantSelection && (participants?.length ?? 0) > 1) {
              setPendingAction(act);
              setIsParticipantDialogOpen(true);
              return;
            }

            handleExecuteAction(act);
          }}
          onEdit={handleOpenEditDialog}
          onDelete={handleDeleteAction}
        />
      ))}

      {/* Participant selection popover using existing AddParticipantPopover */}
      {isParticipantDialogOpen && pendingAction ? (
        <AddParticipantPopover
          isOpen={isParticipantDialogOpen}
          onOpenChange={(open) => {
            setIsParticipantDialogOpen(open);
            if (!open) {
              setPendingAction(null);
            }
          }}
          onSelectCharacter={(id) => {
            handleExecuteAction(pendingAction, id);
            setIsParticipantDialogOpen(false);
            setPendingAction(null);
          }}
          existingParticipantIds={[]}
          pickableParticipantIds={participants?.filter((participant) => participant.enabled)?.map((participant) => participant.id)}
          title="Select participant"
        >
          <Button size="sm" variant="secondary">
            Select participant
          </Button>
        </AddParticipantPopover>
      ) : null}
    </div>
  );
};

export default QuickActions;
