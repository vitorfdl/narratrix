import { Fragment, ReactNode, useEffect, useState } from "react";
import { BiSolidZap } from "react-icons/bi";
import { LuSearch, LuUser } from "react-icons/lu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

const AddParticipantPopover = ({ children, isOpen, onOpenChange, onSelectCharacter, existingParticipantIds, pickableParticipantIds, title }: AddParticipantPopoverProps) => {
  const characters = useCharacters();
  const agents = useAgents();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantItem[]>([]);

  useEffect(() => {
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

    const allParticipants = sortTemplatesByFavoriteAndName([...characterItems, ...agentItems]);

    const filtered = allParticipants.filter((participant) => {
      if (existingParticipantIds.includes(participant.id)) {
        return false;
      }
      if (pickableParticipantIds && !pickableParticipantIds.includes(participant.id)) {
        return false;
      }
      if (!participant.name.toLowerCase().includes(searchTerm.toLowerCase())) {
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

    setFilteredParticipants(filtered);
  }, [characters, agents, searchTerm, activeTab, existingParticipantIds, pickableParticipantIds]);

  const handleSelect = (participant: ParticipantItem) => {
    onSelectCharacter(participant.id);
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0 w-[300px]" align="end" side="top" sideOffset={10}>
        <Command className="rounded-lg border shadow-lg bg-accent">
          {/* Search + filter row */}
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
            <LuSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <input
              autoFocus
              placeholder={title ? `Search ${title.toLowerCase()}...` : "Search participants..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 text-xs h-6 flex-1 min-w-0 placeholder:text-muted-foreground/50"
            />
            <div className="flex items-center shrink-0 rounded-md bg-muted/50 p-0.5 gap-0.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn("px-1.5 py-0.5 rounded text-[11px] transition-colors", activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {FILTER_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>

          {/* Participant list */}
          <CommandList>
            <ScrollArea className="h-[260px]">
              {filteredParticipants.length > 0 ? (
                <CommandGroup className="p-1">
                  {filteredParticipants.map((participant) => {
                    const avatarUrl = participant.type === "character" ? avatarUrlMap[participant.id] || participant.avatar_path : null;
                    return (
                      <Fragment key={participant.id}>
                        <CommandItem
                          value={`${participant.id}-${participant.name}`}
                          className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer rounded-md"
                          onSelect={() => handleSelect(participant)}
                        >
                          <Avatar className="w-6 h-6 shrink-0 rounded-full">
                            {avatarUrl ? <AvatarImage className="object-cover" src={avatarUrl} alt={participant.name} /> : null}
                            <AvatarFallback className="text-[10px] bg-muted font-medium flex items-center justify-center">
                              {participant.type === "agent" ? <BiSolidZap size={12} className="text-primary" /> : <LuUser className="h-3 w-3 text-muted-foreground" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate leading-tight">{participant.name}</span>
                            <span className="text-[11px] text-muted-foreground/50 shrink-0 capitalize">· {participant.type}</span>
                          </div>
                        </CommandItem>
                        <Separator className="bg-foreground/10" />
                      </Fragment>
                    );
                  })}
                </CommandGroup>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">{searchTerm ? "No participants found" : "No participants available"}</div>
              )}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AddParticipantPopover;
