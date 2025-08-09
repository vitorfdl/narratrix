import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useCharacterActions, useCharacterAvatars, useCharacters, useCharactersLoading } from "@/hooks/characterStore";
import { useLorebookStoreActions } from "@/hooks/lorebookStore";
import { Character } from "@/schema/characters-schema";
import { getCharacterById } from "@/services/character-service";
import { exportCharacterToPng } from "@/services/exports/character-png-export";
import { prepareLorebookForEmbedding } from "@/services/imports/shared/lorebook-export";
import { exportSingleToJsonFile } from "@/utils/export-utils";
import { useLocalCharactersPagesSettings } from "@/utils/local-storage";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Plus, RefreshCw, Search, Settings2, SortAsc, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExportOptions, ExportOptionsDialog } from "../chat/components/ExportOptionsDialog";
import { CharacterForm } from "./components/AddCharacterForm";
import { CharacterCard } from "./components/CharacterCard";
import { CharacterImport, CharacterImportHandle } from "./components/CharacterImport";
import { CharacterSidebar } from "./components/CharacterSidebar";

export type CharacterPageSettings = {
  view: {
    mode: "grid" | "list";
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
  const { loadLorebooks } = useLorebookStoreActions();
  const [settings, setSettings] = useLocalCharactersPagesSettings();
  const [, setIsEditing] = useState(false);

  // Use the avatar loading hook for optimized image loading
  const { urlMap: avatarUrlMap, isLoading: isLoadingAvatars, reloadAll: reloadAvatars } = useCharacterAvatars();

  // Local State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [search, setSearch] = useState("");
  const currentProfile = useCurrentProfile();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Export state
  const [isExportOptionsDialogOpen, setIsExportOptionsDialogOpen] = useState(false);
  const [pendingExportCharacterId, setPendingExportCharacterId] = useState<string | null>(null);

  // Ref for CharacterImport imperative handle
  const importComponentRef = useRef<CharacterImportHandle>(null);

  // Import button handler
  const handleImportClick = async () => {
    try {
      const selectedPath = await openDialog({
        multiple: true,
        directory: false,
        filters: [{ name: "Character Files", extensions: ["json", "png"] }],
      });
      if (selectedPath && Array.isArray(selectedPath) && importComponentRef.current) {
        importComponentRef.current.handleImport(selectedPath);
      } else if (selectedPath && typeof selectedPath === "string" && importComponentRef.current) {
        importComponentRef.current.handleImport(selectedPath);
      }
    } catch (error) {
      console.error("Error opening file dialog:", error);
      toast.error("Could not open file dialog", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Page-wide drag and drop listener for character import
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    // Only enable drag-and-drop if neither dialog is open
    if (!editDialogOpen && !createDialogOpen) {
      const setupListener = async () => {
        const currentWindow = getCurrentWebviewWindow();
        try {
          unlisten = await currentWindow.onDragDropEvent(async (event) => {
            if (event.payload.type === "drop" && Array.isArray(event.payload.paths)) {
              setIsDraggingFile(false);
              if (event.payload.paths.length > 0 && importComponentRef.current) {
                importComponentRef.current.handleImport(event.payload.paths);
              }
            } else if (event.payload.type === "enter" || event.payload.type === "over") {
              setIsDraggingFile(true);
            } else if (event.payload.type === "leave") {
              setIsDraggingFile(false);
            }
          });
        } catch (e) {
          console.error("Failed to set up page-wide drag and drop listener:", e);
        }
      };
      setupListener();
    }
    return () => {
      if (unlisten) {
        try {
          unlisten();
        } catch (e) {
          console.warn("Failed to unlisten page-wide drag and drop event:", e);
        }
      }
      // Always reset drag state when dialogs open
      setIsDraggingFile(false);
    };
  }, [editDialogOpen, createDialogOpen]);

  // Export/Import handlers
  const handleExportCharacter = async (characterId: string) => {
    if (!characterId) {
      return;
    }

    try {
      const character: any = await getCharacterById(characterId);
      if (!character) {
        toast.error("Export failed", {
          description: "Character not found.",
        });
        return;
      }

      // Always show options dialog for characters to allow format selection
      setPendingExportCharacterId(characterId);
      setIsExportOptionsDialogOpen(true);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "An unexpected error occurred during export.",
      });
    }
  };

  const handleExportOptionsConfirm = async (options: ExportOptions) => {
    if (!pendingExportCharacterId) {
      return;
    }

    try {
      const character: any = await getCharacterById(pendingExportCharacterId);
      if (!character) {
        toast.error("Export failed", {
          description: "Character not found.",
        });
        return;
      }

      await performCharacterExport(character, options);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "An unexpected error occurred during export.",
      });
    } finally {
      setPendingExportCharacterId(null);
    }
  };

  const performCharacterExport = async (character: any, options: ExportOptions) => {
    const exportedCharacter: any = structuredClone(character);

    // Include lorebook if requested
    if (options.includeLorebooks && character.lorebook_id) {
      const preparedLorebook = await prepareLorebookForEmbedding(character.lorebook_id);
      if (preparedLorebook) {
        exportedCharacter.lorebook = preparedLorebook;
      }
    }

    // Store original avatar path for PNG export
    const originalAvatarPath = character.avatar_path;

    // Clean up character data for export
    delete exportedCharacter.profile_id;
    exportedCharacter.expressions = [];
    exportedCharacter.avatar_path = null;

    const fileName = `character_${character.name.replace(/[^a-zA-Z0-9]/g, "_")}`;

    let success = false;
    if (options.exportFormat === "png") {
      // Export as PNG with embedded data
      success = await exportCharacterToPng(exportedCharacter, originalAvatarPath, fileName);
    } else {
      // Export as JSON
      success = await exportSingleToJsonFile(exportedCharacter, "character", fileName);
    }

    if (!success) {
      console.warn("Export was cancelled or failed");
    }
  };

  const handleEdit = (character: Character) => {
    setSelectedCharacter(character);
    setEditDialogOpen(true);
  };

  const handleDelete = async (character: Character) => {
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
    fetchCharacters(currentProfile!.id).finally(() => {
      reloadAvatars();
    });
  };

  const filteredCharacters = useMemo(() => {
    return characters
      .filter((char) => {
        const matchesSearch = search === "" || char.name.toLowerCase().includes(search.toLowerCase());
        const matchesTags = settings.selectedTags.length === 0 || (char.tags && settings.selectedTags.every((tag) => char.tags?.includes(tag)));
        return matchesSearch && matchesTags;
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
    <div className={`flex h-full overflow-y-auto ${isDraggingFile ? "ring-2 ring-primary ring-inset bg-primary/5" : ""}`}>
      {/* Hidden CharacterImport for drag-and-drop and imperative import */}
      <div className="hidden">
        <CharacterImport
          ref={importComponentRef}
          onImportComplete={(importedCharacter) => {
            // Refresh character list then reload avatar for the newly imported character
            loadLorebooks(currentProfile!.id);
            fetchCharacters(currentProfile!.id).then(() => {
              reloadAvatars(importedCharacter.id);
            });
          }}
        />
      </div>

      <CharacterSidebar characters={characters} selectedTags={settings.selectedTags} onTagSelect={handleTagSelect} />
      <div className="flex flex-1 flex-col">
        {/* Header with filters and controls */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center gap-1 p-4">
            <h1 className="font-bold mr-auto title">Characters</h1>

            {/* Search */}
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search characters..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>

            {/* Refresh */}
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoadingCharacters || isLoadingAvatars} title="Refresh Characters">
              <RefreshCw className={`h-4 w-4 ${isLoadingCharacters || isLoadingAvatars ? "animate-spin" : ""}`} />
            </Button>

            {/* Import Button */}
            <Button variant="outline" size="icon" onClick={handleImportClick} title="Import Character">
              <Upload className="h-4 w-4" />
            </Button>

            {/* View Mode Toggle */}
            {/* <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={settings.view.mode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setSettings((prev: CharacterPageSettings) => ({ ...prev, view: { ...prev.view, mode: "grid" } }))}
                title="Grid View"
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                variant={settings.view.mode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setSettings((prev: CharacterPageSettings) => ({ ...prev, view: { ...prev.view, mode: "list" } }))}
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
            </div> */}

            {/* View Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Grid Settings">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Cards per row</label>
                    <span className="text-xs text-muted-foreground">{settings.view.cardsPerRow}</span>
                  </div>
                  <Slider
                    value={[settings.view.cardsPerRow]}
                    min={1}
                    max={6}
                    step={1}
                    onValueChange={([value]) =>
                      setSettings((prev: CharacterPageSettings) => ({
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

            {/* Sort */}
            <Select
              value={`${settings.sort.field}-${settings.sort.direction}`}
              onValueChange={(value) => {
                const [field, direction] = value.split("-") as [typeof settings.sort.field, typeof settings.sort.direction];
                setSettings((prev: CharacterPageSettings) => ({ ...prev, sort: { field, direction } }));
              }}
            >
              <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon" })} title="Sort Characters">
                <SortAsc className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="type-asc">Type (A-Z)</SelectItem>
                <SelectItem value="type-desc">Type (Z-A)</SelectItem>
                <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
                <SelectItem value="created_at-desc">Recently Created</SelectItem>
              </SelectContent>
            </Select>

            {/* Add Character Button */}
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Character
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingCharacters ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-muted-foreground">Loading characters...</p>
            </div>
          ) : filteredCharacters.length > 0 ? (
            <div className="space-y-6 py-1">
              <div className="p-4">
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
                      onExport={handleExportCharacter}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center h-[calc(100vh-250px)]">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-1">{search || settings.selectedTags.length > 0 ? "No characters match your filters" : "No characters found"}</h3>
              <p className="text-base text-muted-foreground mt-1 mb-6 max-w-md">
                {search || settings.selectedTags.length > 0 ? "Try adjusting your search or filter settings." : "Get started by creating your first character!"}
              </p>
              <Button variant="default" size="lg" onClick={() => setCreateDialogOpen(true)}>
                <Plus size={20} className="mr-2" /> Create Character
              </Button>
            </div>
          )}
        </div>
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

        {/* Export Options Dialog */}
        <ExportOptionsDialog
          open={isExportOptionsDialogOpen}
          onOpenChange={setIsExportOptionsDialogOpen}
          onConfirm={handleExportOptionsConfirm}
          templateName={pendingExportCharacterId ? characters.find((c) => c.id === pendingExportCharacterId)?.name || "" : ""}
          hasFormatTemplate={false}
          hasLorebooks={pendingExportCharacterId ? !!characters.find((c) => c.id === pendingExportCharacterId)?.lorebook_id : false}
          hasAvatar={pendingExportCharacterId ? !!characters.find((c) => c.id === pendingExportCharacterId)?.avatar_path : false}
          isCharacterExport={true}
        />
      </div>
    </div>
  );
}
