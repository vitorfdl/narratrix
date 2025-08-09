import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ReactNode } from "react";

interface DestructiveConfirmDialogProps {
  /**
   * Controls whether the dialog is open
   */
  open: boolean;
  /**
   * Callback fired when the dialog open state changes
   */
  onOpenChange: (open: boolean) => void;
  /**
   * The title of the confirmation dialog
   */
  title?: string;
  /**
   * The description explaining the consequences of the action
   */
  description: ReactNode;
  /**
   * Callback fired when the destructive action is confirmed
   */
  onConfirm: () => void;
  /**
   * Callback fired when the dialog is canceled
   * Optional - defaults to just closing the dialog
   */
  onCancel?: () => void;
  /**
   * Text for the cancel button
   */
  cancelText?: string;
  /**
   * Text for the confirm button
   */
  confirmText?: string;
}

/**
 * A reusable component for destructive confirmation dialogs
 * Uses shadcn/ui AlertDialog with sensible defaults for destructive actions
 */
export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title = "Are you absolutely sure?",
  description,
  onConfirm,
  onCancel,
  cancelText = "Cancel",
  confirmText = "Delete",
}: DestructiveConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              if (onCancel) {
                onCancel();
              }
            }}
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
