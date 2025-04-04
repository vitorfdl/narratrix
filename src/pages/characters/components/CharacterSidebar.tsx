import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { CharacterUnion } from "../../../schema/characters-schema";

interface CharacterSidebarProps {
  characters: CharacterUnion[];
  selectedTags: string[];
  onTagSelect: (tag: string) => void;
  onClearTags?: () => void;
}

export function CharacterSidebar({
  characters,
  selectedTags,
  onTagSelect,
  onClearTags = () => {
    for (const tag of selectedTags) {
      onTagSelect(tag);
    }
  },
}: CharacterSidebarProps) {
  // Get unique tags from all characters
  const uniqueTags = Array.from(new Set(characters.flatMap((char) => char.tags))).sort();

  // Count characters for each tag
  const tagCounts = uniqueTags.reduce(
    (acc, tag) => {
      if (tag) {
        acc[tag] = characters.filter((char) => char.tags?.includes(tag)).length;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalCharacters = characters.length;
  const filteredCharactersCount =
    selectedTags.length > 0 ? characters.filter((char) => selectedTags.every((tag) => char.tags?.includes(tag))).length : totalCharacters;

  return (
    <div className="w-44 border-r border-border bg-background/95">
      <ScrollArea className="h-[calc(100vh-4rem)]">
        {/* All Characters Header */}
        <div className="py-2 px-3 font-medium text-base">
          All Characters <span className="text-muted-foreground">({filteredCharactersCount})</span>
        </div>

        {/* Active Filters Indicator with Clear button */}
        {selectedTags.length > 0 && (
          <div className="px-3 py-1 flex justify-between items-center text-xs bg-accent/20 border-y border-border">
            <span className="text-muted-foreground">
              {selectedTags.length} {selectedTags.length === 1 ? "filter" : "filters"}
            </span>
            <Button variant="ghost" size="icon" onClick={onClearTags} className="h-5 w-5 rounded-full bg-accent/50 hover:bg-accent">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Tags List */}
        <div className="ml-1">
          {uniqueTags.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No tags available</p>
          ) : (
            <>
              {uniqueTags
                .filter((tag) => tag !== null)
                .map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <div
                      key={tag}
                      className={`relative flex items-center py-0.5 pl-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                        isSelected ? "bg-accent/30" : ""
                      }`}
                      onClick={() => onTagSelect(tag)}
                    >
                      {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-primary rounded-r-sm" />}
                      <span className="font-light text-sm truncate">
                        {tag} <span className="text-muted-foreground text-xs">({tagCounts[tag]})</span>
                      </span>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
