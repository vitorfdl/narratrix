import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useIsLoadingEntries, useLorebookStoreActions, useSelectedLorebookEntries } from "@/hooks/lorebookStore";
import { cn } from "@/lib/utils";
import { LorebookEntry } from "@/schema/lorebook-schema";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookDown, BookOpenIcon, BookUp, Bot, Filter, GripVertical, Plus, Search, SortAsc, SortDesc, Trash2, User } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { LorebookEntryDialog } from "./LorebookEntryDialog";

interface LorebookEntriesProps {
  lorebookId: string;
  profileId: string;
  compact?: boolean;
}

// New component for sortable table rows
interface SortableEntryRowProps {
  entry: LorebookEntry;
  onToggleEnabled: (entry: LorebookEntry) => void;
  onEdit: (entry: LorebookEntry) => void;
  onDelete: (entry: LorebookEntry) => void;
  compact?: boolean;
}

function SortableEntryRow({ entry, onToggleEnabled, onEdit, onDelete, compact = false }: SortableEntryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  // Map insertion types to readable names and icons
  const insertionTypeDisplay: { [key: string]: { name: string; icon: React.ElementType } } = {
    lorebook_top: { name: "Top", icon: BookUp },
    lorebook_bottom: { name: "Bottom", icon: BookDown },
    user: { name: "User", icon: User },
    assistant: { name: "Assistant", icon: Bot },
  };

  const displayInfo = insertionTypeDisplay[entry.insertion_type] || { name: entry.insertion_type, icon: null };
  const IconComponent = displayInfo.icon;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn("transition-colors cursor-pointer hover:bg-muted", isDragging && "bg-accent opacity-80")}
      {...attributes}
      onClick={() => onEdit(entry)}
    >
      <TableCell className="p-0 pl-2 w-10">
        <div {...listeners} className="cursor-grab py-2 px-1 inline-block">
          <GripVertical size={16} className="text-muted-foreground" />
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
        <div
          className={cn("inline-block h-2.5 w-2.5 rounded-full", entry.constant ? "bg-primary" : "bg-muted")}
          title={entry.constant ? "Constant" : "Not Constant"}
        />
      </TableCell>
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
      <TableCell className="w-[10%] text-xs text-center">{entry.priority}</TableCell>
      <TableCell className="w-10">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-8 w-8 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
        >
          <Trash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function LorebookEntries({ lorebookId, compact = false }: LorebookEntriesProps) {
  const currentProfile = useCurrentProfile();
  const allEntries = useSelectedLorebookEntries();
  const isLoading = useIsLoadingEntries();
  const { loadLorebookEntries, updateLorebookEntry, deleteLorebookEntry, selectLorebookEntry, selectLorebook } = useLorebookStoreActions();

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGroupKey, setFilterGroupKey] = useState<string | null>(null);
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortField, setSortField] = useState<keyof LorebookEntry>("priority");
  const [entryToDelete, setEntryToDelete] = useState<LorebookEntry | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<LorebookEntry | null>(null);
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
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
  }, [currentProfile, lorebookId, loadLorebookEntries]);

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
    <div className="flex flex-col overflow-hidden bg-card/50 rounded-t-lg rounded-b-sm mt-4">
      {!compact && (
        <div className="p-4 flex items-center justify-between gap-2 border-b">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 mr-2 text-primary" />
            <h2 className="text-lg font-semibold">Entries</h2>
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
            <Plus size={16} className="mr-1" /> New Entry
          </Button>
        </div>
      )}

      <div className="p-4 flex items-center gap-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search entries..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" />
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
            <Plus size={16} className="mr-1" /> New
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter size={16} className="mr-1" /> Filter
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

      <div className="flex-1 overflow-hidden p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
          </div>
        ) : entries.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-background/95 hover:bg-background/95">
                    <TableHead className="w-10" />
                    <TableHead className="w-10">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSort("enabled")}>
                        <Filter size={14} />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[25%] max-w-[200px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("-ml-3 font-medium", compact && "text-xs h-8")}
                        onClick={() => handleSort("comment")}
                      >
                        Title
                        {sortField === "comment" &&
                          (sortOrder === "asc" ? <SortAsc size={14} className="ml-1 inline" /> : <SortDesc size={14} className="ml-1 inline" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="max-w-[100px] text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("mx-auto font-medium", compact && "text-xs h-8")}
                        onClick={() => handleSort("group_key")}
                      >
                        Group
                        {sortField === "group_key" &&
                          (sortOrder === "asc" ? <SortAsc size={14} className="ml-1 inline" /> : <SortDesc size={14} className="ml-1 inline" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="max-w-[50px] text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("mx-auto font-medium", compact && "text-xs h-8")}
                        onClick={() => handleSort("insertion_type")}
                      >
                        Insert Type
                        {sortField === "insertion_type" &&
                          (sortOrder === "asc" ? <SortAsc size={14} className="ml-1 inline" /> : <SortDesc size={14} className="ml-1 inline" />)}
                      </Button>
                    </TableHead>
                    <TableHead className="w-[10%] max-w-[100px] text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("mx-auto font-medium", compact && "h-8")}
                        onClick={() => handleSort("constant")}
                      >
                        <span className="text-xs">Constant</span>
                      </Button>
                    </TableHead>
                    <TableHead className={cn("w-[15%] max-w-[250px] text-center", compact && "text-xs")}>Keywords</TableHead>
                    <TableHead className="w-[10%] text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("mx-auto font-medium", compact && "text-xs h-8")}
                        onClick={() => handleSort("priority")}
                      >
                        Priority
                        {sortField === "priority" &&
                          (sortOrder === "asc" ? <SortAsc size={14} className="ml-1 inline" /> : <SortDesc size={14} className="ml-1 inline" />)}
                      </Button>
                    </TableHead>
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
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </Table>
            </div>
          </DndContext>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Search className="h-6 w-6 text-muted-foreground" />
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
              <Plus size={16} className="mr-1" /> New Entry
            </Button>
          </div>
        )}
      </div>

      <LorebookEntryDialog
        open={isEntryDialogOpen}
        onOpenChange={setIsEntryDialogOpen}
        lorebookId={lorebookId}
        entry={entryToEdit}
        groupKeys={groupKeys}
      />

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
              setEntryToDelete(null);
            }
          }}
        />
      )}
    </div>
  );
}
