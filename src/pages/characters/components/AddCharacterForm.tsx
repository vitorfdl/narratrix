import { AvatarCrop } from "@/components/shared/AvatarCrop";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { useProfile } from "@/hooks/ProfileContext";
import { useCharacterActions } from "@/hooks/characterStore";
import { CharacterUnion } from "@/schema/characters-schema";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExpressionPackPreview } from "./ExpressionPackPreview";

interface CharacterFormProps {
  onSuccess: () => void;
  initialData?: CharacterUnion;
  mode?: "create" | "edit";
}

// Character-specific form content
function CharacterFormContent({
  personality = "",
  systemPrompt = "",
  expressions = [],
  characterId,
  onPersonalityChange,
  onSystemPromptChange,
}: {
  personality?: string;
  systemPrompt?: string;
  expressions?: Array<{ id: string; name: string; image_path: string }>;
  characterId?: string;
  onPersonalityChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <TipTapTextArea
          className="max-h-48 min-h-24 overflow-y-auto"
          editable={true}
          disableRichText={true}
          label="Personality"
          initialValue={personality}
          onChange={onPersonalityChange}
          suggestions={promptReplacementSuggestionList.slice(0, 4)}
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
                suggestions={promptReplacementSuggestionList}
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
              {characterId && <ExpressionPackPreview character_id={characterId} expressions={expressions} />}
              {!characterId && <div className="text-sm text-muted-foreground">Save the character first to add expressions.</div>}
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
      <div className="flex items-center space-x-2 mb-2">
        <Checkbox id="preserveLastResponse" checked={preserveLastResponse} onCheckedChange={onPreserveLastResponseChange} />
        <Label htmlFor="preserveLastResponse" className="text-yellow-400">
          Preserve Last Response
        </Label>
      </div>

      <div className="space-y-2">
        <TipTapTextArea
          label="System Prompt"
          placeholder="Enter the system prompt..."
          initialValue={systemPrompt}
          editable={true}
          disableRichText={true}
          className="max-h-48 min-h-24 overflow-y-auto"
          onChange={(e) => onSystemPromptChange(e)}
          suggestions={promptReplacementSuggestionList}
        />
      </div>
    </>
  );
}

export function CharacterForm({ onSuccess, initialData, mode = "create" }: CharacterFormProps) {
  const isEditMode = mode === "edit";
  const { createCharacter, updateCharacter } = useCharacterActions();
  const { currentProfile } = useProfile();
  const profileId = currentProfile!.id;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [type, setType] = useState<"character" | "agent">(initialData?.type || "character");
  const [name, setName] = useState(initialData?.name || "");
  const [version, setVersion] = useState(initialData?.version || "1.0.0");
  const [avatarImage, setAvatarImage] = useState<string | null>(initialData?.avatar_path || null);
  const [tags, _setTags] = useState<string[]>(initialData?.tags || []);
  const [personality, setPersonality] = useState(initialData?.type === "character" ? (initialData?.custom?.personality as string) || "" : "");
  const [systemPrompt, setSystemPrompt] = useState(initialData?.system_override || "");
  const [preserveLastResponse, setPreserveLastResponse] = useState(
    initialData?.type === "agent" ? (initialData?.custom?.preserve_last_response as boolean) || false : false,
  );
  const [expressions, setExpressions] = useState(initialData?.type === "character" ? initialData.expressions || [] : []);

  // Set author from profile settings or use a default
  const [author, setAuthor] = useState((initialData?.settings?.author as string) || currentProfile?.name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const settings: Record<string, unknown> = {
        author,
      };

      const custom: Record<string, unknown> = {};
      // Add type-specific settings
      if (type === "character") {
        custom.personality = personality;
      } else {
        custom.preserve_last_response = preserveLastResponse;
      }

      const formData = {
        name,
        type,
        version,
        avatar_path: avatarImage,
        profile_id: profileId,
        tags,
        settings,
        system_override: systemPrompt || null,
        external_update_link: null,
        auto_update: true,
        custom,
        ...(type === "character"
          ? {
              expressions: expressions.length > 0 ? expressions : null,
              character_manifest_id: null,
            }
          : {}),
      };

      if (isEditMode && initialData) {
        await updateCharacter(initialData.id, formData);
        toast.success(`${type === "character" ? "Character" : "Agent"} updated successfully!`);
      } else {
        await createCharacter(formData as any);
        toast.success(`${type === "character" ? "Character" : "Agent"} created successfully!`);
      }

      onSuccess();
    } catch (error) {
      toast.error(`Failed to ${isEditMode ? "update" : "create"} ${type}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form fields when switching between character and agent type
  useEffect(() => {
    if (!isEditMode) {
      if (type === "character") {
        setSystemPrompt("");
        setPreserveLastResponse(false);
      } else {
        setPersonality("");
        setExpressions([]);
      }
    }
  }, [type, isEditMode]);

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
            <Input id="name" placeholder="Character Name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="author">Author</Label>
            <Input id="author" placeholder="Your Name" required value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              placeholder="1.0.0"
              pattern="^\d+\.\d+\.\d+$"
              title="Version must be in format: major.minor.patch"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
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
          expressions={expressions}
          characterId={initialData?.id}
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Processing..." : isEditMode ? "Update" : "Create"} {type === "character" ? "Character" : "Agent"}
      </Button>
    </form>
  );
}
