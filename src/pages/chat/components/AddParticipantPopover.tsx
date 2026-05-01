import { ReactNode, useMemo, useState } from "react";
import { BiSolidZap } from "react-icons/bi";
import { LuSearch, LuUser, LuUsers } from "react-icons/lu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgents } from "@/hooks/agentStore";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { cn } from "@/lib/utils";
import type { AgentType } from "@/schema/agent-schema";
import type { Character } from "@/schema/characters-schema";
import { sortTemplatesByFavoriteAndName } from "@/utils/sorting";

type ParticipantItem = {
  id: string;
  name: string;
  type: "character" | "agent";
  avatar_path?: string | null;
  description?: string | null;
};

interface AddParticipantPopoverProps {
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCharacter: (characterId: string) => void;
  existingParticipantIds: string[];
  pickableParticipantIds?: string[];
  title?: string;
}

const FILTER_TABS = ["all", "characters", "agents"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const FILTER_LABELS: Record<FilterTab, string> = {
  all: "All",
  characters: "Chars",
  agents: "Agents",
};

const SECTION_LABELS: Record<"character" | "agent", string> = {
  character: "Characters",
  agent: "Agents",
};

const AddParticipantPopover = ({ children, isOpen, onOpenChange, onSelectCharacter, existingParticipantIds, pickableParticipantIds, title }: AddParticipantPopoverProps) => {
  const characters = useCharacters();
  const agents = useAgents();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const availableParticipants = useMemo<ParticipantItem[]>(() => {
    const characterItems: ParticipantItem[] = characters.map((character: Character) => ({
      id: character.id,
      name: character.name,
      type: "character" as const,
      avatar_path: character.avatar_path,
      description: character.custom?.personality || null,
    }));

    const agentItems: ParticipantItem[] = agents.map((agent: AgentType) => ({
      id: agent.id,
      name: agent.name,
      type: "agent" as const,
      avatar_path: null,
      description: agent.description,
    }));

    const sorted = sortTemplatesByFavoriteAndName([...characterItems, ...agentItems]);

    return sorted.filter((participant) => {
      if (existingParticipantIds.includes(participant.id)) {
        return false;
      }
      if (pickableParticipantIds && !pickableParticipantIds.includes(participant.id)) {
        return false;
      }
      return true;
    });
  }, [characters, agents, existingParticipantIds, pickableParticipantIds]);

  const counts = useMemo(
    () => ({
      all: availableParticipants.length,
      characters: availableParticipants.filter((p) => p.type === "character").length,
      agents: availableParticipants.filter((p) => p.type === "agent").length,
    }),
    [availableParticipants],
  );

  const filteredParticipants = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return availableParticipants.filter((participant) => {
      if (search && !participant.name.toLowerCase().includes(search)) {
        return false;
      }
      if (activeTab === "characters") {
        return participant.type === "character";
      }
      if (activeTab === "agents") {
        return participant.type === "agent";
      }
      return true;
    });
  }, [availableParticipants, searchTerm, activeTab]);

  const groupedParticipants = useMemo(() => {
    if (activeTab !== "all") {
      return [{ key: activeTab, label: null as string | null, items: filteredParticipants }];
    }
    const groups: { key: string; label: string | null; items: ParticipantItem[] }[] = [];
    const characterItems = filteredParticipants.filter((p) => p.type === "character");
    const agentItems = filteredParticipants.filter((p) => p.type === "agent");
    if (characterItems.length > 0) {
      groups.push({ key: "characters", label: SECTION_LABELS.character, items: characterItems });
    }
    if (agentItems.length > 0) {
      groups.push({ key: "agents", label: SECTION_LABELS.agent, items: agentItems });
    }
    return groups;
  }, [activeTab, filteredParticipants]);

  const handleSelect = (participant: ParticipantItem) => {
    onSelectCharacter(participant.id);
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0 w-[340px] overflow-hidden" align="end" side="top" sideOffset={4}>
        <Command className="rounded-lg border shadow-lg bg-accent">
          {/* Search row */}
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2.5">
            <LuSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <input
              autoFocus
              placeholder={title ? `Search ${title.toLowerCase()}...` : "Search participants..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 text-xs h-6 flex-1 min-w-0 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Filter tabs with counts */}
          <div className="flex items-center gap-1 border-b border-border/40 px-2 py-1.5">
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <span>{FILTER_LABELS[tab]}</span>
                  <span className={cn("rounded px-1 text-[9.5px] tabular-nums", isActive ? "bg-muted/60 text-muted-foreground" : "text-muted-foreground/60")}>{counts[tab]}</span>
                </button>
              );
            })}
          </div>

          {/* Participant list */}
          <CommandList>
            <ScrollArea className="h-[300px]">
              {filteredParticipants.length > 0 ? (
                groupedParticipants.map((group) => (
                  <CommandGroup key={group.key} className="p-1.5">
                    {group.label ? <div className="px-2 pt-1 pb-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/60">{group.label}</div> : null}
                    {group.items.map((participant) => {
                      const avatarUrl = participant.type === "character" ? avatarUrlMap[participant.id] || participant.avatar_path : null;
                      const isAgent = participant.type === "agent";
                      return (
                        <CommandItem
                          key={participant.id}
                          value={`${participant.id}-${participant.name}`}
                          className="group/item flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 data-[selected=true]:bg-muted/50"
                          onSelect={() => handleSelect(participant)}
                        >
                          <div className="relative shrink-0">
                            <Avatar className="h-8 w-8 rounded-full ring-1 ring-border/40">
                              {avatarUrl ? <AvatarImage className="object-cover" src={avatarUrl} alt={participant.name} /> : null}
                              <AvatarFallback className={cn("flex items-center justify-center text-[10px] font-medium", isAgent ? "bg-primary/10" : "bg-muted/70")}>
                                {isAgent ? <BiSolidZap size={14} className="text-primary" /> : <LuUser className="h-3.5 w-3.5 text-muted-foreground" />}
                              </AvatarFallback>
                            </Avatar>
                            {isAgent ? (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-accent bg-primary">
                                <BiSolidZap size={7} className="text-primary-foreground" />
                              </span>
                            ) : null}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-xs font-semibold leading-tight">{participant.name}</span>
                            {participant.description ? (
                              <span className="truncate text-[10.5px] leading-tight text-muted-foreground/70">{participant.description}</span>
                            ) : (
                              <span className="text-[10px] capitalize leading-tight text-muted-foreground/50">{participant.type}</span>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/40">
                    <LuUsers className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                  <p className="text-xs text-muted-foreground">{searchTerm ? "No participants found" : "No participants available"}</p>
                  {searchTerm ? <p className="text-[10.5px] text-muted-foreground/60">Try a different search or filter</p> : null}
                </div>
              )}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AddParticipantPopover;
