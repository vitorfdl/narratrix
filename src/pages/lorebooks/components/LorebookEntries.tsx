import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cosineSimilarity } from "ai";
import { ChevronDown } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import { LuBookDown, LuBookUp, LuBot, LuDatabase, LuFilter, LuFlaskConical, LuGripVertical, LuPlus, LuSearch, LuTrash, LuTrash2, LuUser } from "react-icons/lu";
import { toast } from "sonner";
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useIndexingStatus, useIsIndexing, useIsLoadingEntries, useLorebookStoreActions, useLorebooks, useSelectedLorebookEntries } from "@/hooks/lorebookStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { cn } from "@/lib/utils";
import type { Lorebook, LorebookEntry } from "@/schema/lorebook-schema";
import { embedText } from "@/services/embedding-service";
import { parseStoredVector } from "@/services/lorebook-indexing-service";
import { LorebookEntryDialog } from "./LorebookEntryDialog";

interface LorebookEntriesProps {
  lorebookId: string;
  profileId: string;
  compact?: boolean;
}

interface SortableEntryRowProps {
  entry: LorebookEntry;
  onToggleEnabled: (entry: LorebookEntry) => void;
  onEdit: (entry: LorebookEntry) => void;
  onDelete: (entry: LorebookEntry) => void;
  compact?: boolean;
  ragEnabled?: boolean;
}

function SortableEntryRow({ entry, onToggleEnabled, onEdit, onDelete, compact = false, ragEnabled = false }: SortableEntryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  // Map insertion types to readable names and icons
  const insertionTypeDisplay: { [key: string]: { name: string; icon: React.ElementType } } = {
    lorebook_top: { name: "Top", icon: LuBookUp },
    lorebook_bottom: { name: "Bottom", icon: LuBookDown },
    user: { name: "User", icon: LuUser },
    assistant: { name: "Assistant", icon: LuBot },
  };

  const displayInfo = insertionTypeDisplay[entry.insertion_type] || { name: entry.insertion_type, icon: null };
  const IconComponent = displayInfo.icon;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn("cursor-pointer border-border/60 transition-colors hover:bg-muted/50", isDragging && "bg-accent opacity-80 shadow-lg")}
      {...attributes}
      onClick={() => onEdit(entry)}
    >
      <TableCell className="p-0 pl-2 w-10">
        <div {...listeners} className="inline-block cursor-grab rounded-md px-1 py-2 hover:bg-muted">
          <LuGripVertical size={16} className="text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="p-2 w-10">
        <Checkbox
          checked={entry.enabled}
          onCheckedChange={(_checked) => {
            onToggleEnabled(entry);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="w-4 h-4"
          title={entry.enabled ? "Disable entry" : "Enable entry"}
        />
      </TableCell>
      <TableCell className={cn("font-medium truncate max-w-[200px]", compact && "text-xs")}>{entry.comment}</TableCell>
      <TableCell className="max-w-[100px] truncate text-center">
        {entry.group_key ? (
          <Badge variant="secondary" className="text-xs">
            {entry.group_key}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">None</span>
        )}
      </TableCell>
      <TableCell className="max-w-[50px] truncate text-xs text-center">
        <div className="flex items-center justify-center gap-1.5">
          {IconComponent && <IconComponent className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          <span className="truncate">{displayInfo.name}</span>
          {(entry.insertion_type === "user" || entry.insertion_type === "assistant") && (
            <Badge variant="outline" className="ml-1 px-1.5 py-0 h-4 text-[10px] font-normal">
              {entry.depth}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="w-[4%] max-w-[50px] text-center">
        <div className={cn("inline-block h-2.5 w-2.5 rounded-full", entry.constant ? "bg-primary" : "bg-muted")} title={entry.constant ? "Constant" : "Not Constant"} />
      </TableCell>
      {!ragEnabled && (
        <TableCell className={cn("w-[15%] max-w-[250px] text-center", compact && "text-xs")}>
          <div className="flex flex-wrap gap-1 justify-center">
            {entry.keywords.slice(0, 2).map((keyword) => (
              <Badge key={keyword} variant="outline" className={"truncate text-[0.55rem] py-0 px-1 m-0"}>
                {keyword}
              </Badge>
            ))}
            {entry.keywords.length > 2 && (
              <Badge variant="outline" className={"text-[0.55rem] py-0 px-1 m-0"}>
                +{entry.keywords.length - 2}
              </Badge>
            )}
          </div>
        </TableCell>
      )}
      <TableCell className="w-[10%] text-xs text-center">{entry.priority}</TableCell>
      {ragEnabled && (
        <TableCell className="w-10 text-center">
          <div className={cn("inline-block h-2.5 w-2.5 rounded-full", entry.vector_content != null ? "bg-green-500" : "bg-muted")} title={entry.vector_content != null ? "Indexed" : "Not indexed"} />
        </TableCell>
      )}
      <TableCell className="w-10">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
        >
          <LuTrash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface RagTestResult {
  entryId: string;
  comment: string;
  similarity: number;
  content: string;
  enabled: boolean;
}

const BELOW_THRESHOLD_PREVIEW = 3;
const entryLoadingSkeletonKeys = Array.from({ length: 5 }, (_, index) => `entry-loading-${index}`);

function RagTestResults({ results, threshold }: { results: RagTestResult[]; threshold: number }) {
  const [showAllBelow, setShowAllBelow] = useState(false);

  const activated = useMemo(() => results.filter((r) => r.similarity >= threshold), [results, threshold]);
  const belowThreshold = useMemo(() => results.filter((r) => r.similarity < threshold), [results, threshold]);
  const visibleBelow = showAllBelow ? belowThreshold : belowThreshold.slice(0, BELOW_THRESHOLD_PREVIEW);
  const hiddenBelowCount = belowThreshold.length - visibleBelow.length;

  if (results.length === 0) {
    return <p className="text-muted-foreground text-sm">No indexed entries found to compare against.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">
        Activated: <span className="text-green-500">{activated.length}</span>
        <span className="text-muted-foreground"> / {results.length} indexed</span>
      </div>

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {activated.map((r) => (
          <div key={r.entryId} className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <span className="font-medium truncate">{r.comment || "Untitled"}</span>
                {!r.enabled && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                    disabled
                  </Badge>
                )}
              </div>
              <span className="text-xs font-mono tabular-nums shrink-0 text-green-500">{r.similarity.toFixed(4)}</span>
            </div>
            <p className="text-muted-foreground text-xs line-clamp-2 pl-4">{r.content}</p>
          </div>
        ))}

        {activated.length > 0 && visibleBelow.length > 0 && (
          <div className="flex items-center gap-2 py-2 px-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted-foreground text-[11px] shrink-0">below threshold ({threshold.toFixed(2)})</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        {visibleBelow.map((r) => (
          <div key={r.entryId} className="rounded-md border border-border p-3 text-sm opacity-50">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{r.comment || "Untitled"}</span>
              </div>
              <span className="text-xs font-mono tabular-nums shrink-0 text-muted-foreground">{r.similarity.toFixed(4)}</span>
            </div>
            <p className="text-muted-foreground text-xs line-clamp-1 truncate">{r.content}</p>
          </div>
        ))}

        {hiddenBelowCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAllBelow(true)}
            className="flex items-center justify-center gap-1 w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Show {hiddenBelowCount} more
          </button>
        )}

        {showAllBelow && belowThreshold.length > BELOW_THRESHOLD_PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAllBelow(false)}
            className="flex items-center justify-center gap-1 w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

function RagTestDialog({ open, onOpenChange, lorebook, entries }: { open: boolean; onOpenChange: (open: boolean) => void; lorebook: Lorebook; entries: LorebookEntry[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RagTestResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !lorebook.embedding_model_id) {
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      const { embedding: queryVector } = await embedText(lorebook.embedding_model_id, query.trim());
      const scored: RagTestResult[] = [];
      let dimensionMismatchCount = 0;
      for (const entry of entries) {
        const entryVector = parseStoredVector(entry.vector_content);
        if (!entryVector) {
          continue;
        }
        if (entryVector.length !== queryVector.length) {
          dimensionMismatchCount++;
          continue;
        }
        const similarity = cosineSimilarity(queryVector, entryVector);
        scored.push({ entryId: entry.id, comment: entry.comment, similarity, content: entry.content, enabled: entry.enabled });
      }
      scored.sort((a, b) => b.similarity - a.similarity);
      setResults(scored);
      if (dimensionMismatchCount > 0) {
        toast.warning(`Skipped ${dimensionMismatchCount} entr${dimensionMismatchCount === 1 ? "y" : "ies"} indexed under a different embedding model. Re-index this lorebook.`);
      }
    } catch (err) {
      toast.error(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSearching(false);
    }
  }, [query, lorebook.embedding_model_id, entries]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setHasSearched(false);
    }
  }, [open]);

  const threshold = lorebook.similarity_threshold ?? 0.7;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>Test RAG Search</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4 py-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Enter a query to test against indexed entries..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[80px] flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleSearch();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              Threshold: <span className="font-medium text-foreground">{threshold.toFixed(2)}</span> · {entries.filter((e) => parseStoredVector(e.vector_content)).length} indexed entries
            </span>
            <Button size="sm" onClick={handleSearch} disabled={isSearching || !query.trim()}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {hasSearched && <RagTestResults results={results} threshold={threshold} />}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LorebookEntries({ lorebookId, compact = false }: LorebookEntriesProps) {
  const currentProfile = useCurrentProfile();
  const allEntries = useSelectedLorebookEntries();
  const isLoading = useIsLoadingEntries();
  const lorebooks = useLorebooks();
  const indexingStatus = useIndexingStatus();
  const isIndexing = useIsIndexing();
  const { loadLorebookEntries, updateLorebookEntry, deleteLorebookEntry, selectLorebookEntry, selectLorebook, loadIndexingStatus, indexAllEntries, clearIndex } = useLorebookStoreActions();

  const lorebook = lorebooks.find((lb) => lb.id === lorebookId);
  const ragEnabled = lorebook?.rag_enabled ?? false;

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGroupKey, setFilterGroupKey] = useState<string | null>(null);
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortField, setSortField] = useState<keyof LorebookEntry>("priority");
  const [entryToDelete, setEntryToDelete] = useState<LorebookEntry | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<LorebookEntry | null>(null);
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [isRagTestOpen, setIsRagTestOpen] = useState(false);
  const [entries, setEntries] = useState<LorebookEntry[]>([]);

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Load entries when component mounts or lorebookId changes
  useEffect(() => {
    if (currentProfile && lorebookId) {
      selectLorebook(lorebookId);
      loadLorebookEntries(currentProfile.id, lorebookId);
    }
  }, [currentProfile, lorebookId, loadLorebookEntries, selectLorebook]);

  // Load indexing status when RAG is enabled
  useEffect(() => {
    if (ragEnabled && lorebookId) {
      loadIndexingStatus(lorebookId);
    }
  }, [ragEnabled, lorebookId, loadIndexingStatus]);

  const handleIndexAll = async () => {
    try {
      await indexAllEntries(lorebookId, (indexed, total) => {
        toast.loading(`Indexing entries: ${indexed}/${total}`, { id: "indexing-progress" });
      });
      toast.dismiss("indexing-progress");
    } catch (error) {
      toast.error(`Indexing failed: ${error instanceof Error ? error.message : "Unknown error"}`, { id: "indexing-progress" });
    }
  };

  const handleClearIndex = async () => {
    try {
      await clearIndex(lorebookId);
    } catch (error) {
      toast.error(`Failed to clear index: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Get all unique group keys
  const groupKeys = useMemo(() => {
    const keys = Array.from(new Set(allEntries.map((entry) => entry.group_key).filter(Boolean))) as string[];
    return keys.sort();
  }, [allEntries]);

  // Filter and sort entries, updating local state
  useEffect(() => {
    const filtered = allEntries
      .filter((entry) => {
        const lowerCaseQuery = searchQuery.toLowerCase();
        if (
          searchQuery &&
          !entry.comment.toLowerCase().includes(lowerCaseQuery) &&
          !entry.content.toLowerCase().includes(lowerCaseQuery) &&
          !entry.keywords.some((k) => k.toLowerCase().includes(lowerCaseQuery))
        ) {
          return false;
        }
        if (filterGroupKey !== null && entry.group_key !== filterGroupKey) {
          return false;
        }
        if (showEnabledOnly && !entry.enabled) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const valueA = a[sortField];
        const valueB = b[sortField];
        if (typeof valueA === "string" && typeof valueB === "string") {
          return sortOrder === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        }
        if (valueA == null && valueB == null) {
          return 0;
        }
        if (valueA == null) {
          return sortOrder === "asc" ? 1 : -1;
        }
        if (valueB == null) {
          return sortOrder === "asc" ? -1 : 1;
        }
        const comparison = valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        return sortOrder === "asc" ? comparison : -comparison;
      });
    setEntries(filtered);
  }, [allEntries, searchQuery, filterGroupKey, showEnabledOnly, sortField, sortOrder]);

  // Handle drag and drop reordering using dnd-kit logic
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && currentProfile) {
      const oldIndex = entries.findIndex((entry) => entry.id === active.id);
      const newIndex = entries.findIndex((entry) => entry.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        console.error("Could not find dragged items in local state");
        return;
      }

      // Reorder local state immediately for responsive UI
      const reorderedEntries = arrayMove(entries, oldIndex, newIndex);
      setEntries(reorderedEntries);

      // Calculate and apply new priority values
      const startPriority = 1000;
      const increment = 10;
      const updates: { id: string; changes: Partial<LorebookEntry> }[] = [];

      reorderedEntries.forEach((entry, index) => {
        const newPriority = startPriority - index * increment;
        // Find original entry to compare priority (important if other sorts are active)
        const originalEntry = allEntries.find((e) => e.id === entry.id);
        if (originalEntry && originalEntry.priority !== newPriority) {
          updates.push({ id: entry.id, changes: { priority: newPriority } });
        }
      });

      // Apply updates asynchronously
      if (updates.length > 0) {
        try {
          for (const update of updates) {
            await updateLorebookEntry(update.id, update.changes);
          }
        } catch (error) {
          console.error("Failed to update entry priorities after drag:", error);
          setEntries(entries);
          toast.error(`Failed to reorder entries: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
    }
  };

  // Handle toggle enabled state
  const handleToggleEnabled = async (entry: LorebookEntry) => {
    try {
      await updateLorebookEntry(entry.id, { enabled: !entry.enabled });
    } catch (error) {
      console.error("Failed to toggle entry enabled state:", error);
      toast.error(`Failed to toggle entry: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Toggle sort order
  const handleSort = (field: keyof LorebookEntry) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setFilterGroupKey(null);
    setShowEnabledOnly(false);
  };

  // Open dialog for creating a new entry
  const handleCreateNewEntry = () => {
    setEntryToEdit(null);
    selectLorebookEntry(null);
    setIsEntryDialogOpen(true);
  };

  // Open dialog for editing an existing entry and select it
  const handleEditEntry = (entry: LorebookEntry) => {
    selectLorebookEntry(entry.id);
    setEntryToEdit(entry);
    setIsEntryDialogOpen(true);
  };

  return (
    <div className="m-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/75 shadow-sm">
      {!compact && (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">Entries</h2>
              <p className="text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </p>
            </div>
          </div>
          <Button
            variant="default"
            type="button"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              handleCreateNewEntry();
            }}
          >
            <LuPlus size={16} className="mr-1" /> New Entry
          </Button>
        </div>
      )}

      {ragEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LuDatabase className="w-4 h-4 text-primary" />
            <span>
              Indexing: <span className="font-medium text-foreground">{indexingStatus ? `${indexingStatus.indexed}/${indexingStatus.total} indexed` : "Loading..."}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsRagTestOpen(true)} disabled={!lorebook?.embedding_model_id}>
              <LuFlaskConical size={14} className="mr-1" />
              Test Search
            </Button>
            <Button variant="outline" size="sm" onClick={handleIndexAll} disabled={isIndexing || !lorebook?.embedding_model_id}>
              <LuDatabase size={14} className="mr-1" />
              Index All
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearIndex} disabled={isIndexing}>
              <LuTrash size={14} className="mr-1" />
              Clear Index
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 rounded-md border border-border/60 bg-muted/20 pl-9 font-sans text-sm"
          />
        </div>

        {compact && (
          <Button
            variant="default"
            size="sm"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleCreateNewEntry();
            }}
          >
            <LuPlus size={16} className="mr-1" /> New
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-background">
              <LuFilter size={16} className="mr-1" /> Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="p-2">
              <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                <Checkbox id="showEnabledOnly" checked={showEnabledOnly} onCheckedChange={() => setShowEnabledOnly(!showEnabledOnly)} />
                <span className={cn("text-sm", compact && "text-xs")}>Enabled only</span>
              </label>

              <div className="mb-2">
                <p className={cn("text-sm font-medium mb-1", compact && "text-xs")}>Group</p>
                <select
                  value={filterGroupKey || ""}
                  onChange={(e) => setFilterGroupKey(e.target.value || null)}
                  className={cn("w-full rounded border border-input bg-background p-1 text-sm", compact && "text-xs")}
                >
                  <option value="">All Groups</option>
                  <option value="null">No Group</option>
                  {groupKeys.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>

              <Button variant="outline" size="sm" className={cn("w-full mt-2", compact && "text-xs h-8")} onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-2">
            {entryLoadingSkeletonKeys.map((skeletonKey) => (
              <div key={skeletonKey} className="flex items-center gap-2">
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : entries.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background/70 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-10" />
                    <TableHead className="w-10">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSort("enabled")}>
                        <LuFilter size={14} />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[25%] max-w-[200px]">
                      <Button variant="ghost" size="sm" className={cn("-ml-3 font-medium", compact && "text-xs h-8")} onClick={() => handleSort("comment")}>
                        Title
                        {sortField === "comment" && (sortOrder === "asc" ? <FaSortAmountUp size={14} className="ml-1 inline" /> : <FaSortAmountDown size={14} className="ml-1 inline" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="max-w-[100px] text-center">
                      <Button variant="ghost" size="sm" className={cn("mx-auto font-medium", compact && "text-xs h-8")} onClick={() => handleSort("group_key")}>
                        Group
                        {sortField === "group_key" && (sortOrder === "asc" ? <FaSortAmountUp size={14} className="ml-1 inline" /> : <FaSortAmountDown size={14} className="ml-1 inline" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="max-w-[50px] text-center">
                      <Button variant="ghost" size="sm" className={cn("mx-auto font-medium", compact && "text-xs h-8")} onClick={() => handleSort("insertion_type")}>
                        Insert Type
                        {sortField === "insertion_type" && (sortOrder === "asc" ? <FaSortAmountUp size={14} className="ml-1 inline" /> : <FaSortAmountDown size={14} className="ml-1 inline" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="w-[10%] max-w-[100px] text-center">
                      <Button variant="ghost" size="sm" className={cn("mx-auto font-medium", compact && "h-8")} onClick={() => handleSort("constant")}>
                        <span className="text-xs">Constant</span>
                      </Button>
                    </TableHead>
                    {!ragEnabled && <TableHead className={cn("w-[15%] max-w-[250px] text-center", compact && "text-xs")}>Keywords</TableHead>}
                    <TableHead className="w-[10%] text-center">
                      <Button variant="ghost" size="sm" className={cn("mx-auto font-medium", compact && "text-xs h-8")} onClick={() => handleSort("priority")}>
                        Priority
                        {sortField === "priority" && (sortOrder === "asc" ? <FaSortAmountUp size={14} className="ml-1 inline" /> : <FaSortAmountDown size={14} className="ml-1 inline" />)}
                      </Button>
                    </TableHead>
                    {ragEnabled && <TableHead className="w-10 text-center text-xs">Indexed</TableHead>}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {entries.map((entry) => (
                      <SortableEntryRow
                        key={entry.id}
                        entry={entry}
                        onToggleEnabled={handleToggleEnabled}
                        onEdit={handleEditEntry}
                        onDelete={setEntryToDelete}
                        compact={compact}
                        ragEnabled={ragEnabled}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </Table>
            </div>
          </DndContext>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <div className="mb-3 rounded-2xl bg-muted/60 p-4">
              <LuSearch className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className={cn("text-lg font-medium", compact && "text-xs")}>No entries found</h3>
            <p className={cn("text-sm text-muted-foreground mt-1 mb-4 max-w-md", compact && "text-xs")}>
              {searchQuery || filterGroupKey || showEnabledOnly ? "Try adjusting your search filters" : "Get started by creating your first entry"}
            </p>
            <Button
              variant="default"
              size="sm"
              className={cn(compact && "text-xs h-8")}
              onClick={(e) => {
                e.preventDefault();
                handleCreateNewEntry();
              }}
            >
              <LuPlus size={16} className="mr-1" /> New Entry
            </Button>
          </div>
        )}
      </div>

      <LorebookEntryDialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen} lorebookId={lorebookId} entry={entryToEdit} groupKeys={groupKeys} />

      {lorebook && <RagTestDialog open={isRagTestOpen} onOpenChange={setIsRagTestOpen} lorebook={lorebook} entries={allEntries} />}

      {entryToDelete && currentProfile && (
        <DestructiveConfirmDialog
          title="Delete Entry"
          open={!!entryToDelete}
          onOpenChange={(open) => !open && setEntryToDelete(null)}
          description={`Are you sure you want to delete "${entryToDelete.comment}"? This action cannot be undone.`}
          onConfirm={async () => {
            try {
              await deleteLorebookEntry(currentProfile.id, entryToDelete.id, lorebookId);
              setEntryToDelete(null);
            } catch (error) {
              console.error("Failed to delete entry:", error);
              toast.error(`Failed to delete entry: ${error instanceof Error ? error.message : "Unknown error"}`);
              setEntryToDelete(null);
            }
          }}
        />
      )}
    </div>
  );
}
