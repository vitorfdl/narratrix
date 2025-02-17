import { Settings2, MoreVertical } from "lucide-react";
import { Model } from "../../../types/models";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ModelCardProps {
    model: Model;
    onEdit?: (model: Model) => void;
    onDelete?: (model: Model) => void;
}

export function ModelCard({ model, onEdit, onDelete }: ModelCardProps) {
    return (
        <Card className="w-full bg-card hover:bg-accent/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {model.name}
                </CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger className="focus:outline-none">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit?.(model)}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDelete?.(model)}
                        >
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent>
                <div className="text-xs text-muted-foreground">
                    {model.description}
                </div>
            </CardContent>
        </Card>
    );
} 