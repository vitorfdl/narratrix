import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Edit, Trash2 } from "lucide-react";
import { CharacterOrAgent } from "../../../schema/characters";

interface CharacterCardProps {
  model: CharacterOrAgent;
  onEdit: (model: CharacterOrAgent) => void;
  onDelete: (model: CharacterOrAgent) => void;
}

export function CharacterCard({ model, onEdit, onDelete }: CharacterCardProps) {
  return (
    <Card className="group relative overflow-hidden">
      <CardHeader className="relative h-48 p-0">
        <img src={model.avatar} alt={model.name} className="h-full w-full object-cover" />
        <Badge
          className="absolute left-2 top-2"
          variant={model.type === "character" ? "default" : "secondary"}
        >
          {model.type}
        </Badge>
      </CardHeader>

      <CardContent className="p-4">
        <h3 className="text-lg font-semibold">{model.name}</h3>
        <p className="text-sm text-muted-foreground">by {model.author}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {model.tags.map((tag) => (
            <Badge key={tag} variant="outline">
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

      <CardFooter className="p-4 pt-0 text-sm text-muted-foreground">
        Last updated: {model.updatedAt.toLocaleDateString()}
      </CardFooter>
    </Card>
  );
}
