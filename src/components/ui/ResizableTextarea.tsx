import { cn } from "@/lib/utils";
import React from "react";

interface ResizableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  tokens?: number;
}

export function ResizableTextarea({ className, label, tokens = 50, ...props }: ResizableTextareaProps) {
  return (
    <>
      {label && <div className="mb-2 text-sm font-medium text-foreground">{label}</div>}
      <textarea
        className={cn(
          "flex w-full rounded-sm custom-scrollbar text-foreground input-fields px-3 py-2 text-xs font-mono",
          "placeholder:text-muted-foreground/50 placeholder:italic",
          "outline-none ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-y ",
          className,
        )}
        {...props}
      />
    </>
  );
}
