import { CalendarClock, Download, LoaderIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Character } from "@/schema/characters-schema";

interface CharacterCardProps {
  model: Character;
  avatarUrl: string | undefined;
  isLoadingAvatar: boolean;
  cardSize: "small" | "medium" | "large";
  onEdit: (model: Character) => void;
  onDelete: (model: Character) => void;
  onExport?: (characterId: string) => void;
}

const cardSizeClasses: Record<CharacterCardProps["cardSize"], { image: string; title: string; body: string; tagLimit: number }> = {
  small: {
    image: "aspect-[5/3]",
    title: "text-sm",
    body: "p-3",
    tagLimit: 3,
  },
  medium: {
    image: "aspect-[4/3]",
    title: "text-base",
    body: "p-4",
    tagLimit: 5,
  },
  large: {
    image: "aspect-square",
    title: "text-lg",
    body: "p-5",
    tagLimit: 6,
  },
};

export function CharacterCard({ model, avatarUrl, isLoadingAvatar, cardSize, onEdit, onDelete, onExport }: CharacterCardProps) {
  const defaultAvatar = "/avatars/default.jpg";
  const author = (model.settings?.author as string) || "Unknown";
  const tags = model.tags || [];
  const personality = model.type === "character" && model.custom?.personality ? model.custom.personality : null;
  const sizeClass = cardSizeClasses[cardSize];
  const visibleTags = tags.slice(0, sizeClass.tagLimit);
  const hiddenTagsCount = Math.max(tags.length - visibleTags.length, 0);
  const updatedDate = new Date(model.updated_at).toLocaleDateString();

  return (
    <Card
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/75 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      onClick={() => onEdit(model)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(model);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={cn("relative w-full overflow-hidden bg-muted/40", sizeClass.image)}>
        {isLoadingAvatar ? (
          <div className="flex h-full w-full items-center justify-center bg-muted/50">
            <LoaderIcon className="h-9 w-9 animate-spin text-primary" />
          </div>
        ) : (
          <img src={avatarUrl || defaultAvatar} alt={model.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        )}
        <div className="absolute right-3 top-3 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onExport && (
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full border border-white/10 bg-background/80 backdrop-blur hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                onExport(model.id);
              }}
              title="Export Character"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8 rounded-full border border-white/10 backdrop-blur"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(model);
            }}
            title="Delete Character"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <CardContent className={cn("flex min-h-0 flex-1 flex-col gap-3", sizeClass.body)}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={cn("truncate font-semibold leading-tight text-foreground", sizeClass.title)} title={model.name}>
              {model.name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">by {author}</p>
          </div>
        </div>

        {personality && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{personality}</p>}

        <div className="flex min-h-[1.5rem] flex-wrap gap-1 overflow-hidden">
          {visibleTags.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="max-w-28 shrink-0 truncate rounded-full bg-muted/70 px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {tag}
            </Badge>
          ))}
          {hiddenTagsCount > 0 && (
            <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] text-muted-foreground">
              +{hiddenTagsCount}
            </Badge>
          )}
          {tags.length === 0 && <span className="text-xs text-muted-foreground/70">No tags</span>}
        </div>

        <div className="mt-auto flex items-center border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
          Updated {updatedDate}
        </div>
      </CardContent>
    </Card>
  );
}
