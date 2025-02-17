"use client";

import React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface HiddenWidget {
  id: string;
  title: string;
}

interface SidebarPopoverProps {
  hiddenWidgets: HiddenWidget[];
  // You might add callbacks here for handling widget expansion if needed
  // onExpand?: (id: string) => void;
}

const SidebarPopover: React.FC<SidebarPopoverProps> = ({ hiddenWidgets }) => {
  return (
    <div className="absolute right-0 top-0 h-full z-50 flex items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
            className="whitespace-nowrap"
          >
            Hidden Widgets
          </Button>
        </PopoverTrigger>
        <PopoverContent side="left" className="w-48 p-4">
          <div className="flex flex-col space-y-2">
            {hiddenWidgets && hiddenWidgets.length > 0 ? (
              hiddenWidgets.map(widget => (
                <Button
                  key={widget.id}
                  variant="ghost"
                  className="text-start"
                  // onClick handler can be added to trigger the expansion of the widget
                  onClick={() => { /* handle widget expansion if needed */ }}
                >
                  {widget.title}
                </Button>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No hidden widgets</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SidebarPopover; 