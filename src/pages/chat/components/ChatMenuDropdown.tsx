import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chat } from "@/schema/chat-schema";
import { formatRelativeTime } from "@/utils/date-format";
import { Clock, PlusIcon, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";

interface ChatListItemProps {
  chat: Chat;
  showTimestamp: boolean;
  onSelectChat: (chatId: string) => void;
  onRenameRequest: (chatId: string) => void;
  onDuplicateRequest: (chatId: string) => void;
  onDeleteRequest: (chatId: string) => void;
  setOpen: (open: boolean) => void;
}

function ChatListItem({ chat, showTimestamp, onSelectChat, onRenameRequest, onDuplicateRequest, onDeleteRequest, setOpen }: ChatListItemProps) {
  const handleSelect = () => {
    setTimeout(() => {
      if (!document.querySelector("[data-radix-context-menu-content]")) {
        onSelectChat(chat.id);
        setOpen(false);
      }
    }, 50);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteRequest(chat.id);
    setOpen(false);
  };

  return (
    <ContextMenu key={chat.id}>
      <ContextMenuTrigger>
        <CommandItem className="flex items-center justify-between py-2 cursor-pointer">
          <div className="flex-grow flex flex-col gap-1" onClick={handleSelect}>
            <div className="flex items-center gap-2">
              <span className="font-medium">{chat.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xxs text-muted-foreground">
            <UsersRound className="!h-3 !w-3" />
            <span className="m-0 p-0">{chat.participants?.length || 0}</span>
          </div>

          {showTimestamp && (
            <div className="flex items-center gap-2 text-xxs text-muted-foreground mr-2">
              <Clock className="!h-3 !w-3" />
              <span className="m-0 p-0">{formatRelativeTime(new Date(chat.updated_at))}</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CommandItem>
        <Separator className="bg-foreground/10" />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onRenameRequest(chat.id)}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={() => onDuplicateRequest(chat.id)}>Duplicate</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface ChatListDisplayProps {
  chats: Chat[];
  showTimestamp: boolean;
  onSelectChat: (chatId: string) => void;
  onRenameRequest: (chatId: string) => void;
  onDuplicateRequest: (chatId: string) => void;
  onDeleteRequest: (chatId: string) => void;
  setOpen: (open: boolean) => void;
}

function ChatListDisplay({
  chats,
  showTimestamp,
  onSelectChat,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
  setOpen,
}: ChatListDisplayProps) {
  return (
    <CommandGroup>
      {chats.map((chat) => (
        <ChatListItem
          key={chat.id}
          chat={chat}
          showTimestamp={showTimestamp}
          onSelectChat={onSelectChat}
          onRenameRequest={onRenameRequest}
          onDuplicateRequest={onDuplicateRequest}
          onDeleteRequest={onDeleteRequest}
          setOpen={setOpen}
        />
      ))}
    </CommandGroup>
  );
}

interface ChatMenuDropdownProps {
  profileId: string;
  allChats: Chat[];
  openChatIds: string[];
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onRenameRequest: (chatId: string) => void;
  onDuplicateRequest: (chatId: string) => void;
  onDeleteRequest: (chatId: string) => void;
  children: React.ReactNode;
}

export function ChatMenuDropdown({
  allChats,
  openChatIds,
  onSelectChat,
  onCreateChat,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
  children,
}: ChatMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("recent");

  const closedChats = allChats?.filter((chat) => !openChatIds.includes(chat.id)) ?? [];

  const filteredChats = closedChats.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedChats = [...filteredChats].sort((a, b) => {
    if (activeTab === "recent") {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return a.name.localeCompare(b.name);
  });

  const chatListHandlers = {
    onSelectChat,
    onRenameRequest,
    onDuplicateRequest,
    onDeleteRequest,
    setOpen,
  };

  const noChatsMessage = searchQuery ? "No matching chats found" : "No closed chats available";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2">
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[350px]" align="start">
        <Command className="rounded-lg border shadow-md bg-accent">
          <div className="flex items-center gap-1 border-b p-4">
            <Input autoFocus placeholder="Search chats..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full" />
          </div>

          <Tabs defaultValue="recent" value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b px-2 pt-2 ">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="recent" className="text-xs">
                  Recent
                </TabsTrigger>
                <TabsTrigger value="name" className="text-xs">
                  Name
                </TabsTrigger>
              </TabsList>
            </div>

            {["recent", "name"].map((tabValue) => (
              <TabsContent key={tabValue} value={tabValue} className="p-0 mt-0">
                <CommandList>
                  <ScrollArea className="h-[300px]">
                    {sortedChats.length > 0 ? (
                      <ChatListDisplay chats={sortedChats} showTimestamp={tabValue === "recent"} {...chatListHandlers} />
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">{noChatsMessage}</div>
                    )}
                  </ScrollArea>
                </CommandList>
              </TabsContent>
            ))}
          </Tabs>

          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onCreateChat();
                  setOpen(false);
                }}
                className="flex items-center gap-2 py-2 cursor-pointer"
              >
                <PlusIcon className="h-4 w-4 text-primary" />
                <span className="font-medium">Create New Chat</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
