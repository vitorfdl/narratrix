import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, Download, FileUp, Plus, RefreshCw, Search, Settings, SortAsc, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useIsLoadingLorebooks, useLorebookStoreActions, useLorebooks, useSelectedLorebookId } from "@/hooks/lorebookStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { Lorebook } from "@/schema/lorebook-schema";
import { exportLorebook } from "@/services/imports/shared/lorebook-export";
import type { LorebookPageSettings } from "@/utils/local-storage";
import { useLocalLorebookPageSettings } from "@/utils/local-storage";
import { LorebookCard } from "./components/LorebookCard";
import { LorebookEntries } from "./components/LorebookEntries";
import { LorebookFormDialog } from "./components/LorebookFormDialog";
import { LorebookImport, LorebookImportHandle } from "./components/LorebookImport";
import { LorebookSidebar } from "./components/LorebookSidebar";

const lorebookGridTemplateColumns = "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))";
const lorebookLoadingSkeletonKeys = Array.from({ length: 8 }, (_, index) => `lorebook-loading-${index}`);
export default function LorebooksPage() {
  const currentProfile = useCurrentProfile();
  const lorebooks = useLorebooks();
  const selectedLorebookId = useSelectedLorebookId();
  const isLoading = useIsLoadingLorebooks();
  const { loadLorebooks, deleteLorebook, selectLorebook, updateLorebook } = useLorebookStoreActions();

  // State for UI controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [lorebookToEdit, setLorebookToEdit] = useState<Lorebook | null>(null);
  const [lorebookToDelete, setLorebookToDelete] = useState<Lorebook | null>(null);
  const [settings, setSettings] = useLocalLorebookPageSettings();
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const selectedTags = settings.selectedTags ?? [];

  // Load lorebooks when component mounts or profile changes
  useEffect(() => {
    if (currentProfile) {
      loadLorebooks(currentProfile.id);
      // Deselect any lorebook if the profile changes
      selectLorebook(null);
    }
  }, [currentProfile, loadLorebooks, selectLorebook]);

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedCategory !== null || selectedTags.length > 0 || showFavoritesOnly;

  const handleTagSelect = (tag: string) => {
    setSettings((prev) => {
      const currentTags = prev.selectedTags ?? [];
      return {
        ...prev,
        selectedTags: currentTags.includes(tag) ? currentTags.filter((currentTag) => currentTag !== tag) : [...currentTags, tag],
      };
    });
  };

  const filteredLorebooks = useMemo(() => {
    return lorebooks
      .filter((lorebook) => {
        const normalizedSearch = searchQuery.trim().toLowerCase();
        if (
          normalizedSearch &&
          !lorebook.name.toLowerCase().includes(normalizedSearch) &&
          !(lorebook.description ?? "").toLowerCase().includes(normalizedSearch) &&
          !lorebook.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
        ) {
          return false;
        }

        if (selectedCategory && lorebook.category !== selectedCategory) {
          return false;
        }

        if (selectedTags.length > 0 && !selectedTags.every((tag) => lorebook.tags?.includes(tag))) {
          return false;
        }

        if (showFavoritesOnly && !lorebook.favorite) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const direction = settings.sort.direction === "asc" ? 1 : -1;
        let comparison = 0;
        const field = settings.sort.field;
        if (field === "name") {
          comparison = a.name.localeCompare(b.name);
        } else if (field === "category") {
          const aCategory = a.category || "";
          const bCategory = b.category || "";
          comparison = aCategory.localeCompare(bCategory);
        } else {
          const aDate = new Date(a[field] || 0).getTime();
          const bDate = new Date(b[field] || 0).getTime();
          comparison = settings.sort.direction === "asc" ? aDate - bDate : bDate - aDate;
        }

        if (field === "name" || field === "category") {
          comparison *= direction;
        }

        if (comparison === 0 && field !== "name") {
          comparison = a.name.localeCompare(b.name);
        }

        return comparison;
      });
  }, [lorebooks, searchQuery, selectedCategory, selectedTags, showFavoritesOnly, settings.sort]);

  // Handle lorebook selection
  const handleSelectLorebook = (id: string) => {
    selectLorebook(id);
  };

  // Handle going back to the list view
  const handleGoBackToList = () => {
    selectLorebook(null);
  };

  // Handle lorebook favorite toggle
  const handleToggleFavorite = (lorebook: Lorebook) => {
    if (currentProfile?.id) {
      updateLorebook(lorebook.id, { favorite: !lorebook.favorite });
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setShowFavoritesOnly(false);
    setSettings((prev) => ({
      ...prev,
      selectedTags: [],
    }));
  };

  const openCreateDialog = () => {
    setLorebookToEdit(null);
    setIsFormDialogOpen(true);
  };

  const openEditDialog = (lorebook: Lorebook) => {
    setLorebookToEdit(lorebook);
    setIsFormDialogOpen(true);
  };

  const handleRefresh = () => {
    if (currentProfile?.id) {
      loadLorebooks(currentProfile.id);
    }
  };

  // Handle lorebook export
  const handleExportLorebook = async (lorebook: Lorebook) => {
    try {
      const success = await exportLorebook(lorebook.id);
      if (success) {
        toast.success("Lorebook exported successfully", {
          description: `${lorebook.name} has been exported.`,
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "An unexpected error occurred during export.",
      });
    }
  };

  const selectedLorebook = lorebooks.find((lb) => lb.id === selectedLorebookId);

  // Create a ref to access the import component's methods
  const importComponentRef = useRef<LorebookImportHandle>(null);

  // Handle direct import button click
  const handleImportClick = async () => {
    try {
      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Lorebook JSON", extensions: ["json"] }],
      });

      if (selectedPath && typeof selectedPath === "string" && importComponentRef.current) {
        importComponentRef.current.handleImport(selectedPath);
      }
    } catch (error) {
      console.error("Error opening file dialog:", error);
      toast.error("Could not open file dialog", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Setup page-wide drag and drop listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const currentWindow = getCurrentWebviewWindow();
      try {
        unlisten = await currentWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === "drop" && Array.isArray(event.payload.paths)) {
            setIsDraggingFile(false);
            // Handle the first dropped file
            if (event.payload.paths.length > 0 && importComponentRef.current) {
              const filePath = event.payload.paths[0];
              importComponentRef.current.handleImport(filePath);
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

    return () => {
      if (unlisten) {
        try {
          unlisten();
        } catch (e) {
          console.warn("Failed to unlisten page-wide drag and drop event:", e);
        }
      }
    };
  }, []);

  return (
    <div className={`relative flex h-full overflow-hidden bg-background ${isDraggingFile ? "ring-2 ring-primary ring-inset" : ""}`}>
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-3xl border border-primary/50 bg-background/80 shadow-2xl shadow-primary/10 backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <FileUp className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Drop a lorebook file to import</h2>
            <p className="mt-2 text-sm text-muted-foreground">JSON lorebook exports are supported.</p>
          </div>
        </div>
      )}

      {!selectedLorebookId ? (
        <>
          <LorebookSidebar
            lorebooks={lorebooks}
            shownCount={filteredLorebooks.length}
            selectedCategory={selectedCategory}
            selectedTags={selectedTags}
            showFavoritesOnly={showFavoritesOnly}
            onCategorySelect={setSelectedCategory}
            onFavoritesToggle={() => setShowFavoritesOnly((value) => !value)}
            onTagSelect={handleTagSelect}
            onClearFilters={resetFilters}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
              <div className="space-y-4 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-1 rounded-full bg-primary" />
                      <h1 className="title font-bold">Lorebooks</h1>
                    </div>
                  </div>

                  <Button className="shrink-0" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" />
                    Add Lorebook
                  </Button>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search lorebooks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 rounded-md border border-border/60 bg-muted/20 pl-9 font-sans text-sm"
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="icon" className="bg-background" onClick={handleRefresh} disabled={isLoading} title="Refresh Lorebooks">
                      <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button variant="outline" size="icon" className="bg-background" onClick={handleImportClick} title="Import Lorebook">
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Select
                      value={`${settings.sort.field}-${settings.sort.direction}`}
                      onValueChange={(value) => {
                        const [field, direction] = value.split("-") as [LorebookPageSettings["sort"]["field"], LorebookPageSettings["sort"]["direction"]];
                        setSettings((prev) => ({ ...prev, sort: { field, direction } }));
                      }}
                    >
                      <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon", className: "bg-background" })} title="Sort Lorebooks">
                        <SortAsc className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                        <SelectItem value="category-asc">Category (A-Z)</SelectItem>
                        <SelectItem value="category-desc">Category (Z-A)</SelectItem>
                        <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
                        <SelectItem value="created_at-desc">Recently Created</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                      <Button variant="ghost" className="h-9 gap-2 text-muted-foreground" onClick={resetFilters}>
                        <X className="h-4 w-4" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/10 to-background">
              <div className="hidden">
                <LorebookImport
                  ref={importComponentRef}
                  onImportComplete={() => {
                    if (currentProfile?.id) {
                      loadLorebooks(currentProfile.id);
                    }
                  }}
                />
              </div>

              {isLoading ? (
                <div className="grid gap-3 p-5" style={{ gridTemplateColumns: lorebookGridTemplateColumns }}>
                  {lorebookLoadingSkeletonKeys.map((skeletonKey) => (
                    <div key={skeletonKey} className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
                      <div className="mb-5 flex items-start gap-3">
                        <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                          <div className="h-5 w-24 animate-pulse rounded-full bg-muted/70" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
                        <div className="h-3 w-4/5 animate-pulse rounded bg-muted/70" />
                        <div className="h-5 w-40 animate-pulse rounded bg-muted/60" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredLorebooks.length > 0 ? (
                <div className="p-5">
                  <div className="grid gap-3" style={{ gridTemplateColumns: lorebookGridTemplateColumns }}>
                    {filteredLorebooks.map((lorebook) => (
                      <LorebookCard
                        key={lorebook.id}
                        lorebook={lorebook}
                        onSelect={handleSelectLorebook}
                        onToggleFavorite={handleToggleFavorite}
                        onExport={handleExportLorebook}
                        onEdit={openEditDialog}
                        onDelete={setLorebookToDelete}
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
                    <h3 className="text-lg font-semibold">{hasActiveFilters ? "No lorebooks match your filters" : "No lorebooks yet"}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {hasActiveFilters ? "Try another search or clear the active filters." : "Create or import a lorebook to organize reusable world, character, and ruleset context."}
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {hasActiveFilters ? (
                        <Button variant="outline" onClick={resetFilters}>
                          <X className="h-4 w-4" />
                          Clear filters
                        </Button>
                      ) : (
                        <Button onClick={openCreateDialog}>
                          <Plus className="h-4 w-4" />
                          Create Lorebook
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleGoBackToList} title="Back to Lorebooks">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-1 rounded-full bg-primary" />
                    <h1 className="title truncate font-bold">{selectedLorebook?.name ?? "Lorebook"}</h1>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {selectedLorebook && (
                  <>
                    <Button variant="outline" size="icon" className="bg-background" onClick={() => handleExportLorebook(selectedLorebook)} title="Export Lorebook">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="bg-background"
                      onClick={() => {
                        setLorebookToEdit(selectedLorebook);
                        setIsFormDialogOpen(true);
                      }}
                      title="Lorebook Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-muted/10 to-background">
            <LorebookEntries lorebookId={selectedLorebookId} profileId={currentProfile?.id || ""} />
          </div>
        </div>
      )}

      {currentProfile?.id && <LorebookFormDialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen} profileId={currentProfile.id} initialLorebook={lorebookToEdit} />}

      {lorebookToDelete && currentProfile?.id && (
        <DestructiveConfirmDialog
          title={`Delete "${lorebookToDelete.name}"?`}
          open={!!lorebookToDelete}
          onOpenChange={(open) => !open && setLorebookToDelete(null)}
          description="Are you sure you want to permanently delete this lorebook and all its entries? This action cannot be undone."
          confirmText="Delete Lorebook"
          onConfirm={async () => {
            await deleteLorebook(lorebookToDelete.id);
            setLorebookToDelete(null);
          }}
        />
      )}
    </div>
  );
}
