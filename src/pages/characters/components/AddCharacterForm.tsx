import { AvatarCrop } from "@/components/shared/AvatarCrop";
import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ExpressionPackPreview } from "./ExpressionPackPreview";

interface CharacterFormProps {
  onSuccess: () => void;
  initialData?: {
    id?: string;
    name?: string;
    author?: string;
    version?: string;
    avatar?: string;
    type?: "character" | "agent";
    personality?: string;
    systemPrompt?: string;
    preserveLastResponse?: boolean;
  };
  mode?: "create" | "edit";
}

// Mock data for lorebooks
const mockLorebooks = ["Fantasy Guide", "Sci-fi Encyclopedia", "Historical Facts", "Mythology Compendium"];

// Mock data for expressions
const mockExpressions = [
  { id: "1", name: "Happy", url: "/avatars/narratrix.jpeg" },
  { id: "2", name: "Sad", url: "/avatars/narratrix.jpeg" },
];

// Character-specific form content
function CharacterFormContent({
  personality = "",
  systemPrompt = "",
  onPersonalityChange,
  onSystemPromptChange,
}: {
  personality?: string;
  systemPrompt?: string;
  onPersonalityChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
}) {
  const [selectedLorebooks, setSelectedLorebooks] = useState<string[]>([]);
  const [lorebookOpen, setLorebookOpen] = useState(false);

  return (
    <>
      {/* <div className="space-y-2">
        <Label>Lorebooks</Label>
        <Popover open={lorebookOpen} onOpenChange={setLorebookOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              {selectedLorebooks.length === 0 ? "Select Lorebooks..." : `${selectedLorebooks.length} selected`}
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
                      setSelectedLorebooks((prev) => (prev.includes(book) ? prev.filter((b) => b !== book) : [...prev, book]));
                    }}
                  >
                    {book}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div> */}

      <div className="space-y-2">
        <TipTapTextArea
          className="max-h-48 min-h-24 overflow-y-auto"
          editable={true}
          disableRichText={true}
          label="Personality"
          initialValue={personality}
          onChange={onPersonalityChange}
          suggestions={[
            {
              title: "name",
              description: "The name of the character",
            },
            {
              title: "character.name",
              description: "The name of the character",
            },
            {
              title: "user.name",
              description: "The name of the user",
            },
          ]}
          placeholder="Describe the character {{character.name}} personality... Can be captured in the Formatting Template for System Prompts."
        />
      </div>

      <Card className="rounded-lg">
        <CardContent className="p-2 space-y-4">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer mb-1">
                <h3 className="text-sm font-medium">Custom System Prompt</h3>
                <ChevronDown className="h-4 w-4 transition-transform ui-open:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="">
              <Separator className="my-2" />

              <TipTapTextArea
                className="max-h-48 overflow-y-auto min-h-24"
                editable={true}
                initialValue={systemPrompt}
                onChange={onSystemPromptChange}
                suggestions={[
                  {
                    title: "name",
                    description: "The name of the character",
                  },
                  {
                    title: "character.name",
                    description: "The name of the character",
                  },
                  {
                    title: "user.name",
                    description: "The name of the user",
                  },
                ]}
                disableRichText={true}
                placeholder="[Keep it blank to not override the default system prompt]"
              />
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardContent className="p-2 space-y-4">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer mb-1">
                <h3 className="text-sm font-medium">Expression Pack</h3>
                <ChevronDown className="h-4 w-4 transition-transform ui-open:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Separator className="my-2" />
              <ExpressionPackPreview character_id="1" expressions={mockExpressions} />
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </>
  );
}

// Agent-specific form content
function AgentFormContent({
  systemPrompt = "",
  preserveLastResponse = false,
  onSystemPromptChange,
  onPreserveLastResponseChange,
}: {
  systemPrompt?: string;
  preserveLastResponse?: boolean;
  onSystemPromptChange: (value: string) => void;
  onPreserveLastResponseChange: (checked: boolean) => void;
}) {
  return (
    <>
      <div className="flex items-center space-x-2">
        <Checkbox id="preserveLastResponse" checked={preserveLastResponse} onCheckedChange={onPreserveLastResponseChange} />
        <Label htmlFor="preserveLastResponse" className="text-yellow-400">
          Preserve Last Response
        </Label>
      </div>

      <ResizableTextarea
        label="System Prompt"
        placeholder="Enter the system prompt..."
        required
        value={systemPrompt}
        onChange={(e) => onSystemPromptChange(e.target.value)}
      />
    </>
  );
}

export function CharacterForm({ onSuccess, initialData = {}, mode = "create" }: CharacterFormProps) {
  const isEditMode = mode === "edit";
  const [type, setType] = useState<"character" | "agent">(initialData.type || "character");
  const [name, setName] = useState(initialData.name || "");
  const [author, setAuthor] = useState(initialData.author || "");
  const [version, setVersion] = useState(initialData.version || "");
  const [avatarImage, setAvatarImage] = useState<string | null>(initialData.avatar || null);
  const [personality, setPersonality] = useState(initialData.personality || "");
  const [systemPrompt, setSystemPrompt] = useState(initialData.systemPrompt || "");
  const [preserveLastResponse, setPreserveLastResponse] = useState(initialData.preserveLastResponse || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData = {
      id: initialData.id,
      type,
      name,
      author,
      version,
      avatar: avatarImage,
      personality,
      systemPrompt,
      preserveLastResponse: type === "agent" ? preserveLastResponse : undefined,
    };

    // TODO: Implement form submission for create/update
    console.log("Form submitted:", formData);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {!isEditMode && (
        <div className="flex justify-center gap-2">
          <Button type="button" variant={type === "character" ? "default" : "outline"} onClick={() => setType("character")} className="w-32">
            Character
          </Button>
          <Button type="button" variant={type === "agent" ? "default" : "outline"} onClick={() => setType("agent")} className="w-32">
            Agent
          </Button>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="author">Author</Label>
            <Input id="author" placeholder="John Doe" required value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="version">Version</Label>
            <Input id="version" placeholder="1.0" required value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
        </div>

        <div className="w-36 flex flex-col items-center justify-center">
          <Label htmlFor="avatar" className="mb-2">
            Avatar
          </Label>
          <Card className="relative w-32 h-32 ring-2 ring-border overflow-hidden rounded-full">
            <AvatarCrop
              onCropComplete={(image) => setAvatarImage(image)}
              cropShape="round"
              existingImage={avatarImage}
              className="overflow-hidden h-full w-full rounded-full"
            />
          </Card>
        </div>
      </div>

      {/* Render type-specific form content */}
      {type === "character" ? (
        <CharacterFormContent
          personality={personality}
          systemPrompt={systemPrompt}
          onPersonalityChange={setPersonality}
          onSystemPromptChange={setSystemPrompt}
        />
      ) : (
        <AgentFormContent
          systemPrompt={systemPrompt}
          preserveLastResponse={preserveLastResponse}
          onSystemPromptChange={setSystemPrompt}
          onPreserveLastResponseChange={setPreserveLastResponse}
        />
      )}

      <Button type="submit" className="w-full">
        {isEditMode ? "Update" : "Create"} {type === "character" ? "Character" : "Agent"}
      </Button>
    </form>
  );
}
