import { Plus, RefreshCw, View, SortAsc } from "lucide-react";
import { useState, useMemo } from "react";
import { CharacterOrAgent, SortOption, ViewSettings, mockCharactersAndAgents } from "../../types/characters";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { CharacterCard } from "./components/CharacterCard";
import { CharacterSidebar } from "./components/CharacterSidebar";
import { AddCharacterForm } from "./components/AddCharacterForm";

export default function Characters() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [sort, setSort] = useState<SortOption>({
        field: "name",
        direction: "asc",
    });
    const [view, setView] = useState<ViewSettings>({
        cardsPerRow: 4,
        cardSize: "medium",
    });

    const handleEdit = (model: CharacterOrAgent) => {
        // TODO: Implement edit functionality
        console.log("Edit model:", model);
    };

    const handleDelete = (model: CharacterOrAgent) => {
        // TODO: Implement delete functionality
        console.log("Delete model:", model);
    };

    const handleTagSelect = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag)
                ? prev.filter((t) => t !== tag)
                : [...prev, tag]
        );
    };

    const filteredCharacters = useMemo(() => {
        return mockCharactersAndAgents
            .filter((char) => {
                const matchesSearch = char.name
                    .toLowerCase()
                    .includes(search.toLowerCase());
                const matchesTags =
                    selectedTags.length === 0 ||
                    selectedTags.every((tag) => char.tags.includes(tag));
                return matchesSearch && matchesTags;
            })
            .sort((a, b) => {
                const direction = sort.direction === "asc" ? 1 : -1;
                if (sort.field === "name") {
                    return direction * a.name.localeCompare(b.name);
                }
                if (sort.field === "type") {
                    return direction * a.type.localeCompare(b.type);
                }
                return (
                    direction *
                    (b.updatedAt.getTime() - a.updatedAt.getTime())
                );
            });
    }, [mockCharactersAndAgents, search, selectedTags, sort]);

    return (
        <div className="flex h-full">
            <CharacterSidebar
                characters={mockCharactersAndAgents}
                selectedTags={selectedTags}
                onTagSelect={handleTagSelect}
            />

            <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-1 border-b p-4">
                    <Input
                        placeholder="Search characters..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full"
                    />
                    <Button variant="outline" size="icon">
                        <RefreshCw className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <View className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            <div className="p-4">
                                <p className="mb-2 text-sm font-medium">Card Size</p>
                                <Slider
                                    value={[view.cardsPerRow]}
                                    min={2}
                                    max={6}
                                    step={1}
                                    onValueChange={([value]) =>
                                        setView((prev) => ({
                                            ...prev,
                                            cardsPerRow: value,
                                        }))
                                    }
                                />
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <SortAsc className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() =>
                                    setSort({ field: "name", direction: "asc" })
                                }
                            >
                                Name (A-Z)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    setSort({ field: "name", direction: "desc" })
                                }
                            >
                                Name (Z-A)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    setSort({ field: "type", direction: "asc" })
                                }
                            >
                                Type (A-Z)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    setSort({ field: "updatedAt", direction: "desc" })
                                }
                            >
                                Recently Updated
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    <div
                        className="grid gap-2"
                        style={{
                            gridTemplateColumns: `repeat(${view.cardsPerRow}, minmax(0, 1fr))`,
                        }}
                    >
                        {filteredCharacters.map((char) => (
                            <CharacterCard
                                key={char.id}
                                model={char}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button
                            className="w-full rounded-none h-14 bg-zinc-800/50 text-white"
                            size="lg"
                        >
                            <Plus className="mr-2 h-5 w-5" />
                            Add Character / Agent
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Add New Character / Agent</DialogTitle>
                        </DialogHeader>
                        <AddCharacterForm onSuccess={() => setOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
