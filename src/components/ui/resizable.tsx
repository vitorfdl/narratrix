import type { ComponentProps } from "react";
import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

type ResizablePanelGroupProps = Omit<ComponentProps<typeof ResizablePrimitive.Group>, "orientation"> & {
  direction?: ComponentProps<typeof ResizablePrimitive.Group>["orientation"];
  orientation?: ComponentProps<typeof ResizablePrimitive.Group>["orientation"];
};

const ResizablePanelGroup = ({ className, direction, orientation, ...props }: ResizablePanelGroupProps) => (
  <ResizablePrimitive.Group orientation={orientation ?? direction} className={cn("flex h-full w-full", className)} {...props} />
);

const toLegacyPercentSize = (size: number | string | undefined) => (typeof size === "number" ? `${size}%` : size);

const ResizablePanel = ({ collapsedSize, defaultSize, maxSize, minSize, ...props }: ComponentProps<typeof ResizablePrimitive.Panel>) => (
  <ResizablePrimitive.Panel
    collapsedSize={toLegacyPercentSize(collapsedSize)}
    defaultSize={toLegacyPercentSize(defaultSize)}
    maxSize={toLegacyPercentSize(maxSize)}
    minSize={toLegacyPercentSize(minSize)}
    {...props}
  />
);

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:-translate-y-1/2 aria-[orientation=horizontal]:after:translate-x-0 [&[aria-orientation=horizontal]>div]:rotate-90",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.Separator>
);

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
