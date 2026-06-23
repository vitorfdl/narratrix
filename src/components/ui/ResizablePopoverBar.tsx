import { GripVertical } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
// Import the scrollbar styles so that the CSS is available for this component

export interface ResizablePopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  minWidth?: number; // Minimum width in pixels (default: 450px)
  maxHeight?: number; // Maximum height in pixels (default: 90% of viewport)
  minHeight?: number; // Minimum height in pixels
  defaultWidth?: number; // Initial width in pixels (e.g. restored from storage)
  onWidthChange?: (width: number) => void; // Called once a resize gesture completes
}

// Clamp a requested width between the minimum and 75% of the current viewport width
const clampWidth = (value: number, minWidth: number): number => {
  const computedMaxWidth = window.innerWidth * 0.75;
  return Math.max(minWidth, Math.min(value, computedMaxWidth));
};

const ResizablePopoverContent: React.FC<ResizablePopoverContentProps> = ({
  children,
  className = "",
  minWidth = 450,
  maxHeight = Math.floor(window.innerHeight * 0.9), // Increase to 90% of viewport
  minHeight = 200,
  defaultWidth,
  onWidthChange,
  ...props
}) => {
  const [width, setWidth] = useState<number>(() => clampWidth(defaultWidth ?? minWidth, minWidth));
  const [viewportHeight, setViewportHeight] = useState<number>(window.innerHeight);
  const [isResizingState, setIsResizingState] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(width);
  const latestWidth = useRef<number>(width);
  // Hold the callback in a ref so the drag listeners don't need to re-subscribe when it changes
  const onWidthChangeRef = useRef(onWidthChange);

  useEffect(() => {
    onWidthChangeRef.current = onWidthChange;
  }, [onWidthChange]);

  // Update viewport dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) {
        return;
      }

      const deltaX = e.clientX - startX.current;
      const clampedWidth = clampWidth(startWidth.current + deltaX, minWidth);
      latestWidth.current = clampedWidth;
      setWidth(clampedWidth);
    };

    const onMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        setIsResizingState(false);
        document.body.style.userSelect = "";
        document.body.style.pointerEvents = "";
        document.body.style.cursor = "";
        // Persist only when the gesture ends to avoid a write per mouse move
        onWidthChangeRef.current?.(latestWidth.current);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [minWidth]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isResizing.current = true;
    setIsResizingState(true);
    startX.current = e.clientX;
    startWidth.current = width;
    latestWidth.current = width;

    // Prevent text selection and pointer events during resize
    document.body.style.userSelect = "none";
    document.body.style.pointerEvents = "none";
    document.body.style.cursor = "ew-resize";

    e.preventDefault();
  };

  // Calculate dynamic max height based on viewport
  const calculatedMaxHeight = Math.min(maxHeight, viewportHeight * 0.9);

  // Prepare inline style for the scrollable content container
  const contentContainerStyle: React.CSSProperties = {
    maxHeight: `${calculatedMaxHeight}px`,
    minHeight: `${minHeight}px`,
    height: "auto", // Allow content to determine height up to maxHeight
    overflow: "auto", // Add scrolling only when needed
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: `${width}px`,
        maxHeight: `${calculatedMaxHeight}px`,
        height: "auto", // Allow content to determine height
      }}
      className={`relative ${className}`}
      {...props}
    >
      {/* The "custom-scrollbar" class applies your CSS rules for the scrollbar */}
      <div className="overflow-auto custom-scrollbar" style={contentContainerStyle}>
        {children}
      </div>

      {/* Resize handle: lives in the gutter just past the right edge, clear of the content scrollbar */}
      <div
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize width"
        title="Drag to resize width"
        className="group/resize absolute left-full top-0 z-20 flex h-full w-4 cursor-ew-resize items-center"
      >
        {/* Full-height track sitting on the content edge, brightens on hover/drag */}
        <div className={cn("h-full w-0.5 rounded-full transition-colors", isResizingState ? "bg-primary" : "bg-border group-hover/resize:bg-primary/60")} />
        {/* Grip pill in the gutter, flush against the edge, as the affordance */}
        <div
          className={cn(
            "absolute left-0 flex h-9 w-4 items-center justify-center rounded-sm border shadow-sm transition-colors",
            isResizingState ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground group-hover/resize:border-primary/60 group-hover/resize:text-primary",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Global overlay to capture events during resize */}
      {isResizingState && <div className="fixed inset-0 z-50 cursor-ew-resize" style={{ pointerEvents: "all" }} onClick={(e) => e.stopPropagation()} />}
    </div>
  );
};

export default ResizablePopoverContent;
