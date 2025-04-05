import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCharacters } from "@/hooks/characterStore";
import { CharacterUnion } from "@/schema/characters-schema";
import { Search, UserRound } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "characters" | "agents">("all");
  const [filteredCharacters, setFilteredCharacters] = useState<CharacterUnion[]>([]);

  useEffect(() => {
    // Filter characters based on search term and tab
    const filtered = characters.filter((character) => {
      // Filter out already added characters
      if (existingParticipantIds.includes(character.id)) {
        return false;
      }

      // Filter by search term
      const nameMatches = character.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!nameMatches) {
        return false;
      }

      // Filter by tab selection
      if (activeTab === "all") {
        return true;
      }
      if (activeTab === "characters") {
        return character.type === "character";
      }
      if (activeTab === "agents") {
        return character.type === "agent";
      }

      return false;
    });

    setFilteredCharacters(filtered);
  }, [characters, searchTerm, activeTab, existingParticipantIds]);

  const handleSelect = (character: CharacterUnion) => {
    onSelectCharacter(character.id);
    onOpenChange(false);
  };

  const renderCharacterItem = (character: CharacterUnion) => {
    const avatar = character.avatar_path as string;

    return (
      <div
        key={character.id}
        className="flex items-center gap-1.5 hover:bg-accent/30 rounded-md cursor-pointer py-1 px-2"
        onClick={() => handleSelect(character)}
      >
        {avatar ? (
          <img src={avatar} alt={character.name} className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs">{character.name[0]}</div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium truncate">{character.name}</span>
          <span className="text-[10px] text-muted-foreground capitalize">{character.type}</span>
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2 rounded-md" align="end" side="top" sideOffset={10}>
        <div className="flex items-center gap-2 mb-2">
          <UserRound size={14} className="text-primary" />
          <h4 className="text-sm font-medium">{title || "Add Participant"}</h4>
          <div className="text-xs text-muted-foreground ml-auto">{filteredCharacters.length} available</div>
        </div>

        <Separator className="my-2 relative" />

        <div className="relative mb-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search characters..."
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
            {filteredCharacters.length > 0 ? (
              filteredCharacters.map(renderCharacterItem)
            ) : (
              <div className="text-center py-1 text-muted-foreground text-sm">
                No characters found
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
