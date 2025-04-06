import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chat } from "@/schema/chat-schema";
import { formatRelativeTime } from "@/utils/date-format";
import { MessageCircle, PlusIcon, UsersRound } from "lucide-react";
import { useState } from "react";

interface ChatMenuDropdownProps {
  profileId: string;
  allChats: Chat[];
  openChatIds: string[];
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onRenameRequest: (chatId: string) => void;
  onDuplicateRequest: (chatId: string) => void;
  onDeleteRequest: (chatId: string) => void;
}

export function ChatMenuDropdown({
  allChats,
  openChatIds,
  onSelectChat,
  onCreateChat,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
}: ChatMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("recent");

  // Filter out chats that are already open in tabs
  const closedChats = allChats?.filter((chat) => !openChatIds.includes(chat.id));

  // Filter based on search query
  const filteredChats = closedChats?.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Sort chats based on active tab
  const sortedChats = [...filteredChats].sort((a, b) => {
    if (activeTab === "recent") {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2">
          <PlusIcon className="h-4 w-4 text-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[350px]" align="start">
        <Command className="rounded-lg border shadow-md">
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

            <TabsContent value="recent" className="p-0 mt-0 ">
              <CommandList>
                <ScrollArea className="h-[300px] ">
                  {sortedChats.length > 0 ? (
                    <CommandGroup>
                      {sortedChats.map((chat) => (
                        <ContextMenu key={chat.id}>
                          <ContextMenuTrigger>
                            <CommandItem
                              onSelect={() => {
                                setTimeout(() => {
                                  if (!document.querySelector("[data-radix-context-menu-content]")) {
                                    onSelectChat(chat.id);
                                    setOpen(false);
                                  }
                                }, 50);
                              }}
                              className="flex items-center justify-between py-2 "
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium">{chat.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <UsersRound className="h-3 w-3" />
                                  <span>{chat.participants?.length || 0} participants</span>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground">{formatRelativeTime(new Date(chat.updated_at))}</span>
                            </CommandItem>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onSelect={() => onRenameRequest(chat.id)}>Rename</ContextMenuItem>
                            <ContextMenuItem onSelect={() => onDuplicateRequest(chat.id)}>Duplicate</ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => onDeleteRequest(chat.id)} className="text-destructive focus:text-destructive">
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </CommandGroup>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {searchQuery ? "No matching chats found" : "No closed chats available"}
                    </div>
                  )}
                </ScrollArea>
              </CommandList>
            </TabsContent>

            <TabsContent value="name" className="p-0 mt-0">
              <CommandList>
                <ScrollArea className="h-[300px] custom-scrollbar">
                  {sortedChats.length > 0 ? (
                    <CommandGroup>
                      {sortedChats.map((chat) => (
                        <ContextMenu key={chat.id}>
                          <ContextMenuTrigger>
                            <CommandItem
                              onSelect={() => {
                                setTimeout(() => {
                                  if (!document.querySelector("[data-radix-context-menu-content]")) {
                                    onSelectChat(chat.id);
                                    setOpen(false);
                                  }
                                }, 50);
                              }}
                              className="flex items-center justify-between py-2"
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium">{chat.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <UsersRound className="h-3 w-3" />
                                  <span>{chat.participants?.length || 0} participants</span>
                                </div>
                              </div>
                            </CommandItem>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onSelect={() => onRenameRequest(chat.id)}>Rename</ContextMenuItem>
                            <ContextMenuItem onSelect={() => onDuplicateRequest(chat.id)}>Duplicate</ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => onDeleteRequest(chat.id)} className="text-destructive focus:text-destructive">
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </CommandGroup>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {searchQuery ? "No matching chats found" : "No closed chats available"}
                    </div>
                  )}
                </ScrollArea>
              </CommandList>
            </TabsContent>
          </Tabs>

          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onCreateChat();
                  setOpen(false);
                }}
                className="flex items-center gap-2 py-2"
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
