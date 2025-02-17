import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChatTab } from '@/types/chat';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatTabsProps {
  tabs: ChatTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onNewChat: () => void;
  onCloseTab: (tabId: string) => void;
}

export function ChatTabs({ tabs, activeTab, onTabChange, onNewChat, onCloseTab }: ChatTabsProps) {
  return (
    <div className="flex items-center border-b border-border">
      <ScrollArea className="flex-1">
        <div className="flex items-center gap-1 px-2">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center px-4 py-1 rounded-t-sm text-sm transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <button
                onClick={() => onTabChange(tab.id)}
                className="mr-2"
              >
                {tab.name}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="opacity-30 group-hover:opacity-100 hover:text-destructive transition-opacity"
              >
                <X className="h-4 w-4 " />
              </button>
            </div>
          ))}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={onNewChat}
                >
                  <Plus className="h-4 w-4 text-white" />
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