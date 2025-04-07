import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog"; // Import Dialog as well
import { IconName } from "@/components/ui/icon-picker"; // Removed Icon as it's used in QuickActionButton
import { useLocalQuickActions } from "@/utils/local-storage";
import { Plus } from "lucide-react"; // Removed Edit, Trash as they are used in QuickActionButton
import React, { useState } from "react";
import { QuickActionButton } from "./QuickActionButton";
import { QuickActionDialog } from "./QuickActionDialog"; // Import the new Dialog component

// Export the interface if it's not already exported elsewhere
export interface QuickAction {
  id: string;
  icon: IconName;
  label: string;
  userPrompt: string;
  chatTemplateId: string;
  systemPromptOverride: string;
  streamOption: "textarea" | "userMessage" | "participantMessage";
  participantMessageType?: "new" | "swap";
}

interface QuickActionsProps {
  disableActions?: boolean;
  handleExecuteAction: (action: QuickAction) => void;
}

const iconSize = "!w-4.5 !h-4.5"; // Keep iconSize here if needed for the Plus icon

export const QuickActions: React.FC<QuickActionsProps> = ({ handleExecuteAction, disableActions = false }) => {
  const [actions, setActions] = useLocalQuickActions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null); // Store the whole action being edited, or null for add mode

  const handleOpenAddDialog = () => {
    setEditingAction(null); // Ensure we are in "add" mode
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (action: QuickAction) => {
    setEditingAction(action); // Set the action to edit
    setIsDialogOpen(true);
  };

  const handleSaveAction = (actionData: QuickAction) => {
    if (editingAction) {
      // Edit mode: update the existing action
      setActions(actions.map((action) => (action.id === actionData.id ? actionData : action)));
    } else {
      // Add mode: add the new action
      setActions([...actions, actionData]);
    }
    // No need to call setIsDialogOpen(false) here as QuickActionDialog does it internally
  };

  const handleDeleteAction = (id: string) => {
    setActions(actions.filter((action) => action.id !== id));
  };

  // const handleExecuteAction = (action: QuickAction) => {
  //   generateQuietly({
  //     context: {
  //       userCharacterID: userCharacterId ?? undefined,
  //       extra: {
  //         templateId: action.chatTemplateId || "",
  //         ...(action.streamOption === "participantMessage" && {
  //           participantMessageType: action.participantMessageType || "new",
  //         }),
  //       },
  //     },
  //     prompt: action.userPrompt,
  //     systemPrompt: action.systemPromptOverride || undefined,
  //   });
  // };

  return (
    <div className="flex items-center gap-1.5 flex-wrap w-full">
      {/* Add Button with Dialog properly nested */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button tabIndex={-1} variant="ghost" size="sm" onClick={handleOpenAddDialog}>
            <Plus className={iconSize} />
          </Button>
        </DialogTrigger>

        {/* The Dialog content moved inside Dialog component */}
        <QuickActionDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          isEditMode={!!editingAction}
          initialData={editingAction ?? undefined}
          onSave={handleSaveAction}
        />
      </Dialog>

      {/* Render Action Buttons */}
      {actions.map((action) => (
        <QuickActionButton
          key={action.id}
          action={action}
          disabled={disableActions}
          onExecute={handleExecuteAction}
          onEdit={handleOpenEditDialog}
          onDelete={handleDeleteAction}
        />
      ))}
    </div>
  );
};

export default QuickActions;
