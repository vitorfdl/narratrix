import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BadgeHelpIcon, HelpCircle } from "lucide-react";
import React from "react";

interface HelpTooltipProps {
  children: React.ReactNode;
  delayDuration?: number;
  iconClassName?: string;
  iconSize?: number;
  tooltipContentClassName?: string;
  tooltipProviderProps?: React.ComponentProps<typeof TooltipProvider>;
  tooltipProps?: Omit<React.ComponentProps<typeof Tooltip>, "children">;
  tooltipTriggerProps?: React.ComponentProps<typeof TooltipTrigger>;
  tooltipContentProps?: Omit<React.ComponentProps<typeof TooltipContent>, "children">;
}

export function HelpTooltip({
  children,
  delayDuration = 100,
  iconClassName = "h-3 w-3 text-muted-foreground cursor-help",
  iconSize, // If provided, overrides h-3 w-3
  tooltipContentClassName,
  tooltipProviderProps,
  tooltipProps,
  tooltipTriggerProps,
  tooltipContentProps,
}: HelpTooltipProps) {
  const finalIconClassName = iconSize ? `h-${iconSize} w-${iconSize} text-muted-foreground cursor-help` : iconClassName;

  return (
    <TooltipProvider {...tooltipProviderProps}>
      <Tooltip delayDuration={delayDuration} {...tooltipProps}>
        <TooltipTrigger asChild {...tooltipTriggerProps}>
          <HelpCircle className={finalIconClassName} />
        </TooltipTrigger>
        <TooltipContent className={cn("max-w-80 select-none border py-2", tooltipContentClassName)} {...tooltipContentProps}>
          <div className="flex items-center gap-1 ">
            <BadgeHelpIcon className="h-5 w-5 flex-shrink-0 mr-1 text-muted-foreground text-justify" />
            <div className="text-foreground/80">{children}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
