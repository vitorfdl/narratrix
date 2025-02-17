import { Plus } from "lucide-react";
import { useState } from "react";
import { ModelCard } from "./components/ModelCard";
import { Model, mockModels } from "../../types/models";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { AddModelForm } from "./components/AddModelForm";

export default function Models() {
    const [open, setOpen] = useState(false);

    const handleEdit = (model: Model) => {
        // TODO: Implement edit functionality
        console.log("Edit model:", model);
    };

    const handleDelete = (model: Model) => {
        // TODO: Implement delete functionality
        console.log("Delete model:", model);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 space-y-8 p-8 pt-6">
                {mockModels.map((group) => (
                    <div key={group.type} className="space-y-4">
                        <h2 className="text-base font-semibold tracking-tight text-white">
                            {group.title}
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {group.models.map((model) => (
                                <ModelCard
                                    key={model.id}
                                    model={model}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        className="w-full rounded-none h-14 bg-zinc-800/50 text-white"
                        size="lg"
                    >
                        <Plus className="mr-2 h-5 w-5" />
                        Add Model
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Model</DialogTitle>
                    </DialogHeader>
                    <AddModelForm onSuccess={() => setOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
