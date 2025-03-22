import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Edit, FolderSearch } from "lucide-react";
import { useState } from "react";
import { ExpressionPackPreview } from "./ExpressionPackPreview";

interface AddCharacterFormProps {
  onSuccess: () => void;
}

// Mock data for lorebooks
const mockLorebooks = [
  "Fantasy Guide",
  "Sci-fi Encyclopedia",
  "Historical Facts",
  "Mythology Compendium",
];

// Mock data for expressions
const mockExpressions = [
  { id: "1", name: "Happy", url: "/avatars/narratrix.jpeg" },
  { id: "2", name: "Sad", url: "/avatars/narratrix.jpeg" },
];

export function AddCharacterForm({ onSuccess }: AddCharacterFormProps) {
  const [type, setType] = useState<"character" | "agent">("character");
  const [selectedLorebooks, setSelectedLorebooks] = useState<string[]>([]);
  const [lorebookOpen, setLorebookOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement form submission
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-center gap-2">
        <Button
          type="button"
          variant={type === "character" ? "default" : "outline"}
          onClick={() => setType("character")}
          className="w-32"
        >
          Character
        </Button>
        <Button
          type="button"
          variant={type === "agent" ? "default" : "outline"}
          onClick={() => setType("agent")}
          className="w-32"
        >
          Agent
        </Button>
      </div>

      <div className="flex gap-6 ">
        <div className="w-48 flex-shrink-0">
          <Card className="relative aspect-square overflow-hidden">
            <img
              src="/placeholder-avatar.png"
              alt="Avatar"
              className="h-full w-full object-cover"
            />
            <Button variant="secondary" size="icon" className="absolute right-2 top-2">
              <Edit className="h-4 w-4" />
            </Button>
          </Card>
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input id="author" required />
          </div>

          {type === "character" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="expressionPack">Expression Pack Path</Label>
                <div className="flex gap-2">
                  <Input id="expressionPack" required className="flex-1" />
                  <Button variant="outline" size="icon">
                    <FolderSearch className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lorebooks</Label>
                <Popover open={lorebookOpen} onOpenChange={setLorebookOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {selectedLorebooks.length === 0
                        ? "Select Lorebooks..."
                        : `${selectedLorebooks.length} selected`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search lorebooks..." />
                      <CommandEmpty>No lorebooks found.</CommandEmpty>
                      <CommandGroup>
                        {mockLorebooks.map((book) => (
                          <CommandItem
                            key={book}
                            onSelect={() => {
                              setSelectedLorebooks((prev) =>
                                prev.includes(book)
                                  ? prev.filter((b) => b !== book)
                                  : [...prev, book],
                              );
                            }}
                          >
                            {book}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="useCustomPrompt" />
                <Label htmlFor="useCustomPrompt" className="text-blue-400">
                  Use Custom System Prompt
                </Label>
              </div>

              <ResizableTextarea
                label="Personality"
                placeholder="Describe the character's personality..."
                required
              />

              <ResizableTextarea
                label="Custom System Prompt"
                placeholder="Enter a custom system prompt..."
              />

              <ExpressionPackPreview
                expressions={mockExpressions}
                onRefresh={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onAdd={() => {}}
              />
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox id="preserveLastResponse" />
                <Label htmlFor="preserveLastResponse" className="text-yellow-400">
                  Preserve Last Response
                </Label>
              </div>

              <ResizableTextarea
                label="System Prompt"
                placeholder="Enter the system prompt..."
                required
              />
            </>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full">
        Create {type === "character" ? "Character" : "Agent"}
      </Button>
    </form>
  );
}
