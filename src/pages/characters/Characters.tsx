import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Plus, RefreshCw, SortAsc, View } from "lucide-react";
import { useMemo, useState } from "react";
import { CharacterOrAgent, SortOption, ViewSettings, mockCharactersAndAgents } from "../../schema/characters";
import { CharacterForm } from "./components/AddCharacterForm";
import { CharacterCard } from "./components/CharacterCard";
import { CharacterSidebar } from "./components/CharacterSidebar";

export default function Characters() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterOrAgent | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>({
    field: "name",
    direction: "asc",
  });
  const [view, setView] = useState<ViewSettings>({
    cardsPerRow: 6,
    cardSize: "medium",
  });

  const handleEdit = (character: CharacterOrAgent) => {
    setSelectedCharacter(character);
    setEditDialogOpen(true);
  };

  const handleDelete = (_model: CharacterOrAgent) => {
    // TODO: Implement delete functionality
  };

  const handleTagSelect = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const filteredCharacters = useMemo(() => {
    return mockCharactersAndAgents
      .filter((char) => {
        const matchesSearch = char.name.toLowerCase().startsWith(search.toLowerCase());
        const matchesTags = selectedTags.length === 0 || selectedTags.every((tag) => char.tags.includes(tag));
        return matchesSearch && matchesTags;
      })
      .sort((a, b) => {
        const direction = sort.direction === "asc" ? 1 : -1;
        if (sort.field === "name") {
          return direction * a.name.localeCompare(b.name);
        }
        if (sort.field === "type") {
          return direction * a.type.localeCompare(b.type);
        }
        return direction * (b.updatedAt.getTime() - a.updatedAt.getTime());
      });
  }, [mockCharactersAndAgents, search, selectedTags, sort]);

  return (
    <div className="flex h-full">
      <CharacterSidebar characters={mockCharactersAndAgents} selectedTags={selectedTags} onTagSelect={handleTagSelect} />

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-1 border-b p-4">
          <Input autoFocus placeholder="Search characters..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full" />
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <View className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Cards per row</label>
                  <span className="text-xs text-muted-foreground">{view.cardsPerRow}</span>
                </div>
                <Slider
                  value={[view.cardsPerRow]}
                  min={2}
                  max={6}
                  step={1}
                  onValueChange={([value]) =>
                    setView((prev) => ({
                      ...prev,
                      cardsPerRow: value,
                    }))
                  }
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <SortAsc className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSort({ field: "name", direction: "asc" })}>Name (A-Z)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort({ field: "name", direction: "desc" })}>Name (Z-A)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort({ field: "type", direction: "asc" })}>Type (A-Z)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort({ field: "updatedAt", direction: "desc" })}>Recently Updated</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${view.cardsPerRow}, minmax(0, 1fr))`,
            }}
          >
            {filteredCharacters.map((char) => (
              <CharacterCard key={char.id} model={char} cardSize={view.cardSize} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full rounded-none h-14" size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Add Character / Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Character / Agent</DialogTitle>
            </DialogHeader>
            <CharacterForm mode="create" onSuccess={() => setCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit {selectedCharacter?.type === "character" ? "Character" : "Agent"}</DialogTitle>
            </DialogHeader>
            {selectedCharacter && (
              <CharacterForm
                mode="edit"
                initialData={{
                  id: selectedCharacter.id,
                  name: selectedCharacter.name,
                  author: selectedCharacter.author,
                  avatar: selectedCharacter.avatar,
                  type: selectedCharacter.type,
                  ...(selectedCharacter.type === "character"
                    ? {
                        personality: (selectedCharacter as any).personality,
                        preserveLastResponse: (selectedCharacter as any).preserveLastResponse,
                      }
                    : {
                        systemPrompt: (selectedCharacter as any).systemPrompt,
                      }),
                }}
                onSuccess={() => {
                  setEditDialogOpen(false);
                  setSelectedCharacter(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
