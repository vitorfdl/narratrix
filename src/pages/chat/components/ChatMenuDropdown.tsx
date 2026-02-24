import { useMemo, useState } from "react";
import { LuPlus, LuSearch, LuTrash2 } from "react-icons/lu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAgents } from "@/hooks/agentStore";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { cn } from "@/lib/utils";
import type { Chat } from "@/schema/chat-schema";
import { formatRelativeTime } from "@/utils/date-format";

const MAX_VISIBLE_AVATARS = 3;

interface ChatListItemProps {
  chat: Chat;
  avatarUrlMap: Record<string, string>;
  participantNameMap: Map<string, string>;
  onSelectChat: (chatId: string) => void;
  onRenameRequest: (chatId: string) => void;
  onDuplicateRequest: (chatId: string) => void;
  onDeleteRequest: (chatId: string) => void;
  setOpen: (open: boolean) => void;
}

function ChatListItem({ chat, avatarUrlMap, participantNameMap, onSelectChat, onRenameRequest, onDuplicateRequest, onDeleteRequest, setOpen }: ChatListItemProps) {
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

  const participants = chat.participants ?? [];
  const visible = participants.slice(0, MAX_VISIBLE_AVATARS);
  const extraCount = Math.max(0, participants.length - MAX_VISIBLE_AVATARS);

  return (
    <ContextMenu key={chat.id}>
      <ContextMenuTrigger>
        <CommandItem className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer rounded-md group/row" onSelect={handleSelect}>
          {/* Name + last used */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate leading-tight">{chat.name}</div>
            <div className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">{formatRelativeTime(new Date(chat.updated_at))}</div>
          </div>

          {/* Avatar deck */}
          <div className="flex items-center shrink-0">
            {visible.map((p, i) => {
              const name = participantNameMap.get(p.id) ?? "?";
              const avatarUrl = avatarUrlMap[p.id];
              return (
                <Avatar key={p.id} className={cn("w-6 h-6 ring-2 ring-accent rounded-full", i > 0 && "-ml-2")}>
                  {avatarUrl ? <AvatarImage className="object-cover" src={avatarUrl} alt={name} /> : null}
                  <AvatarFallback className="text-[10px] bg-muted font-medium">{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              );
            })}
            {extraCount > 0 && (
              <span className="flex items-center justify-center w-6 h-6 -ml-2 rounded-full bg-muted ring-2 ring-accent text-[10px] font-medium text-muted-foreground z-10">+{extraCount}</span>
            )}
          </div>

          {/* Delete - visible on hover */}
          <div
            className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-destructive inline-flex items-center justify-center rounded-md transition-all cursor-pointer hover:bg-destructive/10 opacity-0 group-hover/row:opacity-100"
            onClick={handleDelete}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleDelete(e as unknown as React.MouseEvent);
              }
            }}
          >
            <LuTrash2 className="h-3 w-3" />
          </div>
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
  avatarUrlMap: Record<string, string>;
  participantNameMap: Map<string, string>;
  onSelectChat: (chatId: string) => void;
  onRenameRequest: (chatId: string) => void;
  onDuplicateRequest: (chatId: string) => void;
  onDeleteRequest: (chatId: string) => void;
  setOpen: (open: boolean) => void;
}

function ChatListDisplay({ chats, avatarUrlMap, participantNameMap, onSelectChat, onRenameRequest, onDuplicateRequest, onDeleteRequest, setOpen }: ChatListDisplayProps) {
  return (
    <CommandGroup className="p-1">
      {chats.map((chat) => (
        <ChatListItem
          key={chat.id}
          chat={chat}
          avatarUrlMap={avatarUrlMap}
          participantNameMap={participantNameMap}
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

export function ChatMenuDropdown({ allChats, openChatIds, onSelectChat, onCreateChat, onRenameRequest, onDuplicateRequest, onDeleteRequest, children }: ChatMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "name">("recent");

  const characters = useCharacters();
  const agents = useAgents();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();

  const participantNameMap = useMemo(
    () => new Map<string, string>([...characters.map((c) => [c.id, c.name] as [string, string]), ...agents.map((a) => [a.id, a.name] as [string, string])]),
    [characters, agents],
  );

  const closedChats = allChats?.filter((chat) => !openChatIds.includes(chat.id)) ?? [];

  const filteredChats = closedChats.filter((chat) => {
    if (!searchQuery) {
      return true;
    }
    const q = searchQuery.toLowerCase();
    if (chat.name.toLowerCase().includes(q)) {
      return true;
    }
    return (chat.participants ?? []).some((p) => participantNameMap.get(p.id)?.toLowerCase().includes(q));
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    if (sortMode === "recent") {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return a.name.localeCompare(b.name);
  });

  const chatListHandlers = { onSelectChat, onRenameRequest, onDuplicateRequest, onDeleteRequest, setOpen };
  const noChatsMessage = searchQuery ? "No matching chats found" : "No closed chats available";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2">
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[340px]" align="start">
        <Command className="rounded-lg border shadow-lg bg-accent">
          {/* Search + sort row */}
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
            <LuSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <input
              autoFocus
              placeholder="Search chats or participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 text-xs h-6 flex-1 min-w-0 placeholder:text-muted-foreground/50"
            />
            <div className="flex items-center shrink-0 rounded-md bg-muted/50 p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setSortMode("recent")}
                className={cn("px-1.5 py-0.5 rounded text-[11px] transition-colors", sortMode === "recent" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setSortMode("name")}
                className={cn("px-1.5 py-0.5 rounded text-[11px] transition-colors", sortMode === "name" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                Name
              </button>
            </div>
          </div>

          {/* Chat list */}
          <CommandList>
            <ScrollArea className="h-[300px]">
              {sortedChats.length > 0 ? (
                <ChatListDisplay chats={sortedChats} avatarUrlMap={avatarUrlMap} participantNameMap={participantNameMap} {...chatListHandlers} />
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">{noChatsMessage}</div>
              )}
            </ScrollArea>
          </CommandList>

          <CommandSeparator />
          <CommandList>
            <CommandGroup className="p-1">
              <CommandItem
                onSelect={() => {
                  onCreateChat();
                  setOpen(false);
                }}
                className="flex items-center gap-2 py-1.5 cursor-pointer rounded-md"
              >
                <LuPlus className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Create New Chat</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
