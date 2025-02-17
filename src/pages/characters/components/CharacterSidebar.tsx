import { CharacterOrAgent } from "../../../types/characters";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CharacterSidebarProps {
    characters: CharacterOrAgent[];
    selectedTags: string[];
    onTagSelect: (tag: string) => void;
}

export function CharacterSidebar({
    characters,
    selectedTags,
    onTagSelect,
}: CharacterSidebarProps) {
    // Get unique tags from all characters
    const uniqueTags = Array.from(
        new Set(characters.flatMap((char) => char.tags))
    ).sort();

    return (
        <div className="w-40 border-r p-4">
            <h2 className="mb-4 text-lg font-semibold text-white">Filter by Tags</h2>
            <ScrollArea className="h-[calc(100vh-8rem)]">
                <div className="space-y-2">
                    {uniqueTags.map((tag) => (
                        <Badge
                            key={tag}
                            variant={selectedTags.includes(tag) ? "default" : "outline"}
                            className="mr-2 cursor-pointer text-white"
                            onClick={() => onTagSelect(tag)}
                        >
                            {tag}
                        </Badge>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
} 