import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Icon } from "@/components/ui/icon-picker";
import { Edit, Trash } from "lucide-react";
import React from "react";
import { QuickAction } from "./QuickActions"; // Assuming QuickAction type is exported from QuickActions.tsx

interface QuickActionButtonProps {
  action: QuickAction;
  onExecute: (action: QuickAction) => void;
  onEdit: (action: QuickAction) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

const iconSize = "!w-4.5 !h-4.5";

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({ action, onExecute, onEdit, onDelete, disabled = false }) => {
  return (
    <ContextMenu key={action.id}>
      <ContextMenuTrigger>
        <Button
          tabIndex={-1}
          variant="outline"
          size="sm"
          onClick={() => onExecute(action)}
          title={action.label}
          className="flex items-center gap-1 px-2"
          disabled={disabled}
        >
          <Icon name={action.icon} className={iconSize} />
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
