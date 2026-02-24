import { closestCenter, DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { LuPlus, LuX } from "react-icons/lu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Chat, ChatTab } from "@/schema/chat-schema";
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
  onTabReorder: (newTabOrder: string[]) => void;
}

interface SortableTabProps {
  tab: ChatTab;
  index: number;
  activeTab?: string;
  onTabChange: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onRenameRequest: (tabId: string) => void;
  onDuplicateRequest: (tabId: string) => void;
  onDeleteRequest: (tabId: string) => void;
}

function SortableTab({ tab, index, activeTab, onTabChange, onCloseTab, onRenameRequest, onDuplicateRequest, onDeleteRequest }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex items-center" ref={setNodeRef} style={style}>
          {index !== 0 && <div className="h-4 w-px bg-border mx-0.5" />}
          <div
            className={cn(
              "group flex items-center px-2 py-1 rounded-t-lg transition-colors font-medium cursor-pointer select-none",
              activeTab === tab.id ? "bg-content text-foreground" : "bg-background text-muted-foreground hover:text-foreground",
              isSortableDragging && "cursor-grabbing",
            )}
            onClick={() => !isSortableDragging && onTabChange(tab.id)}
            onDoubleClick={() => !isSortableDragging && onRenameRequest(tab.id)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                // Middle mouse button
                e.preventDefault();
                onCloseTab(tab.id);
              }
            }}
            {...attributes}
            {...listeners}
          >
            <span className="mr-2 max-h-6 text-sm overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">{tab.name}</span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="opacity-30 group-hover:opacity-100 hover:text-destructive transition-opacity ml-auto flex-shrink-0 pointer-events-auto"
            >
              <LuX className="h-4 w-4" />
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
  );
}

export function ChatTabs({ tabs, allChats, profileId, activeTab, onTabChange, onNewChat, onCloseTab, onRenameRequest, onDuplicateRequest, onDeleteRequest, onTabReorder }: ChatTabsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedTab, setDraggedTab] = useState<ChatTab | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle ctrl/meta + w to close tab
      if ((e.metaKey || e.ctrlKey) && e.key === "w" && activeTab) {
        e.preventDefault();
        onCloseTab(activeTab);
      }

      // Handle ctrl/meta + tab to switch tabs
      if ((e.metaKey || e.ctrlKey) && e.key === "Tab" && tabs.length > 1) {
        e.preventDefault();
        const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        onTabChange(tabs[nextIndex].id);
      }

      // Create Tab
      if ((e.metaKey || e.ctrlKey) && e.key === "t") {
        e.preventDefault();
        onNewChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, onCloseTab, onTabChange, tabs, onNewChat]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    const tab = tabs.find((t) => t.id === active.id);
    setDraggedTab(tab || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
      const newIndex = tabs.findIndex((tab) => tab.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTabs = arrayMove(tabs, oldIndex, newIndex);
        const newTabOrder = newTabs.map((tab) => tab.id);
        onTabReorder(newTabOrder);
      }
    }

    setActiveId(null);
    setDraggedTab(null);
  };

  return (
    <div className="flex items-center border-b border-border bg-background/80 mt-1">
      <ScrollArea className="flex-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex items-center gap-1 px-2">
            <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
              {tabs.map((tab, index) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  index={index}
                  activeTab={activeTab}
                  onTabChange={onTabChange}
                  onCloseTab={onCloseTab}
                  onRenameRequest={onRenameRequest}
                  onDuplicateRequest={onDuplicateRequest}
                  onDeleteRequest={onDeleteRequest}
                />
              ))}
            </SortableContext>

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
              <LuPlus className="h-4 w-4 text-foreground" />
            </ChatMenuDropdown>
          </div>

          <DragOverlay>
            {activeId && draggedTab ? (
              <div className="flex items-center">
                <div
                  className={cn(
                    "group flex items-center px-2 py-1 rounded-t-lg transition-colors font-medium cursor-grabbing select-none shadow-lg",
                    activeTab === draggedTab.id ? "bg-content text-foreground" : "bg-background text-muted-foreground",
                  )}
                >
                  <span className="mr-2 max-h-6 text-sm overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">{draggedTab.name}</span>
                  <button className="opacity-30 group-hover:opacity-100 hover:text-destructive transition-opacity ml-auto flex-shrink-0 pointer-events-none">
                    <LuX className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  );
}
