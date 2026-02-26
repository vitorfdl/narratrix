import type { LucideIcon } from "lucide-react";
import { Settings } from "lucide-react";
import React, { type ReactNode, useCallback } from "react";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { stopNodeEventPropagation, useNodeRef, useNodeTheme } from "./NodeBase";

// ── NodeConfigButton ──────────────────────────────────────────────────────────

export interface NodeConfigButtonProps {
  onClick: () => void;
  title?: string;
  icon?: LucideIcon;
}

export const NodeConfigButton: React.FC<NodeConfigButtonProps> = ({ onClick, title = "Configure settings", icon: Icon = Settings }) => (
  <Button
    variant="ghost"
    size="sm"
    className="nodrag h-6 w-6 p-0 hover:bg-primary/10"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }}
    onPointerDown={stopNodeEventPropagation}
    title={title}
  >
    <Icon className="h-3 w-3" />
  </Button>
);

// ── useConfigureAction ────────────────────────────────────────────────────────

export function useConfigureAction(onConfigure: () => void) {
  return useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onConfigure();
    },
    [onConfigure],
  );
}

// ── NodeField ─────────────────────────────────────────────────────────────────

interface NodeFieldProps {
  label: string;
  icon?: LucideIcon;
  optional?: boolean;
  helpText?: ReactNode;
  refId?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const NodeField: React.FC<NodeFieldProps> = ({ label, icon: Icon, optional, helpText, refId, action, children, className }) => {
  const registerElementRef = useNodeRef();

  return (
    <div className={cn("space-y-1.5", optional && "border-l-2 border-dashed border-muted-foreground/25 pl-2.5", className)} ref={refId ? (el) => registerElementRef?.(refId, el) : undefined}>
      <div className="flex items-center justify-between min-h-[1.25rem]">
        <div className="flex items-center gap-1">
          {Icon && <Icon className="h-3 w-3 text-muted-foreground/70 flex-shrink-0" />}
          <label className={cn("text-xs select-none", optional ? "text-muted-foreground font-normal" : "font-medium")}>{label}</label>
          {optional && <span className="text-[10px] text-muted-foreground/50 leading-none">(optional)</span>}
          {helpText && <HelpTooltip>{helpText}</HelpTooltip>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
};

// ── NodeConfigPreview ─────────────────────────────────────────────────────────

interface NodeConfigPreviewItem {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
}

interface NodeConfigPreviewProps {
  items?: NodeConfigPreviewItem[];
  children?: ReactNode;
  variant?: "key-value" | "text" | "badge";
  className?: string;
  empty?: string;
}

export const NodeConfigPreview: React.FC<NodeConfigPreviewProps> = ({ items, children, variant = "key-value", className, empty }) => {
  const theme = useNodeTheme();
  const accentBorder = theme?.accentBorder ?? "border-muted-foreground/30";

  const base = cn("bg-muted/50 rounded-md border-l-2", accentBorder);

  if (variant === "badge") {
    return <div className={cn(base, "flex items-center gap-2 p-2", className)}>{children}</div>;
  }

  if (variant === "text") {
    return (
      <div className={cn(base, "p-2 max-h-16 custom-scrollbar overflow-y-auto overflow-x-hidden", className)}>
        <span className="text-xxs text-muted-foreground whitespace-pre-line leading-tight" style={{ lineHeight: "1.1", display: "block", wordBreak: "break-all" }}>
          {children ?? <span className="italic">{empty ?? "No content configured"}</span>}
        </span>
      </div>
    );
  }

  // key-value
  return (
    <div className={cn(base, "p-2 space-y-0.5", className)}>
      {items?.map((item) => (
        <div key={item.label} className="flex items-center gap-1 text-xxs text-muted-foreground">
          {item.icon && React.createElement(item.icon, { className: "h-2.5 w-2.5 flex-shrink-0 opacity-70" })}
          <span className="font-medium">{item.label}:</span>
          <span className="truncate">{item.value}</span>
        </div>
      ))}
      {children}
    </div>
  );
};
