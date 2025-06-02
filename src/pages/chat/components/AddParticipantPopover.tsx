import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgents } from "@/hooks/agentStore";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { AgentType } from "@/schema/agent-schema";
import { Character } from "@/schema/characters-schema";
import { sortTemplatesByFavoriteAndName } from "@/utils/sorting";
import { Bot, Search, User, UserRound } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

// Unified participant type for the popover
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
  title?: string;
}

const AddParticipantPopover = ({ children, isOpen, onOpenChange, onSelectCharacter, existingParticipantIds, title }: AddParticipantPopoverProps) => {
  const characters = useCharacters();
  const agents = useAgents();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "characters" | "agents">("all");
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantItem[]>([]);

  useEffect(() => {
    // Convert characters and agents to unified participant items
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
      avatar_path: null, // Agents don't have avatars currently
      description: agent.description,
    }));

    const allParticipants = sortTemplatesByFavoriteAndName([...characterItems, ...agentItems]);

    // Filter participants based on search term and tab
    const filtered = allParticipants.filter((participant) => {
      // Filter out already added participants
      if (existingParticipantIds.includes(participant.id)) {
        return false;
      }

      // Filter by search term
      const nameMatches = participant.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!nameMatches) {
        return false;
      }

      // Filter by tab selection
      if (activeTab === "all") {
        return true;
      }
      if (activeTab === "characters") {
        return participant.type === "character";
      }
      if (activeTab === "agents") {
        return participant.type === "agent";
      }

      return false;
    });

    setFilteredParticipants(filtered);
  }, [characters, agents, searchTerm, activeTab, existingParticipantIds]);

  const handleSelect = (participant: ParticipantItem) => {
    onSelectCharacter(participant.id);
    onOpenChange(false);
  };

  const renderParticipantItem = (participant: ParticipantItem) => {
    // Get the avatar URL from the cached map for characters or use default
    const avatarUrl = participant.type === "character" ? avatarUrlMap[participant.id] || participant.avatar_path : null;

    const getIcon = () => {
      if (participant.type === "agent") {
        return <Bot size={16} className="text-primary" />;
      }
      return <User size={16} className="text-muted-foreground" />;
    };

    return (
      <div
        key={participant.id}
        className="flex items-center gap-1.5 hover:bg-accent/30 rounded-md cursor-pointer py-1 px-2"
        onClick={() => handleSelect(participant)}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={participant.name} className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs">{getIcon()}</div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium truncate">{participant.name}</span>
          <span className="text-[10px] text-muted-foreground capitalize">{participant.type}</span>
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2 rounded-md bg-muted" align="end" side="top" sideOffset={10}>
        <div className="flex items-center gap-2 mb-2">
          <UserRound size={14} className="text-primary" />
          <h4 className="text-sm font-medium">{title || "Add Participant"}</h4>
          <div className="text-xs text-muted-foreground ml-auto">{filteredParticipants.length} available</div>
        </div>

        <Separator className="my-2 relative" />

        <div className="relative mb-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search participants..."
            className="pl-7 text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "characters" | "agents")}>
          <TabsList className="grid grid-cols-3 mb-2 h-7">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="characters" className="text-xs">
              Characters
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-xs">
              Agents
            </TabsTrigger>
          </TabsList>

          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map(renderParticipantItem)
            ) : (
              <div className="text-center py-1 text-muted-foreground text-sm">
                No participants found
                <div className="text-xs text-muted-foreground/70">Try a different search term</div>
              </div>
            )}
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

export default AddParticipantPopover;
