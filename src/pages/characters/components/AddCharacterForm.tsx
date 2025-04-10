import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { AvatarCrop } from "@/components/shared/AvatarCrop";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/hooks/ProfileContext";
import { useCharacterActions, useCharacterTagList } from "@/hooks/characterStore";
import { useImageUrl } from "@/hooks/useImageUrl";
import { CharacterUnion } from "@/schema/characters-schema";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { saveImage } from "@/services/file-system-service";
import { ChevronDown, CircleCheckBig } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
      <Card className="rounded-lg">
        <CardContent className="p-2 space-y-4">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Expression Pack</h3>
                  <HelpTooltip>
                    <p>Define visual expressions (e.g., happy, sad) for this character using images.</p>
                    <p>These expressions are automatically displayed during chats based on the conversation flow.</p>
                    <br />
                    <p>
                      <strong>How to Add:</strong> Drag & drop image files or use the 'Add' button. The filename (without extension) becomes the
                      expression name (e.g., <code>happy.png</code> becomes "happy").
                    </p>
                    <br />
                  </HelpTooltip>
                </div>
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

      <Card className="rounded-lg">
        <CardContent className="p-2 space-y-4">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">Custom System Prompt</h3>
                    <HelpTooltip>
                      <p>Overrides the context system prompt for this character.</p>
                    </HelpTooltip>
                  </div>
                  {systemPrompt && <CircleCheckBig className="h-4 w-4 text-primary" />}
                </div>
                <ChevronDown className="h-4 w-4 transition-transform ui-open:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="">
              <Separator className="my-2" />

              <MarkdownTextArea
                key={`${characterId}-system-prompt`}
                className="h-full max-h-[400px] overflow-y-auto"
                editable={true}
                initialValue={systemPrompt}
                onChange={onSystemPromptChange}
                suggestions={promptReplacementSuggestionList}
                placeholder="[Keep it blank to not override the default system prompt]"
              />
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <Label htmlFor="personality" descriptionTag={"{{character.personality}}"} className="mb-2">
          Personality
        </Label>
        <MarkdownTextArea
          key={`${characterId}-personality`}
          className="h-full max-h-[400px] overflow-y-auto"
          editable={true}
          initialValue={personality}
          onChange={onPersonalityChange}
          suggestions={promptReplacementSuggestionList.slice(0, 4)}
          placeholder="Describe the character {{character.name}} personality... Can be captured in the Formatting Template for System Prompts."
        />
      </div>
    </>
  );
}

// Agent-specific form content
function AgentFormContent({
  systemPrompt = "",
  characterId,
  preserveLastResponse = false,
  onSystemPromptChange,
  onPreserveLastResponseChange,
}: {
  systemPrompt?: string;
  characterId?: string;
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
        <MarkdownTextArea
          key={`${characterId}-system-prompt`}
          label="System Prompt"
          placeholder="Enter the system prompt..."
          initialValue={systemPrompt}
          editable={true}
          className="h-full max-h-[400px] min-h-24 overflow-y-auto"
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
  const tagList = useCharacterTagList();
  // Form state
  const [type, setType] = useState<"character" | "agent">(initialData?.type || "character");
  const [name, setName] = useState(initialData?.name || "");
  const [version, setVersion] = useState(initialData?.version || "1.0.0");
  const [avatarImage, setAvatarImage] = useState<string | null>(initialData?.avatar_path || null);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [personality, setPersonality] = useState(initialData?.type === "character" ? (initialData?.custom?.personality as string) || "" : "");
  const [systemPrompt, setSystemPrompt] = useState(initialData?.system_override || "");
  const [preserveLastResponse, setPreserveLastResponse] = useState(
    initialData?.type === "agent" ? (initialData?.custom?.preserve_last_response as boolean) || false : false,
  );

  // Load avatar image with the hook for consistent loading behavior
  const { url: avatarUrl, isLoading: isLoadingAvatar } = useImageUrl(avatarImage);

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

      const avatar_path = avatarImage ? await saveImage(avatarImage, name, "characters") : initialData?.avatar_path;
      const formData = {
        name,
        type,
        version,
        avatar_path: avatar_path || null,
        profile_id: profileId,
        tags,
        settings,
        system_override: systemPrompt || null,
        external_update_link: null,
        auto_update: true,
        custom,
        ...(type === "character"
          ? {
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
      }
    }
  }, [type, isEditMode]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditMode && (
        <div className="flex justify-center gap-2">
          <Button type="button" variant={type === "character" ? "default" : "outline"} onClick={() => setType("character")} className="w-32">
            Character
          </Button>
          {/* TODO: Add agent support */}
          <Button
            type="button"
            disabled
            variant={type === "agent" ? "default" : "outline"}
            onClick={() => setType("agent")}
            className="w-32 line-through"
          >
            Agent
          </Button>
        </div>
      )}

      <div className="flex flex-row gap-8">
        <div className="flex-1 grid grid-cols-2 gap-1">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Character name"
              className="w-full"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input id="author" placeholder="Your Name" required value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              type="text"
              placeholder="1.0.0"
              pattern="\d+\.\d+\.\d+"
              title="Version must be in format: major.minor.patch"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="tags">Tags</Label>
            <CommandTagInput value={tags} onChange={setTags} suggestions={tagList} placeholder="Add a tag..." maxTags={10} />
          </div>
        </div>

        <div className="md:w-[15vw] flex flex-col items-center justify-center">
          <Label htmlFor="avatar" className="mb-2">
            Avatar
          </Label>
          <Card className="relative w-32 h-32 ring-2 ring-border overflow-hidden rounded-full">
            <AvatarCrop
              onCropComplete={(image) => setAvatarImage(image)}
              cropShape="round"
              existingImage={avatarUrl || avatarImage}
              className={`overflow-hidden h-full w-full rounded-full ${isLoadingAvatar ? "opacity-70" : "opacity-100"} transition-opacity duration-200`}
            />
          </Card>
        </div>
      </div>

      {/* Render type-specific form content */}
      {type === "character" ? (
        <CharacterFormContent
          personality={personality}
          systemPrompt={systemPrompt}
          characterId={initialData?.id}
          onPersonalityChange={setPersonality}
          onSystemPromptChange={setSystemPrompt}
        />
      ) : (
        <AgentFormContent
          characterId={initialData?.id}
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
