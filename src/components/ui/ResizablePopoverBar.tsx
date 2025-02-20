import React, { useEffect, useRef, useState } from "react";
// Import the scrollbar styles so that the CSS is available for this component
import "@/pages/chat/styles/scrollbar.css";

export interface ResizablePopoverContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  minWidth?: number;   // Minimum width in pixels (default: 300px)
  maxHeight?: number;  // Maximum height in pixels (default: 80% of viewport)
}

const ResizablePopoverContent: React.FC<ResizablePopoverContentProps> = ({
  children,
  className = "",
  minWidth = 300,
  maxHeight = Math.floor(window.innerHeight * 0.8),
  ...props
}) => {
  // Start with the minimum width as the default
  const [width, setWidth] = useState<number>(minWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(width);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

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
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();
  };

  // Prepare inline style for the scrollable content container
  const contentContainerStyle: React.CSSProperties = {
    maxHeight: `${maxHeight}px`
  };

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px` }}
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
        className="absolute right-[-0.5rem] top-0 h-full w-2 cursor-ew-resize bg-gray-300 opacity-50 hover:opacity-100"
      />
    </div>
  );
};

export default ResizablePopoverContent; 