import { useLocalGridLayout } from "@/utils/local-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Layout, Responsive, WidthProvider } from "react-grid-layout";
import { WidgetId, renderWidget, widgetTitles } from "../hooks/registry";
import { GridCard } from "./GridCard";
import { GridSidebar } from "./GridSidebar";

// Import the grid layout CSS
import { InferenceServiceProvider } from "@/providers/inferenceChatProvider";
import "react-grid-layout/css/styles.css";
import "../styles/react-grid-overrides.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLUMNS = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 6,
  xxs: 2,
};

/**
 * I Think I overcomplicated the layout logic. =D
 */
export const GridLayout: React.FC<{ tabId: string }> = ({ tabId }) => {
  const [positions, setPositions] = useLocalGridLayout();
  const [layoutReady, setLayoutReady] = useState(false);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<keyof typeof COLUMNS>("lg");
  const [maxRows, setMaxRows] = useState(21);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowHeight = 35;
  const margin = 4;
  // Add a ref to track if we're currently changing breakpoints
  const isBreakpointChanging = useRef(false);
  // Store last layout to compare for genuine changes
  const lastLayout = useRef<Layout[]>([]);

  // Calculate maxRows based on container height
  const calculateMaxRows = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const containerHeight = containerRef.current.clientHeight;
    // Account for top and bottom container padding (2 * margin)
    const availableHeight = containerHeight - 2 * margin;
    // Each row consists of rowHeight plus the margin below it
    const rowAndMarginHeight = rowHeight + margin;
    // Add margin to numerator to include the last row that doesn't need a margin below it
    const calculatedMaxRows = Math.floor((availableHeight + margin) / rowAndMarginHeight);

    // Set a minimum of 1 row
    setMaxRows(Math.max(1, calculatedMaxRows));
  }, []);

  // Set up resize observer to recalculate rows when container size changes
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    calculateMaxRows();

    const resizeObserver = new ResizeObserver(() => {
      calculateMaxRows();
    });

    resizeObserver.observe(containerRef.current);

    // Also listen for window resize events
    window.addEventListener("resize", calculateMaxRows);

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      window.removeEventListener("resize", calculateMaxRows);
    };
  }, [calculateMaxRows]);

  // Ensure layout is only rendered after positions are loaded from localStorage
  useEffect(() => {
    if (positions.length > 0) {
      setLayoutReady(true);
    }
  }, [positions]);

  // Get visible and hidden widgets
  const visibleWidgets = positions.filter((pos) => !pos.hidden);
  const hiddenWidgets = positions.filter((pos) => pos.hidden);

  // Convert GridPosition[] to react-grid-layout format
  const generateLayouts = useCallback(() => {
    // Create optimized layouts for each breakpoint
    const createBreakpointLayout = (columnSize: keyof typeof COLUMNS) => {
      const columns = COLUMNS[columnSize];
      return visibleWidgets.map((pos) => {
        const basePos = pos[columnSize] || pos.sm || pos.md || pos.lg || pos.xxs || pos.xs;
        // Get base position
        let x = basePos?.x ?? 0;
        let y = basePos?.y ?? 0;
        const w = Math.min(basePos?.w ?? 2, columns); // Ensure width doesn't exceed columns
        const h = basePos?.h ?? 1;

        // Adjust x-position if it would overflow the grid width
        if (x + w > columns) {
          x = Math.max(0, columns - w);
        }

        // Ensure y-position stays within maxRows
        y = Math.min(y, Math.max(0, maxRows - h));

        return {
          i: pos.id,
          x,
          y,
          w,
          h,
          minW: 1,
          minH: 1,
        };
      });
    };

    // Return optimized layouts for each breakpoint
    return {
      lg: createBreakpointLayout("lg"),
      md: createBreakpointLayout("md"),
      sm: createBreakpointLayout("sm"),
      xs: createBreakpointLayout("xs"),
      xxs: createBreakpointLayout("xxs"),
    };
  }, [visibleWidgets, maxRows]);

  // Handle layout changes from drag/resize operations
  const handleLayoutChange = (currentLayout: Layout[]) => {
    // Skip empty layouts
    if (!currentLayout.length || !layoutReady) {
      return;
    }

    // Skip layout updates during breakpoint transitions
    if (isBreakpointChanging.current) {
      // Just store the new layout for future comparisons
      lastLayout.current = currentLayout;
      return;
    }

    // Check if this is a genuine user change or just a re-render
    // by comparing with the last known layout
    if (lastLayout.current.length > 0) {
      const hasRealChanges = currentLayout.some((item) => {
        const prevItem = lastLayout.current.find((li) => li.i === item.i);
        if (!prevItem) {
          return true;
        }
        return prevItem.x !== item.x || prevItem.y !== item.y || prevItem.w !== item.w || prevItem.h !== item.h;
      });

      if (!hasRealChanges) {
        // Just a re-render, not a user change
        lastLayout.current = currentLayout;
        return;
      }
    }

    // Update positions in storage when layout changes
    const updatedPositions = positions.map((pos) => {
      const layoutItem = currentLayout.find((item) => item.i === pos.id);
      if (layoutItem && !pos.hidden) {
        return {
          ...pos,
          [currentBreakpoint]: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          },
        };
      }
      return pos;
    });

    setPositions(updatedPositions);
    lastLayout.current = currentLayout;
  };

  // Custom handler for drag stop to enforce maxRows
  const handleDragStop = (layout: Layout[], oldItem: Layout, newItem: Layout) => {
    // Check if the dragged item is now extending beyond maxRows
    if (newItem.y + newItem.h > maxRows) {
      // Adjust its position to fit within maxRows
      const adjustedLayouts = layout.map((item) => {
        if (item.i === newItem.i) {
          return {
            ...item,
            y: Math.max(0, maxRows - item.h), // Move it up to fit within maxRows
          };
        }
        return item;
      });

      // Trigger an update with adjusted layouts
      handleLayoutChange(adjustedLayouts);
    }
  };

  // Handle breakpoint changes
  const handleBreakpointChange = (newBreakpoint: keyof typeof COLUMNS) => {
    // Set flag to prevent layout updates during breakpoint transition
    isBreakpointChanging.current = true;

    // Update breakpoint
    setCurrentBreakpoint(newBreakpoint);
    // Reset flag after a short delay to allow layout to stabilize
    setTimeout(() => {
      isBreakpointChanging.current = false;
      // Save the layout after switching to update lastLayout ref
      lastLayout.current = generateLayouts()[newBreakpoint];
    }, 100);
  };

  // Toggle widget visibility
  const toggleCard = (cardId: string) => {
    const pos = positions.find((pos) => pos.id === cardId);
    if (!pos) {
      return;
    }

    if (pos.hidden) {
      // Calculate grid parameters based on current breakpoint
      const gridCols = COLUMNS[currentBreakpoint];

      // Create a grid occupancy map to track which cells are already taken
      const gridMap: boolean[][] = Array(50)
        .fill(0)
        .map(() => Array(gridCols).fill(false));

      // Mark cells as occupied based on current visible widgets
      for (const widget of visibleWidgets) {
        const x = widget[currentBreakpoint]?.x ?? 0;
        const y = widget[currentBreakpoint]?.y ?? 0;
        const w = widget[currentBreakpoint]?.w ?? 3;
        const h = widget[currentBreakpoint]?.h ?? 4;

        for (let i = y; i < y + h && i < gridMap.length; i++) {
          for (let j = x; j < x + w && j < gridCols; j++) {
            if (i >= 0 && j >= 0) {
              gridMap[i][j] = true;
            }
          }
        }
      }

      // Find first available position by scanning the grid
      let bestX = 0;
      let bestY = 0;
      const targetW = pos[currentBreakpoint]?.w ?? 2;
      const targetH = pos[currentBreakpoint]?.h ?? 1;

      // First try to find a position on the first row
      outer: for (let y = 0; y < gridMap.length - targetH + 1; y++) {
        for (let x = 0; x <= gridCols - targetW; x++) {
          let canFit = true;

          // Check if the widget can fit at position (x,y)
          for (let i = 0; i < targetH; i++) {
            for (let j = 0; j < targetW; j++) {
              if (gridMap[y + i][x + j]) {
                canFit = false;
                break;
              }
            }
            if (!canFit) {
              break;
            }
          }

          if (canFit) {
            bestX = x;
            bestY = y;
            break outer;
          }
        }
      }

      // Unhide widget at the computed position
      setPositions((prev) =>
        prev.map((p) =>
          p.id === cardId ? { ...p, hidden: false, x: bestX, y: bestY, w: p[currentBreakpoint]?.w ?? 2, h: p[currentBreakpoint]?.h ?? 1 } : p,
        ),
      );
    } else {
      // Hide widget
      setPositions((prev) => prev.map((p) => (p.id === cardId ? { ...p, hidden: true, w: 2, h: 3 } : p)));
    }
  };

  // Define custom drag handle
  const dragHandleClass = "grid-drag-handle";

  return (
    <InferenceServiceProvider>
      <div className="flex h-full overflow-hidden p-0">
        {/* Grid Sidebar */}
        <GridSidebar hiddenWidgets={hiddenWidgets} toggleCard={toggleCard} tabId={tabId} />

        {/* Grid Container */}
        <div ref={containerRef} className="flex-1 overflow-hidden">
          {layoutReady && (
            <ResponsiveGridLayout
              className="layout"
              layouts={generateLayouts()}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={COLUMNS}
              rowHeight={rowHeight}
              margin={[margin, margin]}
              containerPadding={[margin, margin]}
              onLayoutChange={handleLayoutChange}
              onBreakpointChange={handleBreakpointChange}
              onDragStop={handleDragStop}
              draggableHandle={`.${dragHandleClass}`}
              compactType={null}
              preventCollision={true}
              useCSSTransforms={false}
              isBounded={false}
              isDraggable={true}
              isResizable={true}
              resizeHandles={["se"]}
              maxRows={maxRows}
            >
              {visibleWidgets.map((widget) => (
                <div key={widget.id}>
                  <GridCard
                    id={widget.id}
                    title={widgetTitles[widget.id as WidgetId]}
                    onClose={() => toggleCard(widget.id)}
                    dragHandleClassName={dragHandleClass}
                  >
                    {renderWidget(widget.id as WidgetId, tabId)}
                  </GridCard>
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      </div>
    </InferenceServiceProvider>
  );
};
