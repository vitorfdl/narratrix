import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useProfile } from "@/hooks/ProfileContext";
import { useCharacterActions, useCharacterAvatars, useCharacters, useCharactersLoading } from "@/hooks/characterStore";
import { CharacterUnion } from "@/schema/characters-schema";
import { useLocalCharactersPagesSettings } from "@/utils/local-storage";
import { Plus, RefreshCw, SortAsc, View } from "lucide-react";
import { useMemo, useState } from "react";
import { CharacterForm } from "./components/AddCharacterForm";
import { CharacterCard } from "./components/CharacterCard";
import { CharacterSidebar } from "./components/CharacterSidebar";

export type CharacterPageSettings = {
  view: {
    cardsPerRow: number;
    cardSize: "small" | "medium" | "large";
  };
  sort: {
    field: "name" | "type" | "updated_at" | "created_at";
    direction: "asc" | "desc";
  };
  selectedTags: string[];
};

export default function Characters() {
  // Store and Local Storage
  const characters = useCharacters();
  const isLoadingCharacters = useCharactersLoading();
  const { fetchCharacters, deleteCharacter } = useCharacterActions();
  const [settings, setSettings] = useLocalCharactersPagesSettings();

  // Use the avatar loading hook for optimized image loading
  const { urlMap: avatarUrlMap, isLoading: isLoadingAvatars, reloadAll: reloadAvatars } = useCharacterAvatars();

  // Local State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterUnion | null>(null);
  const [search, setSearch] = useState("");
  const profile = useProfile();

  // // Load characters on mount
  // useEffect(() => {
  //   fetchCharacters(profileId);
  // }, [fetchCharacters, profileId]);

  const handleEdit = (character: CharacterUnion) => {
    setSelectedCharacter(character);
    setEditDialogOpen(true);
  };

  const handleDelete = async (character: CharacterUnion) => {
    if (window.confirm(`Are you sure you want to delete ${character.name}?`)) {
      await deleteCharacter(character.id);
    }
  };

  const handleTagSelect = (tag: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag) ? prev.selectedTags.filter((t) => t !== tag) : [...prev.selectedTags, tag],
    }));
  };

  const handleRefresh = () => {
    fetchCharacters(profile.currentProfile!.id);
    // Also refresh all avatar images when refreshing characters
    console.log("refreshing avatars");
    reloadAvatars();
  };

  const filteredCharacters = useMemo(() => {
    return characters
      .filter((char) => {
        const matchesSearch = search === "" || char.name.toLowerCase().includes(search.toLowerCase());

        const matchesTags = settings.selectedTags.length === 0 || (char.tags && settings.selectedTags.every((tag) => char.tags?.includes(tag)));

        const result = matchesSearch && matchesTags;
        return result;
      })
      .sort((a, b) => {
        const direction = settings.sort.direction === "asc" ? 1 : -1;
        if (settings.sort.field === "name") {
          return direction * a.name.localeCompare(b.name);
        }
        if (settings.sort.field === "type") {
          return direction * a.type.localeCompare(b.type);
        }
        const aDate = settings.sort.field === "created_at" ? a.created_at : a.updated_at;
        const bDate = settings.sort.field === "created_at" ? b.created_at : b.updated_at;
        return direction * (new Date(bDate).getTime() - new Date(aDate).getTime());
      });
  }, [characters, search, settings.selectedTags, settings.sort]);

  return (
    <div className="flex h-full">
      <CharacterSidebar characters={characters} selectedTags={settings.selectedTags} onTagSelect={handleTagSelect} />

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-1 border-b p-4">
          <Input autoFocus placeholder="Search characters..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full" />
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className={`h-4 w-4 ${isLoadingCharacters || isLoadingAvatars ? "animate-spin" : ""}`} />
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
                  <span className="text-xs text-muted-foreground">{settings.view.cardsPerRow}</span>
                </div>
                <Slider
                  value={[settings.view.cardsPerRow]}
                  min={2}
                  max={6}
                  step={1}
                  onValueChange={([value]) =>
                    setSettings((prev) => ({
                      ...prev,
                      view: {
                        ...prev.view,
                        cardsPerRow: value,
                      },
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
              <DropdownMenuItem onClick={() => setSettings((prev) => ({ ...prev, sort: { field: "name", direction: "asc" } }))}>
                Name (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettings((prev) => ({ ...prev, sort: { field: "name", direction: "desc" } }))}>
                Name (Z-A)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettings((prev) => ({ ...prev, sort: { field: "type", direction: "asc" } }))}>
                Type (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettings((prev) => ({ ...prev, sort: { field: "updated_at", direction: "desc" } }))}>
                Recently Updated
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${settings.view.cardsPerRow}, minmax(0, 1fr))`,
            }}
          >
            {filteredCharacters.map((char) => (
              <CharacterCard
                key={char.id}
                model={char}
                cardSize={settings.view.cardSize}
                avatarUrl={avatarUrlMap[char.id]}
                isLoadingAvatar={isLoadingAvatars}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
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
            <CharacterForm
              mode="create"
              onSuccess={() => {
                setCreateDialogOpen(false);
                reloadAvatars();
              }}
            />
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
                initialData={selectedCharacter}
                onSuccess={() => {
                  setEditDialogOpen(false);
                  setSelectedCharacter(null);
                  // Reload avatar images after editing
                  reloadAvatars();
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
