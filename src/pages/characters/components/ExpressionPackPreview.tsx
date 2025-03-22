import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Edit, Plus, RefreshCw, Trash2 } from "lucide-react";

interface Expression {
  id: string;
  name: string;
  url: string;
}

interface ExpressionPackPreviewProps {
  expressions: Expression[];
  onRefresh: () => void;
  onEdit: (expression: Expression) => void;
  onDelete: (expression: Expression) => void;
  onAdd: () => void;
}

export function ExpressionPackPreview({
  expressions,
  onRefresh,
  onEdit,
  onDelete,
  onAdd,
}: ExpressionPackPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Expression Pack Preview</h3>
        <Button variant="outline" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {expressions.map((expression) => (
          <Card key={expression.id} className="group relative aspect-square overflow-hidden">
            <img
              src={expression.url}
              alt={expression.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="secondary" size="icon" onClick={() => onEdit(expression)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="destructive" size="icon" onClick={() => onDelete(expression)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
        <Card
          className="flex aspect-square cursor-pointer items-center justify-center border-2 border-dashed"
          onClick={onAdd}
        >
          <Plus className="h-8 w-8 text-muted-foreground" />
        </Card>
      </div>
    </div>
  );
}
