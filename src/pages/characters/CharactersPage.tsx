import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useCharacterActions, useCharacterAvatars, useCharacters, useCharactersLoading } from "@/hooks/characterStore";
import { Character, CharacterUnion } from "@/schema/characters-schema";
import { useLocalCharactersPagesSettings } from "@/utils/local-storage";
import { Plus, RefreshCw, Search, SortAsc, View } from "lucide-react";
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
  const [, setIsEditing] = useState(false);

  // Use the avatar loading hook for optimized image loading
  const { urlMap: avatarUrlMap, isLoading: isLoadingAvatars, reloadAll: reloadAvatars } = useCharacterAvatars();

  // Local State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterUnion | null>(null);
  const [search, setSearch] = useState("");
  const currentProfile = useCurrentProfile();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // // Load characters on mount
  // useEffect(() => {
  //   fetchCharacters(profileId);
  // }, [fetchCharacters, profileId]);

  const handleEdit = (character: CharacterUnion) => {
    setSelectedCharacter(character);
    setEditDialogOpen(true);
  };

  const handleDelete = async (character: CharacterUnion) => {
    const confirmed = await confirm(`Are you sure you want to delete ${character.name}?`);
    if (confirmed) {
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
    fetchCharacters(currentProfile!.id);
    // Also refresh all avatar images when refreshing characters
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
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1 h-4 w-4 text-muted-foreground" />
            <Input autoFocus placeholder="Search characters..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
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

          <Select
            defaultValue={`${settings.sort.field}-${settings.sort.direction}`}
            onValueChange={(value) => {
              const [field, direction] = value.split("-") as ["name" | "type" | "updated_at" | "created_at", "asc" | "desc"];
              setSettings((prev) => ({ ...prev, sort: { field, direction } }));
            }}
          >
            <SelectTrigger noChevron className="w-[30px] p-2">
              <SelectValue>
                <SortAsc className="h-4 w-4" />
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="type-asc">Type (A-Z)</SelectItem>
              <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {filteredCharacters.length > 0 ? (
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
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center h-[calc(100vh-250px)]">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-1">
                {search || settings.selectedTags.length > 0 ? "No characters match your filters" : "No characters found"}
              </h3>
              <p className="text-base text-muted-foreground mt-1 mb-6 max-w-md">
                {search || settings.selectedTags.length > 0
                  ? "Try adjusting your search or filter settings."
                  : "Get started by creating your first character or agent!"}
              </p>
              <Button variant="default" size="lg" onClick={() => setCreateDialogOpen(true)}>
                <Plus size={20} className="mr-2" /> Create Character / Agent
              </Button>
            </div>
          )}
        </div>

        {/* Create Dialog Trigger */}
        {filteredCharacters.length > 0 && (
          <Button className="w-full rounded-none h-14" size="lg" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-5 w-5" />
            Add Character / Agent
          </Button>
        )}
        {/* Create Dialog */}
        <CharacterForm
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          mode="create"
          setIsEditing={setIsEditing}
          onSuccess={(characterId) => {
            setCreateDialogOpen(false);
            fetchCharacters(currentProfile!.id);
            reloadAvatars(characterId);
            setIsEditing(false);
          }}
        />

        {/* Edit Dialog */}
        <CharacterForm
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          mode="edit"
          initialData={selectedCharacter as Character}
          setIsEditing={setIsEditing}
          onSuccess={(characterId) => {
            setEditDialogOpen(false);
            setSelectedCharacter(null);
            reloadAvatars(characterId);
            setIsEditing(false);
          }}
        />
      </div>
    </div>
  );
}
