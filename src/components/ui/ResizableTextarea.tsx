import React from "react";
import { cn } from "@/lib/utils";

interface ResizableTextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
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
        <div className="relative">
            {label && (
                <div className="mb-2 text-sm font-medium text-foreground">
                    {label}
                </div>
            )}
            <textarea
                className={cn(
                    "flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
                    className
                )}
                {...props}
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                Tokens: {tokens}
            </div>
        </div>
    );
} 