import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Icon, IconName } from "@/components/ui/icon-picker";
import { QuickAction } from "@/schema/profiles-schema";
import { Edit, Trash } from "lucide-react";
import React from "react";

interface QuickActionButtonProps {
  action: QuickAction;
  onExecute: (action: QuickAction) => void;
  onEdit: (action: QuickAction) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

const iconSize = "!w-4.5 !h-4.5";

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({ action, onExecute, onEdit, onDelete, disabled = false }) => {
  // Determine if button should be opaque (when no chatTemplateId)
  const cantRun = !action.chatTemplateId;

  return (
    <ContextMenu key={action.id}>
      <ContextMenuTrigger>
        <Button
          tabIndex={-1}
          variant="outline"
          size="sm"
          onClick={() => (cantRun ? onEdit(action) : onExecute(action))}
          title={cantRun ? `${action.label} - Cannot run: Missing chat template` : action.label}
          className={`flex items-center gap-1 px-2 ${cantRun ? "text-destructive/80 hover:text-destructive" : ""}`}
          disabled={disabled}
        >
          <Icon name={action.icon as IconName} className={iconSize} />
          <span className="text-xs">{action.label}</span>
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem className="cursor-pointer" onClick={() => onEdit(action)}>
          <Edit className="mr-2 h-4 w-4" />
          <span>Edit</span>
        </ContextMenuItem>
        <ContextMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => onDelete(action.id)}>
          <Trash className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
