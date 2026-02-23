import React from "react";
import { LuBadgeHelp, LuCircleHelp } from "react-icons/lu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  children: React.ReactNode;
  delayDuration?: number;
  iconClassName?: string;
  iconSize?: number;
  tooltipContentClassName?: string;
  tooltipProps?: Omit<React.ComponentProps<typeof Tooltip>, "children">;
  tooltipTriggerProps?: React.ComponentProps<typeof TooltipTrigger>;
  tooltipContentProps?: Omit<React.ComponentProps<typeof TooltipContent>, "children">;
}

export function HelpTooltip({
  children,
  delayDuration = 100,
  iconClassName = "h-3 w-3 text-muted-foreground cursor-help",
  iconSize,
  tooltipContentClassName,
  tooltipProps,
  tooltipTriggerProps,
  tooltipContentProps,
}: HelpTooltipProps) {
  const finalIconClassName = iconSize ? `h-${iconSize} w-${iconSize} text-muted-foreground cursor-help` : iconClassName;

  return (
    <Tooltip delayDuration={delayDuration} {...tooltipProps}>
      <TooltipTrigger asChild {...tooltipTriggerProps}>
        <span className="inline-flex items-center cursor-help" style={{ pointerEvents: "all", userSelect: "none" }}>
          <LuCircleHelp className={finalIconClassName} />
        </span>
      </TooltipTrigger>
      <TooltipContent className={cn("max-w-80 select-none border py-2", tooltipContentClassName)} {...tooltipContentProps}>
        <div className="flex items-center gap-1">
          <LuBadgeHelp className="h-5 w-5 flex-shrink-0 mr-1 text-muted-foreground text-justify" />
          <div className="text-foreground/80">{children}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
