import React, { useEffect, useRef, useState } from "react";
// Import the scrollbar styles so that the CSS is available for this component

export interface ResizablePopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  minWidth?: number; // Minimum width in pixels (default: 300px)
  maxHeight?: number; // Maximum height in pixels (default: 80% of viewport)
  minHeight?: number; // Minimum height in pixels
}

const ResizablePopoverContent: React.FC<ResizablePopoverContentProps> = ({
  children,
  className = "",
  minWidth = 450,
  maxHeight = Math.floor(window.innerHeight * 0.9), // Increase to 90% of viewport
  minHeight = 200,
  ...props
}) => {
  // Start with the minimum width as the default
  const [width, setWidth] = useState<number>(minWidth);
  const [viewportHeight, setViewportHeight] = useState<number>(window.innerHeight);
  const [isResizingState, setIsResizingState] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(width);

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
      const newWidth = startWidth.current + deltaX;
      // Calculate the maximum width as 75% of the viewport width (75vw)
      const computedMaxWidth = window.innerWidth * 0.75;
      // Clamp the width between minWidth and computedMaxWidth
      const clampedWidth = Math.max(minWidth, Math.min(newWidth, computedMaxWidth));
      setWidth(clampedWidth);
    };

    const onMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        setIsResizingState(false);
        document.body.style.userSelect = "";
        document.body.style.pointerEvents = "";
        document.body.style.cursor = "";
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
      {/* Resize handle on the right */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute right-[-1rem] top-0 h-full w-2 cursor-ew-resize rounded-full bg-transparent/40 opacity-50 hover:opacity-100"
      />

      {/* Global overlay to capture events during resize */}
      {isResizingState && (
        <div className="fixed inset-0 z-50 cursor-ew-resize" style={{ pointerEvents: "all" }} onClick={(e) => e.stopPropagation()} />
      )}
    </div>
  );
};

export default ResizablePopoverContent;
