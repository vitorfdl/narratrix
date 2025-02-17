"use client";

import React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Pin } from "lucide-react";

interface HiddenWidget {
  id: string;
  title: string;
}

interface GridSidebarProps {
  hiddenWidgets: HiddenWidget[];
  toggleCard: (id: string) => void;
  // You might add callbacks here for handling widget expansion if needed
  // onExpand?: (id: string) => void;
}

const GridSidebar: React.FC<GridSidebarProps> = ({ hiddenWidgets, toggleCard }) => {
  return (
    <div className="left-0 top-0 h-full flex flex-col items-start mt-1 gap-2">
      {hiddenWidgets.map(widget => (
        <Popover key={widget.id}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              style={{ writingMode: "vertical-rl", transform: "rotate(-180deg)", textOrientation: "mixed", fontSize: "0.75rem", height: "auto" }}
              className="h-auto whitespace-nowrap text-xs p-0.5 pt-1 pb-1 font-light"
            >
              {widget.title}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" className="w-48 p-4">
            <div className="flex items-top justify-between">
              <span className="text-xs font-semibold">{widget.title}</span>
              <button 
                onClick={() => toggleCard(widget.id)}
                className="p-1 hover:bg-accent rounded"
              >
                <Pin className="w-3 h-3" />
              </button>
            </div>
            <div className="mt-2">
              Test
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
};

export default GridSidebar;
