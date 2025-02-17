// src/components/GridLayout.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { GridStack, GridStackOptions } from "gridstack";
import "gridstack/dist/gridstack.min.css";
import "@/pages/chat/styles/gridstack.css";
import { GridCard } from "./GridCard";
import { GridPosition } from "@/types/grid";
import GridSidebar from "./GridSidebar";

const STORAGE_KEY_PREFIX = "grid-layout-positions";
const MIN_CELL_HEIGHT = 60; // defines a minimum for consistency

const defaultPositions: GridPosition[] = [
  { x: 0, y: 0, w: 6, h: 4, id: "messages", title: "Messages", hidden: false },
  { x: 6, y: 0, w: 6, h: 4, id: "config", title: "Config", hidden: false },
  { x: 0, y: 4, w: 8, h: 3, id: "generate", title: "Generate", hidden: false },
  {
    x: 8,
    y: 4,
    w: 4,
    h: 3,
    id: "participants",
    title: "Participants",
    hidden: false,
  },
  { x: 0, y: 0, w: 2, h: 1, id: "scripts", title: "Scripts", hidden: true },
  {
    x: 0,
    y: 0,
    w: 2,
    h: 1,
    id: "character_sheet",
    title: "Character Sheet",
    hidden: true,
  },
  { x: 0, y: 0, w: 2, h: 1, id: "memory", title: "Memory", hidden: true },
  { x: 0, y: 0, w: 2, h: 1, id: "database", title: "Database", hidden: true },
  { x: 0, y: 0, w: 2, h: 1, id: "chapters", title: "Chapters", hidden: true },
];

export const GridLayout: React.FC<{ tabId: string }> = ({ tabId }) => {
  const gridRef = useRef<GridStack>();
  const containerRef = useRef<HTMLDivElement>(null);
  const STORAGE_KEY = `${STORAGE_KEY_PREFIX}-${tabId}`;
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [positions, setPositions] = useState<GridPosition[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultPositions;
  });

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const handlePositionChange = useCallback((items: any[]) => {
    if (!items || items.length === 0) return;

    const newPositions = positionsRef.current.map((pos) => {
      const item = items.find((i) => i.id === pos.id);
      if (item) {
        return {
          ...pos,
          x: item.x ?? pos.x,
          y: item.y ?? pos.y,
          w: item.w ?? pos.w,
          h: item.h ?? pos.h,
        };
      }
      return pos;
    });

    setPositions(newPositions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPositions));
  }, [STORAGE_KEY]);

  // Initialize or reinitialize grid when tabId changes
  useEffect(() => {
    const initializeGrid = () => {
      // Destroy existing grid if it exists
      if (gridRef.current) {
        gridRef.current.destroy(false);
        gridRef.current = undefined;
      }

      // Ensure the container has proper dimensions
      if (containerRef.current) {
        containerRef.current.style.height = "100%";
        containerRef.current.style.width = "100%";
      }

      // Small delay to ensure DOM is fully ready
        if (!containerRef.current) return;

        const containerHeight = containerRef.current.clientHeight ||
          window.innerHeight;
        const maxRow = Math.floor(containerHeight / MIN_CELL_HEIGHT) || 1;
        const cellHeight = containerHeight / maxRow;

        const options: GridStackOptions = {
          float: true,
          animate: false,
          cellHeight,
          margin: "2px",
          marginTop: "4px",
          marginUnit: "em",
          resizable: {
            handles: "se",
            containment: ".grid-stack",
          } as any,
          draggable: {
            handle: "[data-gs-drag-handle]",
          },
          maxRow,
          staticGrid: false,
          disableResize: false,
          disableDrag: false,
        };

        gridRef.current = GridStack.init(options, containerRef.current);

        // Add items to the grid
        positions.filter((pos) => !pos.hidden).forEach((pos) => {
          const existingItem = gridRef.current?.engine.nodes.find((n) =>
            n.id === pos.id
          );
          if (!existingItem) {
            gridRef.current?.addWidget({
              x: pos.x,
              y: pos.y,
              w: pos.w,
              h: pos.h,
              id: pos.id,
              // locked: true,
              
              noMove: true,
            });
          }
        });

        // Handle changes with more control
        gridRef.current.on(
          "change",
          (_event, items) => handlePositionChange(items),
        );

        // Additional event handlers for better control
        gridRef.current.on("dragstart", (_event, el) => {
          const node = el.gridstackNode;
          if (node) {
            node.locked = false;
            node.noMove = false;
          }
        });

        gridRef.current.on("dragstop", (_event, el) => {
          const node = el.gridstackNode;
          if (node) {
            node.locked = true;
            node.noMove = true;
          }
        });

        gridRef.current.on("resizestart", (_event, el) => {
          const node = el.gridstackNode;
          if (node) {
            node.locked = false;
          }
        });

        gridRef.current.on("resizestop", (_event, el) => {
          const node = el.gridstackNode;
          if (node) {
            node.locked = true;
          }
        });

        // Force a resize and compact to ensure proper layout
        // gridRef.current.compact();
        // Update the grid size
        // gridRef.current.column(12, 'moveScale');
    };

    initializeGrid();

    return () => {
      // if (timeoutId) {
      //   clearTimeout(timeoutId);
      // }
      if (gridRef.current) {
        gridRef.current.destroy(false);
        gridRef.current = undefined;
      }
    };
  }, [tabId, hiddenWidgets]); // Only re-run when tabId changes

  const toggleCard = (cardId: string) => {
    const pos = positions.find((pos) => pos.id === cardId);
    if (!pos) return;

    if (pos.hidden) {
      // Unhiding the card
      setPositions((prev) =>
        prev.map((p) => p.id === cardId ? { ...p, hidden: false } : p)
      );
      setHiddenWidgets((prev) => prev.filter((id) => id !== cardId));
      // Wait for DOM to update with the new element
      // setTimeout(() => {
      //   if (gridRef.current && containerRef.current) {
      //     const widgetEl = containerRef.current.querySelector(
      //       `[gs-id="${cardId}"]`,
      //     ) as GridItemHTMLElement;
      //     if (widgetEl && !widgetEl.gridstackNode) {
      //       gridRef.current.makeWidget(widgetEl, {
      //         autoPosition: true,
      //         w: pos.w,
      //         h: pos.h,
      //       });
      //     }
      //   }
      // }, 100);
    } else {
      // if (gridRef.current && containerRef.current) {
      //   const widgetEl = containerRef.current.querySelector(
      //     `[gs-id="${cardId}"]`,
      //   ) as GridItemHTMLElement;

      //   if (widgetEl) {
      //     // Remove widget and its DOM element completely
      //     gridRef.current.removeWidget(widgetEl, true);
      //   }
      // }
      setPositions((prev) =>
        prev.map((p) =>
          p.id === cardId ? { ...p, hidden: true, x: 0, y: 0, w: 2, h: 1 } : p
        )
      );
      setHiddenWidgets((prev) => [...prev, cardId]);
    }
  };

  const hiddedWidgets = positions.filter((pos) => pos.hidden).map((pos) => ({
    id: pos.id,
    title: pos.title,
  }));
  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-auto h-full">
        <GridSidebar hiddenWidgets={hiddedWidgets} toggleCard={toggleCard} />
      </div>
      <div
        ref={containerRef}
        className="relative grid-stack flex-1 overflow-hidden"
      >
        {positions
          .filter((pos) => !pos.hidden)
          .map((pos) => (
            <div
              key={pos.id}
              className="grid-stack-item"
              gs-x={pos.x}
              gs-y={pos.y}
              gs-w={pos.w}
              gs-h={pos.h}
              gs-id={pos.id}
            >
              <GridCard
                id={pos.id}
                title={pos.title}
                onClose={() => toggleCard(pos.id)}
              >
                <div className="h-full flex items-center text-muted-foreground">
                  {pos.title} Content
                </div>
              </GridCard>
            </div>
          ))}
      </div>
    </div>
  );
};
