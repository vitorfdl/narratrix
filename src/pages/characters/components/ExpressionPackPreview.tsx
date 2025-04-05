import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Expression } from "@/schema/characters-schema";
import { Edit, Folder, Plus, RefreshCw, Trash2 } from "lucide-react";

interface ExpressionPackPreviewProps {
  character_id: string;
  expressions: Expression[];
}

export function ExpressionPackPreview({ expressions }: ExpressionPackPreviewProps) {
  const onRefresh = () => {
    console.log("Refresh expressions");
  };

  const onOpenFolder = () => {
    console.log("Open expressions folder");
  };

  const onEdit = (expression: Expression) => {
    console.log("Edit expression", expression);
  };

  const onDelete = (expression: Expression) => {
    console.log("Delete expression", expression);
  };

  const onAdd = () => {
    console.log("Add expression");
  };

  return (
    <Card className="overflow-hidden bg-gradient-to-b from-card/50 to-card border-none shadow-xl">
      <div className="p-1 space-y-1">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-card/50 rounded-full p-1 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                className="h-8 w-8 rounded-full hover:bg-white/10 transition-colors"
                title="Refresh expressions"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenFolder}
                className="h-8 w-8 rounded-full hover:bg-white/10 transition-colors"
                title="Open expressions folder"
              >
                <Folder className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-card/50 backdrop-blur-sm">
            <span className="text-sm font-medium text-muted-foreground">{expressions.length} expressions</span>
          </div>
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-4 gap-4">
          {expressions.map((expression) => (
            <Card
              key={expression.id}
              className="group relative aspect-square overflow-hidden border-none bg-card/50 transition-all duration-150 hover:shadow-lg hover:shadow-primary/10 hover:ring-1 hover:ring-primary/20"
            >
              <img
                src={expression.image_path}
                alt={expression.name}
                className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3">
                <p className="text-sm font-medium text-white">{expression.name}</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-sm transition-all duration-150 group-hover:opacity-100">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => onEdit(expression)}
                  className="h-9 w-9 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => onDelete(expression)}
                  className="h-9 w-9 rounded-full border border-white/20 bg-white/10 hover:bg-destructive/80 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          <Card
            onClick={onAdd}
            className={cn(
              "flex aspect-square cursor-pointer items-center justify-center",
              "border-2 border-dashed border-muted transition-colors hover:border-primary/50",
              "bg-card/50 hover:bg-card group",
            )}
          >
            <Plus className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary" />
          </Card>
        </div>
      </div>
    </Card>
  );
}
