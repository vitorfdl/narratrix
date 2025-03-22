import { cn } from "@/lib/utils";
import React from "react";

interface ResizableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  tokens?: number;
}

export function ResizableTextarea({
  className,
  label,
  tokens = 50,
  ...props
}: ResizableTextareaProps) {
  return (
    <>
      {label && <div className="mb-2 text-sm font-medium text-foreground">{label}</div>}
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-sm custom-scrollbar bg-accent px-3 py-2 text-xs font-mono",
          "border-0 border-b-2 border-b-primary/20",
          "transition-[border] duration-200",
          "focus:border-b-primary",
          "placeholder:text-muted-foreground",
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
