import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CharacterUnion } from "@/schema/characters-schema";
import { Edit, Trash2 } from "lucide-react";

interface CharacterCardProps {
  model: CharacterUnion;
  avatarUrl: string | undefined;
  isLoadingAvatar: boolean;
  cardSize: "small" | "medium" | "large";
  onEdit: (model: CharacterUnion) => void;
  onDelete: (model: CharacterUnion) => void;
}

export function CharacterCard({ model, avatarUrl, isLoadingAvatar, onEdit, onDelete }: CharacterCardProps) {
  // Default avatar fallback
  const defaultAvatar = "/avatars/default.jpg";

  // Get the author from settings or custom fields
  const author = (model.settings?.author as string) || "Unknown";

  // Get tags with null check
  const tags = model.tags || [];

  return (
    <Card className="group relative overflow-hidden flex flex-col h-full">
      <CardHeader className="relative h-48 p-0">
        <img
          src={avatarUrl || defaultAvatar}
          alt={model.name}
          className={`h-full w-full object-cover ${isLoadingAvatar ? "opacity-70" : "opacity-100"} transition-opacity duration-200`}
        />
        <Badge className="absolute left-2 top-2" variant={model.type === "character" ? "default" : "secondary"}>
          {model.type}
        </Badge>
      </CardHeader>

      <CardContent className="py-1 px-4 flex-grow">
        <h3 className="text-sm font-semibold">{model.name}</h3>
        <p className="text-xs text-muted-foreground">by {author}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag: string) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="secondary" size="icon" onClick={() => onEdit(model)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="icon" onClick={() => onDelete(model)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <CardFooter className="p-4 pb-2 pt-0 text-xs italic text-muted-foreground mt-auto">
        Last updated: {new Date(model.updated_at).toLocaleDateString()}
      </CardFooter>
    </Card>
  );
}
