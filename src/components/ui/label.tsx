import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const labelVariants = cva("text-xs xl:text-sm  leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");

interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>, VariantProps<typeof labelVariants> {
  descriptionTag?: string;
}

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(({ className, children, descriptionTag, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props}>
    {children}
    {descriptionTag && <span className="ml-2 inline-flex items-center rounded-md bg-accent/80 px-1.5 py-0.5 text-xs italic font-light text-accent-foreground">{descriptionTag}</span>}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
