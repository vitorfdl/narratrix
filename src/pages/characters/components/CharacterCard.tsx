import { Download, LoaderIcon, Palette, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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

export function CharacterCard({ model, avatarUrl, isLoadingAvatar, onEdit, onDelete, onExport }: CharacterCardProps) {
  // Default avatar fallback
  const defaultAvatar = "/avatars/default.jpg";

  // Get the author from settings or custom fields
  const author = (model.settings?.author as string) || "Unknown";

  // Get tags with null check
  const tags = model.tags || [];

  // Check if character has expressions
  const hasExpressions = model.type === "character" && model.expressions && model.expressions.some((x) => x.image_path);

  // Get personality from custom fields for characters
  const personality = model.type === "character" && model.custom?.personality ? model.custom.personality : null;

  return (
    <Card
      className="group relative overflow-hidden flex flex-col bg-gradient-to-br from-background to-accent/10 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 @container cursor-pointer"
      onClick={() => onEdit(model)}
    >
      {/* Responsive layout using container queries */}
      <div className="@[400px]:flex @[400px]:h-full h-full">
        {/* Avatar section - responsive sizing */}
        <CardHeader className="relative @[400px]:w-48 @[400px]:h-full @[400px]:flex-shrink-0 h-48 p-0 flex-shrink-0">
          {isLoadingAvatar ? (
            <div className="h-full w-full flex items-center justify-center bg-muted/50">
              <LoaderIcon className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : (
            <img
              src={avatarUrl || defaultAvatar}
              alt={model.name}
              className={`w-full object-cover ${isLoadingAvatar ? "opacity-70" : "opacity-100"} transition-opacity duration-200 h-full @[400px]:h-52`}
            />
          )}
        </CardHeader>

        {/* Content section - responsive layout */}
        <div className="@[400px]:flex-1 @[400px]:flex @[400px]:flex-col flex-1 flex flex-col min-h-0">
          <CardContent className="@[400px]:py-4 @[400px]:px-4 py-3 px-4 flex-grow overflow-hidden">
            {/* Header with character info */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base line-clamp-1">{model.name}</h3>
                  <p className="text-xs text-muted-foreground">by {author}</p>
                </div>
                {/* Badges overlay */}
                <div className=" gap-1">
                  {hasExpressions && (
                    <Badge variant="outline" className="bg-primary/90 text-primary-foreground border-primary/50 flex items-center gap-1 backdrop-blur-sm">
                      <Palette className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Personality - only show in wide layout if available */}
            {personality && (
              <div className="@[400px]:block hidden mb-3">
                <p className="text-xs text-muted-foreground line-clamp-2">{personality}</p>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1 overflow-hidden">
              {tags.slice(0, 6).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="!text-xxs py-0.5 px-1.5 flex-shrink-0">
                  {tag}
                </Badge>
              ))}
              {tags.length > 6 && (
                <Badge variant="outline" className="!text-xxs py-0.5 px-1.5 flex-shrink-0">
                  +{tags.length - 6}
                </Badge>
              )}
            </div>

            {/* Action buttons - responsive positioning */}
            <div className="absolute @[400px]:right-2 @[400px]:top-2 right-2 top-2 flex @[400px]:flex-auto gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {onExport && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 backdrop-blur-sm"
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
                className="h-8 w-8 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(model);
                }}
                title="Delete Character"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>

          <CardFooter className="@[400px]:p-4 @[400px]:pt-0 p-3 pt-0 text-xs text-muted-foreground mt-auto flex-shrink-0">
            <div className="flex items-center justify-between w-full">
              <span>Updated {new Date(model.updated_at).toLocaleDateString()}</span>
            </div>
          </CardFooter>
        </div>
      </div>
    </Card>
  );
}
