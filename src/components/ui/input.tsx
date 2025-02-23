import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-7 w-full rounded-sm bg-foreground/5 px-3 py-1/2 text-xs font-mono",
          "border-0 border-b-2 border-b-primary/20",
          "transition-all duration-200",
          "focus:border-b-primary focus:bg-accent",
          "placeholder:text-muted-foreground",
          "outline-none ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
