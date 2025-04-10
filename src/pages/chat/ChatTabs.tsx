import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Chat, ChatTab } from "@/schema/chat-schema";
import { PlusIcon, X } from "lucide-react";
import { useEffect } from "react";
import { ChatMenuDropdown } from "./components/ChatMenuDropdown";

interface ChatTabsProps {
  tabs: ChatTab[];
  allChats: Chat[];
  profileId: string;
  activeTab?: string;
  onTabChange: (tabId: string) => void;
  onNewChat: () => void;
  onCloseTab: (tabId: string) => void;
  onRenameRequest: (tabId: string) => void;
  onDuplicateRequest: (tabId: string) => void;
  onDeleteRequest: (tabId: string) => void;
}

export function ChatTabs({
  tabs,
  allChats,
  profileId,
  activeTab,
  onTabChange,
  onNewChat,
  onCloseTab,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
}: ChatTabsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "w" && activeTab) {
        e.preventDefault();
        onCloseTab(activeTab);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, onCloseTab]);

  return (
    <div className="flex items-center border-b border-border bg-background/80 mt-1">
      <ScrollArea className="flex-1">
        <div className="flex items-center gap-1 px-2">
          {tabs.map((tab, index) => (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div className="flex items-center">
                  {index !== 0 && <div className="h-4 w-px bg-border mx-0.5" />}
                  <div
                    className={cn(
                      "group flex items-center px-2 py-1 rounded-t-lg transition-colors font-medium cursor-pointer",
                      activeTab === tab.id ? "bg-content text-foreground" : "bg-background text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onTabChange(tab.id)}
                  >
                    <span className="mr-2 max-h-6 text-sm overflow-hidden text-ellipsis whitespace-nowrap">{tab.name}</span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      className="opacity-30 group-hover:opacity-100 hover:text-destructive transition-opacity ml-auto flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => onRenameRequest(tab.id)}>Rename</ContextMenuItem>
                <ContextMenuItem onSelect={() => onDuplicateRequest(tab.id)}>Duplicate</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => onDeleteRequest(tab.id)} className="text-destructive focus:text-destructive">
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          <ChatMenuDropdown
            profileId={profileId}
            allChats={allChats}
            openChatIds={tabs.map((tab) => tab.id)}
            onSelectChat={onTabChange}
            onCreateChat={onNewChat}
            onRenameRequest={onRenameRequest}
            onDuplicateRequest={onDuplicateRequest}
            onDeleteRequest={onDeleteRequest}
          >
            <PlusIcon className="h-4 w-4 text-foreground" />
          </ChatMenuDropdown>
        </div>
      </ScrollArea>
    </div>
  );
}
