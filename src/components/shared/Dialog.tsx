import * as ShadDialog from "@/components/ui/dialog";
import React from "react";

/**
 * Dialog component for displaying modal dialogs with Narratrix custom styles.
 * Wraps shadcn/ui Dialog and applies consistent styling.
 */
export const Dialog = ShadDialog.Dialog;

interface DialogContentProps extends React.ComponentProps<typeof ShadDialog.DialogContent> {
  /** Whether the dialog can be closed by pressing the Escape key. Defaults to false. */
  allowEscapeKeyClose?: boolean;
  /** Whether the dialog can be closed by clicking outside of it. Defaults to false. */
  allowClickOutsideClose?: boolean;
}

/**
 * DialogContent component with Narratrix custom classes for layout, background, and shadow.
 * Use for the main content area of the dialog.
 * By default, prevents closing via ESC key or clicking outside.
 */
export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(({ className = "", size = "large", allowEscapeKeyClose = true, allowClickOutsideClose = true, ...props }, ref) => {
  // Merge custom classes with any provided by the user
  const mergedClassName = ["flex flex-col w-full p-0 bg-background rounded-lg shadow-lg px-6 py-2", className].filter(Boolean).join(" ");

  return (
    <ShadDialog.DialogContent
      showCloseButton={false}
      ref={ref}
      className={mergedClassName}
      size={size}
      onEscapeKeyDown={allowEscapeKeyClose ? undefined : (e) => e.preventDefault()}
      onPointerDownOutside={allowClickOutsideClose ? undefined : (e) => e.preventDefault()}
      {...props}
    />
  );
});
DialogContent.displayName = "DialogContent";

/**
 * DialogHeader component with sticky positioning and custom background/border.
 * Use for the dialog's header section.
 */
export const DialogHeader: React.FC<React.ComponentProps<typeof ShadDialog.DialogHeader>> = ({ className = "", ...props }) => {
  const mergedClassName = ["sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4", className].filter(Boolean).join(" ");
  return <ShadDialog.DialogHeader className={mergedClassName} {...props} />;
};
DialogHeader.displayName = "DialogHeader";

/**
 * DialogTitle component for the dialog's title area.
 */
export const DialogTitle = ShadDialog.DialogTitle;

/**
 * DialogFooter component with sticky positioning and custom background/border.
 * Use for the dialog's footer section (actions/buttons).
 */
export const DialogFooter: React.FC<React.ComponentProps<typeof ShadDialog.DialogFooter>> = ({ className = "", ...props }) => {
  const mergedClassName = ["sticky bottom-0 z-10 bg-background/95 backdrop-blur border-t border-border px-6 py-4 flex gap-3", className].filter(Boolean).join(" ");
  return <ShadDialog.DialogFooter className={mergedClassName} {...props} />;
};
DialogFooter.displayName = "DialogFooter";

/**
 * DialogBody component for scrollable dialog content between header and footer.
 * Use for the main content area that should scroll if content overflows.
 */
export const DialogBody: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (
  <div className={["flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar px-2", className].filter(Boolean).join(" ")}>{children}</div>
);
