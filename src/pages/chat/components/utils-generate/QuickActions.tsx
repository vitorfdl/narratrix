import { Plus } from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useCurrentProfile, useProfileActions } from "@/hooks/ProfileStore";
import { QuickAction } from "@/schema/profiles-schema";
import { QuickActionButton } from "./QuickActionButton";
import { QuickActionDialog } from "./QuickActionDialog";

interface QuickActionsProps {
  disableActions?: boolean;
  handleExecuteAction: (action: QuickAction) => void;
}

const iconSize = "!w-4.5 !h-4.5";

export const QuickActions: React.FC<QuickActionsProps> = ({ handleExecuteAction, disableActions = false }) => {
  const currentProfile = useCurrentProfile();
  const { updateProfile } = useProfileActions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null);
  const actions = currentProfile?.quick_actions ?? [];

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
        <QuickActionButton key={action.id} action={action} disabled={disableActions} onExecute={handleExecuteAction} onEdit={handleOpenEditDialog} onDelete={handleDeleteAction} />
      ))}
    </div>
  );
};

export default QuickActions;
