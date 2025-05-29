import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useIsLoadingLorebooks, useLorebookStoreActions, useLorebooks, useSelectedLorebookId } from "@/hooks/lorebookStore";
import { Lorebook } from "@/schema/lorebook-schema";
import { exportLorebook } from "@/services/imports/shared/lorebook-export";
import { useLocalLorebookPageSettings } from "@/utils/local-storage";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  Download,
  Edit,
  Filter,
  Globe,
  HeartIcon,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  SortAsc,
  Trash2,
  Upload,
  User,
  View,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LorebookEntries } from "./components/LorebookEntries";
import { LorebookFormDialog } from "./components/LorebookFormDialog";
import { LorebookImport, LorebookImportHandle } from "./components/LorebookImport";

// Settings type for lorebook page view preferences
export type LorebookPageSettings = {
  sort: {
    field: "name" | "category" | "updated_at" | "created_at";
    direction: "asc" | "desc";
  };
  listWidth: "full" | "wide" | "medium" | "narrow";
};

// Default settings
export const defaultLorebookPageSettings: LorebookPageSettings = {
  sort: {
    field: "updated_at",
    direction: "desc",
  },
  listWidth: "full",
};

// Map categories to icons
const categoryIcons: Record<NonNullable<Lorebook["category"]>, React.ElementType> = {
  ruleset: ScrollText,
  character: User,
  world: Globe,
};

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

  // Load lorebooks when component mounts or profile changes
  useEffect(() => {
    if (currentProfile) {
      loadLorebooks(currentProfile.id);
      // Deselect any lorebook if the profile changes
      selectLorebook(null);
    }
  }, [currentProfile, loadLorebooks, selectLorebook]);

  // Add effect to handle Escape key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedLorebookId) {
        handleGoBackToList();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedLorebookId]); // Re-run effect if selectedLorebookId changes

  // Get all unique categories
  const categories = Array.from(new Set(lorebooks.map((lb) => lb.category).filter(Boolean) as string[]));

  // Filtered and sorted lorebooks
  const filteredLorebooks = useMemo(() => {
    return lorebooks
      .filter((lorebook) => {
        // Search by name
        if (searchQuery && !lorebook.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }

        // Filter by category
        if (selectedCategory && lorebook.category !== selectedCategory) {
          return false;
        }

        // Filter by favorites
        if (showFavoritesOnly && !lorebook.favorite) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const direction = settings.sort.direction === "asc" ? 1 : -1;
        let comparison = 0;

        // Primary sort field
        const field = settings.sort.field;
        if (field === "name") {
          comparison = a.name.localeCompare(b.name);
        } else if (field === "category") {
          const aCategory = a.category || "";
          const bCategory = b.category || "";
          comparison = aCategory.localeCompare(bCategory);
        } else {
          // Date comparison (updated_at or created_at)
          const aDate = new Date(a[field] || 0).getTime();
          const bDate = new Date(b[field] || 0).getTime();
          // For dates, descending means newest first, so reverse the comparison
          comparison = bDate - aDate;
        }

        // Apply direction
        comparison *= direction;

        // Secondary sort by name (ascending) if primary sort is equal
        if (comparison === 0 && field !== "name") {
          comparison = a.name.localeCompare(b.name);
        }

        return comparison;
      });
  }, [lorebooks, searchQuery, selectedCategory, showFavoritesOnly, settings.sort]);

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

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setShowFavoritesOnly(false);
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

  // Apply width classes based on settings
  const widthClasses = {
    full: "w-full",
    wide: "w-full max-w-6xl mx-auto",
    medium: "w-full max-w-4xl mx-auto",
    narrow: "w-full max-w-xl mx-auto",
  }[settings.listWidth];

  return (
    <div className={`flex flex-col h-full ${widthClasses} ${isDraggingFile ? "ring-2 ring-primary ring-inset bg-primary/5" : ""}`}>
      {!selectedLorebookId ? (
        <>
          {/* Header with filters and controls */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="flex items-center gap-1 p-4">
              <h1 className="font-bold mr-auto title">Lorebooks</h1>

              {/* Search */}
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search lorebooks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>

              {/* Refresh */}
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading} title="Refresh Lorebooks">
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>

              {/* Import Button */}
              <Button variant="outline" size="icon" onClick={handleImportClick} title="Import Lorebook">
                <Upload className="h-4 w-4" />
              </Button>

              {/* List Width Settings */}
              <Select
                value={settings.listWidth}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, listWidth: value as LorebookPageSettings["listWidth"] }))}
              >
                <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon" })} title="List Width">
                  <View className="h-5 w-5 mr-1" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="full">Full Width</SelectItem>
                  <SelectItem value="wide">Wide</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="narrow">Narrow</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select
                value={`${settings.sort.field}-${settings.sort.direction}`}
                onValueChange={(value) => {
                  const [field, direction] = value.split("-") as ["name" | "category" | "created_at" | "updated_at", "asc" | "desc"];
                  setSettings((prev) => ({ ...prev, sort: { field, direction } }));
                }}
              >
                <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon" })} title="Sort Lorebooks">
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

              {/* Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`relative ${showFavoritesOnly || selectedCategory ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                    title="Filter Lorebooks"
                  >
                    <Filter className="h-4 w-4" />
                    {(showFavoritesOnly || selectedCategory) && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary/80" />
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter Lorebooks</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <div className="p-2">
                    <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showFavoritesOnly}
                        onChange={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 focus:ring-1"
                      />
                      <span>Favorites only</span>
                    </label>

                    <div className="mb-2">
                      <p className="text-sm font-medium mb-1">Category</p>
                      <select
                        value={selectedCategory || ""}
                        onChange={(e) => setSelectedCategory(e.target.value || null)}
                        className="w-full rounded border border-input bg-background p-1.5 text-sm focus:ring-ring focus:ring-1 focus:outline-none"
                      >
                        <option value="">All Categories</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={resetFilters}>
                      Reset Filters
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Add Lorebook Button */}
              <Button
                onClick={() => {
                  setLorebookToEdit(null);
                  setIsFormDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Lorebook
              </Button>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 overflow-y-auto page-container">
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
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-accent/50 hover:bg-accent/50">
                      <TableHead className="w-[35%]">Name</TableHead>
                      <TableHead className="w-[15%]">Category</TableHead>
                      <TableHead className="w-[20%]">Tags</TableHead>
                      <TableHead className="w-[10%] text-center">Max Depth</TableHead>
                      <TableHead className="w-[10%] text-center">Max Tokens</TableHead>
                      <TableHead className="w-[10%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array(10)
                      .fill(0)
                      .map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-4 w-3/4" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-2/3" />
                          </TableCell>
                          <TableCell className="flex gap-1">
                            <Skeleton className="h-5 w-12 rounded-full" />
                            <Skeleton className="h-5 w-12 rounded-full" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-4 w-8 mx-auto" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-4 w-12 mx-auto" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="h-8 w-8 rounded inline-block" />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : filteredLorebooks.length > 0 ? (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background/95 hover:bg-background/95">
                      <TableHead className="w-[35%]">Name</TableHead>
                      <TableHead className="w-[15%]">Category</TableHead>
                      <TableHead className="w-[20%]">Tags</TableHead>
                      <TableHead className="w-[10%] text-center">Max Depth</TableHead>
                      <TableHead className="w-[10%] text-center">Max Tokens</TableHead>
                      <TableHead className="w-[10%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLorebooks.map((lorebook) => (
                      <TableRow
                        key={lorebook.id}
                        className="bg-background/50 hover:bg-accent transition-colors cursor-pointer"
                        onClick={() => handleSelectLorebook(lorebook.id)}
                        data-state={selectedLorebookId === lorebook.id ? "selected" : undefined}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(lorebook);
                              }}
                              title={lorebook.favorite ? "Remove from favorites" : "Add to favorites"}
                            >
                              <HeartIcon
                                size={16}
                                className={`${lorebook.favorite ? "text-primary fill-primary" : "text-muted-foreground"} transition-colors`}
                              />
                            </Button>
                            <span className="truncate" title={lorebook.name}>
                              {lorebook.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lorebook.category ? (
                            <div className="flex items-center gap-1 text-sm">
                              {(() => {
                                const Icon = categoryIcons[lorebook.category];
                                return Icon ? <Icon size={12} className="text-muted-foreground flex-shrink-0" /> : null;
                              })()}
                              <span className="truncate capitalize" title={lorebook.category}>
                                {lorebook.category}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {lorebook.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {lorebook.tags.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{lorebook.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{lorebook.max_depth ?? "-"}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{lorebook.max_tokens ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportLorebook(lorebook);
                              }}
                              title="Export Lorebook"
                            >
                              <Download size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLorebookToEdit(lorebook);
                                setIsFormDialogOpen(true);
                              }}
                              title="Edit Lorebook..."
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLorebookToDelete(lorebook);
                              }}
                              title="Delete Lorebook"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center h-[calc(100vh-250px)]">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-1">
                  {searchQuery || selectedCategory || showFavoritesOnly ? "No lorebooks match your filters" : "No lorebooks found"}
                </h3>
                <p className="text-base text-muted-foreground mt-1 mb-6 max-w-md">
                  {searchQuery || selectedCategory || showFavoritesOnly
                    ? "Try adjusting your search or filter settings."
                    : "Get started by creating your first lorebook collection!"}
                </p>
                <Button variant="default" size="default" onClick={() => setIsFormDialogOpen(true)}>
                  <Plus size={18} className="mr-1.5" /> Create New Lorebook
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Header for selected lorebook */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="flex items-center gap-1 p-4">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleGoBackToList} title="Back to Lorebooks">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="font-bold mr-auto title">
                Lorebook: <span className="italic text-primary">{selectedLorebook?.name}</span>
              </h1>
              {selectedLorebook && (
                <Button variant="outline" size="icon" onClick={() => handleExportLorebook(selectedLorebook)} title="Export Lorebook">
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 overflow-hidden">
            <LorebookEntries lorebookId={selectedLorebookId} profileId={currentProfile?.id || ""} />
          </div>
        </>
      )}

      {currentProfile?.id && (
        <LorebookFormDialog
          open={isFormDialogOpen}
          onOpenChange={setIsFormDialogOpen}
          profileId={currentProfile.id}
          initialLorebook={lorebookToEdit}
        />
      )}

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
