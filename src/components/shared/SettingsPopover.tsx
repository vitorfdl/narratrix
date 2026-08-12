import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SettingsPopoverContentProps extends ComponentPropsWithoutRef<typeof PopoverContent> {
  title: string;
  icon?: ReactNode;
}

/**
 * App-standard settings popover: accent surface, shadow, uppercase header row.
 * Use this instead of styling PopoverContent ad hoc so popovers stay consistent.
 */
export function SettingsPopoverContent({ title, icon, children, className, ...props }: SettingsPopoverContentProps) {
  return (
    <PopoverContent {...props} className={cn("w-72 overflow-hidden border bg-accent p-0 shadow-lg", className)}>
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2.5">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-3 custom-scrollbar">{children}</div>
    </PopoverContent>
  );
}
