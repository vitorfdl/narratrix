import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ChatTab } from "@/schema/chat-schema";
import { PlusIcon, X } from "lucide-react";

interface ChatTabsProps {
  tabs: ChatTab[];
  activeTab?: string;
  onTabChange: (tabId: string) => void;
  onNewChat: () => void;
  onCloseTab: (tabId: string) => void;
}

export function ChatTabs({ tabs, activeTab, onTabChange, onNewChat, onCloseTab }: ChatTabsProps) {
  return (
    <div className="flex items-center border-b border-border mt-1">
      <ScrollArea className="flex-1">
        <div className="flex items-center gap-1 px-2">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center px-2 py-1 rounded-t-lg text-sm transition-colors",
                activeTab === tab.id ? "bg-primary text-accent" : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <button onClick={() => onTabChange(tab.id)} className="mr-2 max-h-6 text-sm">
                {tab.name}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="opacity-30 group-hover:opacity-100 hover:text-destructive transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onNewChat}>
                  <PlusIcon className="h-4 w-4 text-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>New Chat</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </ScrollArea>
    </div>
  );
}
