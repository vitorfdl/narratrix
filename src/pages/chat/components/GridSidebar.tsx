import { PopoverArrow } from "@radix-ui/react-popover";
import { BugIcon, Pin } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ResizablePopoverContent from "@/components/ui/ResizablePopoverBar";
import { Separator } from "@/components/ui/separator";
import { GridPosition } from "@/schema/grid";
import { renderWidget, WidgetId, widgetConfigurations, widgetTitles } from "../hooks/registry";

interface GridSidebarProps {
  hiddenWidgets: GridPosition[];
  toggleCard: (cardId: string) => void;
  tabId: string;
  inspectorOpen?: boolean;
  onToggleInspector: () => void;
}

export const GridSidebar: React.FC<GridSidebarProps> = ({ hiddenWidgets, toggleCard, tabId, onToggleInspector }) => {
  const [maxPopoverHeight, setMaxPopoverHeight] = useState(600);

  // Calculate dynamic maxHeight based on viewport
  useEffect(() => {
    const updateMaxHeight = () => {
      // Calculate height as 90% of viewport height
      const calculatedHeight = Math.floor(window.innerHeight * 0.9);
      setMaxPopoverHeight(calculatedHeight);
    };

    // Set initial height
    updateMaxHeight();

    // Update on resize
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  return (
    <div className="w-auto h-full">
      <div className="left-0 top-0 h-full justify-center flex flex-col items-start mt-1 gap-2">
        <Separator orientation="horizontal" className="w-full my-0" />
        {hiddenWidgets.map((widget) => (
          <Fragment key={widget.id}>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  aria-label={`${widgetTitles[widget.id as WidgetId]} widget`}
                  title={`${widgetTitles[widget.id as WidgetId]} widget`}
                  className="m-1 h-auto bg-transparent whitespace-nowrap text-sm p-0.5 pt-1 pb-1 font-light"
                >
                  <div className="flex items-center gap-1">
                    {widgetConfigurations[widget.id as WidgetId].icon}
                    {/* {widgetTitles[widget.id as WidgetId]} */}
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="right" className="max-w-[80vw] shadow-lg shadow-foreground/25  w-auto  bg-card p-0">
                <PopoverArrow width={10} height={8} className="fill-muted-foreground" />
                <div className="flex items-top justify-between px-2 py-1">
                  <span className="text-xs ml-2 font-semibold">{widgetTitles[widget.id as WidgetId]}</span>
                  <button onClick={() => toggleCard(widget.id)} className="p-1 hover:bg-accent rounded">
                    <Pin className="w-3 h-3" />
                  </button>
                </div>
                <hr className="mb-1 mt-0.2 border-t border-border" />
                <ResizablePopoverContent className="w-full" minWidth={450} maxHeight={maxPopoverHeight} minHeight={widget.id === "expressions" ? 400 : 200}>
                  <div className="w-full h-full">{renderWidget(widget.id as WidgetId, tabId)}</div>
                </ResizablePopoverContent>
              </PopoverContent>
            </Popover>
            <Separator orientation="horizontal" className="my-0" />
          </Fragment>
        ))}

        <div className="w-full flex items-center justify-center">
          <Button
            variant="outline"
            aria-label="Toggle Live Inspector"
            title="Live Inspector — Ctrl/Cmd + '"
            className="m-1 h-auto bg-transparent whitespace-nowrap text-sm p-0.5 pt-1 pb-1 font-light"
            onClick={() => onToggleInspector()}
          >
            <BugIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
