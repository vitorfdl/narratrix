import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CharacterUnion } from "@/schema/characters-schema";
import { Download, Edit, LoaderIcon, Palette, Trash2 } from "lucide-react";

interface CharacterCardProps {
  model: CharacterUnion;
  avatarUrl: string | undefined;
  isLoadingAvatar: boolean;
  cardSize: "small" | "medium" | "large";
  onEdit: (model: CharacterUnion) => void;
  onDelete: (model: CharacterUnion) => void;
  onExport?: (characterId: string) => void;
}

export function CharacterCard({ model, avatarUrl, isLoadingAvatar, onEdit, onDelete, onExport }: CharacterCardProps) {
  // Default avatar fallback
  const defaultAvatar = "/avatars/default.jpg";

  // Get the author from settings or custom fields
  const author = (model.settings?.author as string) || "Unknown";

  // Get tags with null check
  const tags = model.tags || [];

  // Check if character has expressions
  const hasExpressions = model.type === "character" && model.expressions && model.expressions.some((x) => x.image_path);

  return (
    <Card className="group relative overflow-hidden flex flex-col h-full">
      <CardHeader className="relative h-48 p-0">
        {isLoadingAvatar ? (
          <div className="h-full w-full flex items-center justify-center">
            <LoaderIcon className="w-10 h-10 animate-spin" />
          </div>
        ) : (
          <img
            src={avatarUrl || defaultAvatar}
            alt={model.name}
            className={`h-full w-full object-cover ${isLoadingAvatar ? "opacity-70" : "opacity-100"} transition-opacity duration-200`}
          />
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {/* <Badge variant={model.type === "character" ? "default" : "highlight"}>{model.type}</Badge> */}
          {hasExpressions && (
            <Badge variant="outline" className="bg-accent text-accent-foreground flex items-center gap-1">
              <Palette className="h-3 w-3" />
              <span>Expression Pack!</span>
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="py-1 px-4 flex-grow">
        <h3 className="text-sm font-semibold">{model.name}</h3>
        <p className="text-xs text-muted-foreground">by {author}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 6).map((tag: string) => (
            <Badge key={tag} variant="default" className="!text-xxs py-0.5 px-1">
              {tag}
            </Badge>
          ))}
          {tags.length > 5 && <span className="text-xs text-muted-foreground font-semibold px-2">...</span>}
        </div>
      </CardContent>

      <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        {onExport && (
          <Button variant="secondary" size="icon" onClick={() => onExport(model.id)} title="Export Character">
            <Download className="h-4 w-4" />
          </Button>
        )}
        <Button variant="secondary" size="icon" onClick={() => onEdit(model)} title="Edit Character">
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="icon" onClick={() => onDelete(model)} title="Delete Character">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <CardFooter className="p-4 pb-2 pt-0 text-xs italic text-muted-foreground mt-auto">
        Last updated: {new Date(model.updated_at).toLocaleDateString()}
      </CardFooter>
    </Card>
  );
}
