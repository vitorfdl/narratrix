import { PopoverArrow } from "@radix-ui/react-popover";
import { Fragment, useEffect, useState } from "react";
import { LuBug, LuPin } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ResizablePopoverContent from "@/components/ui/ResizablePopoverBar";
import { Separator } from "@/components/ui/separator";
import { GridPosition } from "@/schema/grid";
import { useLocalWidgetWidth } from "@/utils/local-storage";
import { renderWidget, WidgetId, widgetConfigurations, widgetTitles } from "../hooks/registry";

interface GridSidebarProps {
  hiddenWidgets: GridPosition[];
  toggleCard: (cardId: string) => void;
  tabId: string;
  inspectorOpen?: boolean;
  onToggleInspector: () => void;
}

interface SidebarWidgetItemProps {
  widgetId: WidgetId;
  tabId: string;
  toggleCard: (cardId: string) => void;
  maxPopoverHeight: number;
}

const SidebarWidgetItem: React.FC<SidebarWidgetItemProps> = ({ widgetId, tabId, toggleCard, maxPopoverHeight }) => {
  const [width, setWidth] = useLocalWidgetWidth(widgetId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`${widgetTitles[widgetId]} widget`}
          title={`${widgetTitles[widgetId]} widget`}
          className="m-1 h-auto bg-transparent whitespace-nowrap text-sm p-0.5 pt-1 pb-1 font-light"
        >
          <div className="flex items-center gap-1">{widgetConfigurations[widgetId].icon}</div>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" className="max-w-[80vw] shadow-lg shadow-foreground/25  w-auto  bg-card p-0">
        <PopoverArrow width={10} height={8} className="fill-muted-foreground" />
        <div className="flex items-top justify-between px-2 py-1">
          <span className="text-xs ml-2 font-semibold">{widgetTitles[widgetId]}</span>
          <button onClick={() => toggleCard(widgetId)} className="p-1 hover:bg-accent rounded">
            <LuPin className="w-3 h-3" />
          </button>
        </div>
        <hr className="mb-1 mt-0.2 border-t border-border" />
        <ResizablePopoverContent className="w-full" minWidth={450} maxHeight={maxPopoverHeight} minHeight={widgetId === "expressions" ? 400 : 200} defaultWidth={width} onWidthChange={setWidth}>
          <div className="w-full h-full">{renderWidget(widgetId, tabId)}</div>
        </ResizablePopoverContent>
      </PopoverContent>
    </Popover>
  );
};

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
        {hiddenWidgets
          .filter((widget) => widget.id in widgetConfigurations)
          .map((widget) => (
            <Fragment key={widget.id}>
              <SidebarWidgetItem widgetId={widget.id as WidgetId} tabId={tabId} toggleCard={toggleCard} maxPopoverHeight={maxPopoverHeight} />
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
            <LuBug className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
