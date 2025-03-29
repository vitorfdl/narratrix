import ResizablePopoverContent from "@/components/ui/ResizablePopoverBar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GridPosition } from "@/schema/grid";
import { Pin } from "lucide-react";
import { WidgetId, renderWidget, widgetTitles } from "../hooks/registry";

interface GridSidebarProps {
  hiddenWidgets: GridPosition[];
  toggleCard: (cardId: string) => void;
  tabId: string;
}

export const GridSidebar: React.FC<GridSidebarProps> = ({ hiddenWidgets, toggleCard, tabId }) => {
  return (
    <div className="w-auto h-full">
      <div className="left-0 top-0 h-full flex flex-col items-start mt-1 gap-2">
        {hiddenWidgets.map((widget) => (
          <Popover key={widget.id}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(-180deg)",
                  textOrientation: "mixed",
                  fontSize: "0.75rem",
                  height: "auto",
                }}
                className="h-auto bg-transparent whitespace-nowrap text-xs p-0.5 pt-1 pb-1 font-light"
              >
                {widgetTitles[widget.id as WidgetId]}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" className="max-w-[80vw] w-auto shadow-md">
              <div className="flex items-top justify-between">
                <span className="text-xs font-semibold">{widgetTitles[widget.id as WidgetId]}</span>
                <button onClick={() => toggleCard(widget.id)} className="p-1 hover:bg-accent rounded">
                  <Pin className="w-3 h-3" />
                </button>
              </div>
              <hr className="mb-1 mt-0.2 border-t border-border" />
              <ResizablePopoverContent className="p-0">{renderWidget(widget.id as WidgetId, tabId)}</ResizablePopoverContent>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
};
