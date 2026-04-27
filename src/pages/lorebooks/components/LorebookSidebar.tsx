import { BookOpen, Hash, Layers3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Lorebook } from "@/schema/lorebook-schema";

const categoryLabels: Record<string, string> = {
  ruleset: "Ruleset",
  character: "Character",
  world: "World",
};

const formatCategoryLabel = (category: string): string => categoryLabels[category] ?? category.charAt(0).toUpperCase() + category.slice(1);

interface LorebookSidebarProps {
  lorebooks: Lorebook[];
  shownCount: number;
  selectedCategory: string | null;
  selectedTags: string[];
  showFavoritesOnly: boolean;
  onCategorySelect: (category: string | null) => void;
  onFavoritesToggle: () => void;
  onTagSelect: (tag: string) => void;
  onClearFilters: () => void;
}

export function LorebookSidebar({ lorebooks, shownCount, selectedCategory, selectedTags, showFavoritesOnly, onCategorySelect, onFavoritesToggle, onTagSelect, onClearFilters }: LorebookSidebarProps) {
  const categories = Array.from(new Set(lorebooks.map((lorebook) => lorebook.category).filter((category): category is NonNullable<Lorebook["category"]> => Boolean(category)))).sort((a, b) =>
    formatCategoryLabel(a).localeCompare(formatCategoryLabel(b)),
  );
  const tags = Array.from(new Set(lorebooks.flatMap((lorebook) => lorebook.tags ?? []).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const hasActiveFilters = selectedCategory !== null || selectedTags.length > 0 || showFavoritesOnly;
  const favoriteCount = lorebooks.filter((lorebook) => lorebook.favorite).length;

  const categoryCounts = categories.reduce(
    (acc, category) => {
      acc[category] = lorebooks.filter((lorebook) => lorebook.category === category).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const tagCounts = tags.reduce(
    (acc, tag) => {
      acc[tag] = lorebooks.filter((lorebook) => lorebook.tags?.includes(tag)).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <aside className="w-56 shrink-0 border-r border-border/70 bg-card/35 backdrop-blur-sm max-lg:w-48">
      <ScrollArea className="h-full">
        <div className="space-y-4 px-3 py-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-4 w-4" />
              </span>
              <span>All Lorebooks</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                <div className="text-muted-foreground">Total</div>
                <div className="text-sm font-semibold">{lorebooks.length}</div>
              </div>
              <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                <div className="text-muted-foreground">Shown</div>
                <div className="text-sm font-semibold">{shownCount}</div>
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs">
              <span className="text-primary">Active filters</span>
              <Button variant="ghost" size="icon" onClick={onClearFilters} className="h-6 w-6 rounded-full hover:bg-primary/15" title="Clear filters">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers3 className="h-3.5 w-3.5" />
              Categories
            </div>
            <div className="space-y-1">
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  showFavoritesOnly ? "bg-primary/15 text-primary ring-1 ring-primary/25" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                onClick={onFavoritesToggle}
              >
                <span className="min-w-0 flex-1 truncate">Favorites</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${showFavoritesOnly ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{favoriteCount}</span>
              </button>
              {categories.map((category) => {
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isSelected ? "bg-primary/15 text-primary ring-1 ring-primary/25" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                    onClick={() => onCategorySelect(isSelected ? null : category)}
                  >
                    <span className="min-w-0 flex-1 truncate">{formatCategoryLabel(category)}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{categoryCounts[category]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              Tags
            </div>
            {tags.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-background/40 px-3 py-4 text-center text-xs text-muted-foreground">No tags available</p>
            ) : (
              <div className="space-y-1">
                {tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        isSelected ? "bg-primary/15 text-primary ring-1 ring-primary/25" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                      onClick={() => onTagSelect(tag)}
                    >
                      <span className="min-w-0 flex-1 truncate">{tag}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{tagCounts[tag]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
