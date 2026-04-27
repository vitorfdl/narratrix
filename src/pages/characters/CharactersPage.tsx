import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FileUp, Plus, RefreshCw, Search, SortAsc, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useCharacterActions, useCharacterAvatars, useCharacters, useCharactersLoading } from "@/hooks/characterStore";
import { useLorebookStoreActions } from "@/hooks/lorebookStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { Character } from "@/schema/characters-schema";
import { getCharacterById } from "@/services/character-service";
import { exportCharacterToPng } from "@/services/exports/character-png-export";
import { prepareLorebookForEmbedding } from "@/services/imports/shared/lorebook-export";
import { exportSingleToJsonFile } from "@/utils/export-utils";
import { useLocalCharactersPagesSettings } from "@/utils/local-storage";
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

const cardGridMinWidthBySize: Record<CharacterPageSettings["view"]["cardSize"], number> = {
  small: 13,
  medium: 17,
  large: 21,
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

  const handleClearTags = () => {
    setSettings((prev) => ({
      ...prev,
      selectedTags: [],
    }));
  };

  const handleClearFilters = () => {
    setSearch("");
    handleClearTags();
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
        const matchesTags = settings.selectedTags.length === 0 || settings.selectedTags.every((tag) => (char.tags ?? []).includes(tag));
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

  const hasActiveFilters = search.trim().length > 0 || settings.selectedTags.length > 0;
  const gridTemplateColumns = useMemo(() => {
    const minWidth = cardGridMinWidthBySize[settings.view.cardSize];
    return `repeat(auto-fit, minmax(min(100%, ${minWidth}rem), 1fr))`;
  }, [settings.view.cardSize]);
  const loadingSkeletonKeys = useMemo(() => Array.from({ length: 8 }, (_, itemIndex) => `character-loading-${itemIndex}`), []);

  return (
    <div className={`relative flex h-full overflow-hidden bg-background ${isDraggingFile ? "ring-2 ring-primary ring-inset" : ""}`}>
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-3xl border border-primary/50 bg-background/80 shadow-2xl shadow-primary/10 backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <FileUp className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Drop character files to import</h2>
            <p className="mt-2 text-sm text-muted-foreground">JSON and PNG character cards are supported.</p>
          </div>
        </div>
      )}

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

      <CharacterSidebar characters={characters} selectedTags={settings.selectedTags} onTagSelect={handleTagSelect} onClearTags={handleClearTags} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-1 rounded-full bg-primary" />
                  <h1 className="title font-bold">Characters</h1>
                </div>
              </div>

              <Button className="shrink-0" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Character
              </Button>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search characters..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 rounded-md border border-border/60 bg-muted/20 pl-9 font-sans text-sm"
                />
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="icon" className="bg-background" onClick={handleRefresh} disabled={isLoadingCharacters || isLoadingAvatars} title="Refresh Characters">
                  <RefreshCw className={`h-4 w-4 ${isLoadingCharacters || isLoadingAvatars ? "animate-spin" : ""}`} />
                </Button>

                <Button variant="outline" size="icon" className="bg-background" onClick={handleImportClick} title="Import Character">
                  <Upload className="h-4 w-4" />
                </Button>

                <Select
                  value={`${settings.sort.field}-${settings.sort.direction}`}
                  onValueChange={(value) => {
                    const [field, direction] = value.split("-") as [typeof settings.sort.field, typeof settings.sort.direction];
                    setSettings((prev: CharacterPageSettings) => ({ ...prev, sort: { field, direction } }));
                  }}
                >
                  <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon", className: "bg-background" })} title="Sort Characters">
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

                {hasActiveFilters && (
                  <Button variant="ghost" className="h-9 gap-2 text-muted-foreground" onClick={handleClearFilters}>
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/10 to-background">
          {isLoadingCharacters ? (
            <div className="grid gap-3 p-5" style={{ gridTemplateColumns }}>
              {loadingSkeletonKeys.map((skeletonKey) => (
                <div key={skeletonKey} className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-sm">
                  <div className="aspect-[4/3] animate-pulse bg-muted/50" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
                    <div className="flex gap-2">
                      <div className="h-5 w-16 animate-pulse rounded-full bg-muted/70" />
                      <div className="h-5 w-20 animate-pulse rounded-full bg-muted/70" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCharacters.length > 0 ? (
            <div className="p-5">
              <div className="grid gap-3" style={{ gridTemplateColumns }}>
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
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center">
              <div className="max-w-sm rounded-3xl border border-border/60 bg-card/70 p-8 shadow-xl shadow-black/5">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">{hasActiveFilters ? "No characters match your filters" : "No characters yet"}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {hasActiveFilters ? "Try another search or clear the active tag filters." : "Create or import a character to start building this profile."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {hasActiveFilters ? (
                    <Button variant="outline" onClick={handleClearFilters}>
                      <X className="h-4 w-4" />
                      Clear filters
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Create Character
                      </Button>
                      <Button variant="outline" onClick={handleImportClick}>
                        <Upload className="h-4 w-4" />
                        Import
                      </Button>
                    </>
                  )}
                </div>
              </div>
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
