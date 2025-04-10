import * as SwitchPrimitives from "@radix-ui/react-switch";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const switchVariants = cva(
  "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
  {
    variants: {
      size: {
        default: "h-5 w-9",
        sm: "h-4 w-7",
        xs: "h-3 w-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const thumbVariants = cva("pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform", {
  variants: {
    size: {
      default: "h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      sm: "h-3 w-3 data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0",
      xs: "h-2 w-2 data-[state=checked]:translate-x-2 data-[state=unchecked]:translate-x-0",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>, VariantProps<typeof switchVariants> {}

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, SwitchProps>(({ className, size, ...props }, ref) => (
  <SwitchPrimitives.Root className={cn(switchVariants({ size, className }))} {...props} ref={ref}>
    <SwitchPrimitives.Thumb className={cn(thumbVariants({ size }))} />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch, switchVariants };
