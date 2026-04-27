import { BrainCircuit, CalendarClock, Download, Edit, Globe, Heart, ScrollText, Settings2, Trash2, User } from "lucide-react";
import type { ElementType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Lorebook } from "@/schema/lorebook-schema";

const categoryIcons: Record<NonNullable<Lorebook["category"]>, ElementType> = {
  ruleset: ScrollText,
  character: User,
  world: Globe,
};

const categoryLabels: Record<string, string> = {
  ruleset: "Ruleset",
  character: "Character",
  world: "World",
};

const formatCategoryLabel = (category: string): string => categoryLabels[category] ?? category.charAt(0).toUpperCase() + category.slice(1);

interface LorebookCardProps {
  lorebook: Lorebook;
  onSelect: (id: string) => void;
  onToggleFavorite: (lorebook: Lorebook) => void;
  onExport: (lorebook: Lorebook) => void;
  onEdit: (lorebook: Lorebook) => void;
  onDelete: (lorebook: Lorebook) => void;
}

export function LorebookCard({ lorebook, onSelect, onToggleFavorite, onExport, onEdit, onDelete }: LorebookCardProps) {
  const tags = lorebook.tags ?? [];
  const visibleTags = tags.slice(0, 4);
  const hiddenTagsCount = Math.max(tags.length - visibleTags.length, 0);
  const updatedDate = new Date(lorebook.updated_at).toLocaleDateString();
  const CategoryIcon = lorebook.category ? categoryIcons[lorebook.category] : Settings2;
  const categoryLabel = lorebook.category ? formatCategoryLabel(lorebook.category) : "Uncategorized";

  return (
    <Card
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/75 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      onClick={() => onSelect(lorebook.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(lorebook.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardContent className="flex min-h-48 flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CategoryIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold leading-tight text-foreground" title={lorebook.name}>
              {lorebook.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="rounded-full px-2 py-0 text-[0.625rem] text-muted-foreground">
                {categoryLabel}
              </Badge>
              {lorebook.rag_enabled && (
                <Badge variant="outline" className="gap-1 rounded-full border-primary/30 bg-primary/10 px-2 py-0 text-[0.625rem] text-primary">
                  <BrainCircuit className="h-3 w-3" />
                  RAG
                </Badge>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onExport(lorebook);
              }}
              title="Export Lorebook"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(lorebook);
              }}
              title="Edit Lorebook"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(lorebook);
              }}
              title="Delete Lorebook"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {lorebook.description && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{lorebook.description}</p>}

        <div className="flex min-h-[1.5rem] flex-wrap gap-1 overflow-hidden">
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="max-w-28 shrink-0 truncate rounded-full bg-muted/70 px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {tag}
            </Badge>
          ))}
          {hiddenTagsCount > 0 && (
            <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] text-muted-foreground">
              +{hiddenTagsCount}
            </Badge>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center">
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
            Updated {updatedDate}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span>Depth {lorebook.max_depth ?? "-"}</span>
            <span>{lorebook.max_tokens ?? "-"} tokens</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(lorebook);
            }}
            title={lorebook.favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("h-4 w-4", lorebook.favorite ? "fill-primary text-primary" : "")} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
