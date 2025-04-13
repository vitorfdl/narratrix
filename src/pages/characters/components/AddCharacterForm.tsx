import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { AvatarCrop } from "@/components/shared/AvatarCrop";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/hooks/ProfileContext";
import { useCharacterActions, useCharacterTagList } from "@/hooks/characterStore";
import { useLorebookStoreActions, useLorebooks } from "@/hooks/lorebookStore";
import { useImageUrl } from "@/hooks/useImageUrl";
import { TemplatePicker } from "@/pages/formatTemplates/components/TemplatePicker";
import { LorebookEntries } from "@/pages/lorebooks/components/LorebookEntries";
import { Character } from "@/schema/characters-schema";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { saveImage } from "@/services/file-system-service";
import { ChevronDown, CircleCheckBig } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExpressionPackPreview } from "./ExpressionPackPreview";

interface CharacterFormProps {
  onSuccess: () => void;
  initialData?: Character;
  mode?: "create" | "edit";
  setIsEditing: (isEditing: boolean) => void;
}

// Character information form content
function CharacterInfoContent({
  personality = "",
  systemPrompt = "",
  expressions = [],
  characterId,
  onPersonalityChange,
  onSystemPromptChange,
}: {
  personality?: string;
  systemPrompt?: string;
  expressions?: Character["expressions"];
  characterId?: string;
  onPersonalityChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
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
              {characterId && <ExpressionPackPreview character_id={characterId} expressions={expressions || []} />}
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
    </div>
  );
}

// Empty Lorebook content
function LorebookContent({
  selectedLorebookId,
  onLorebookSelect,
  profileId,
}: {
  selectedLorebookId: string | null;
  onLorebookSelect: (id: string | null) => void;
  profileId: string;
}) {
  const allLorebooks = useLorebooks();
  const { createLorebook, deleteLorebook, updateLorebook, loadLorebookEntries } = useLorebookStoreActions();

  const handleNewLorebook = async (name: string) => {
    try {
      const newLorebook = await createLorebook({
        name,
        profile_id: profileId,
        description: `This is a character lorebook for the character ${name}.`,
        category: "character",
        tags: ["character", "biography"],
        allow_recursion: false,
        max_recursion_depth: 0,
        max_depth: 45,
        max_tokens: 1200,
        group_keys: [],
        extra: {},
      });
      if (newLorebook) {
        onLorebookSelect(newLorebook.id);
        toast.success(`Lorebook "${name}" created successfully!`);
      }
    } catch (error) {
      toast.error(`Failed to create lorebook: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteLorebook = async (id: string) => {
    try {
      await deleteLorebook(id);
      toast.success("Lorebook deleted successfully!");
      if (selectedLorebookId === id) {
        onLorebookSelect(null); // Deselect if the current one is deleted
      }
    } catch (error) {
      toast.error(`Failed to delete lorebook: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleEditLorebookName = async (id: string, newName: string) => {
    try {
      await updateLorebook(id, { name: newName });
      toast.success("Lorebook renamed successfully!");
    } catch (error) {
      toast.error(`Failed to rename lorebook: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const lorebookTemplates = allLorebooks.map((lb) => ({ id: lb.id, name: lb.name }));

  // Add a "None" option to allow deselection
  const templatesWithNone = [{ id: "None", name: "None (No Lorebook)" }, ...lorebookTemplates];

  return (
    <div className="flex flex-col space-y-4 min-h-[200px]">
      <TemplatePicker
        templates={templatesWithNone}
        selectedTemplateId={selectedLorebookId}
        onTemplateSelect={(id) => onLorebookSelect(id === "None" ? null : id)}
        onNewTemplate={handleNewLorebook}
        onDelete={handleDeleteLorebook}
        onEditName={handleEditLorebookName}
        onImport={() => toast.info("Import functionality not yet implemented.")}
        onExport={() => toast.info("Export functionality not yet implemented.")}
      />

      {selectedLorebookId ? (
        <LorebookEntries compact={true} lorebookId={selectedLorebookId} profileId={profileId} />
      ) : (
        <div className="flex-grow flex items-center justify-center text-muted-foreground text-center p-4 border border-dashed rounded-md">
          Select or create a lorebook to view and manage its entries.
        </div>
      )}
    </div>
  );
}

export function CharacterForm({ onSuccess, initialData, mode = "create", setIsEditing }: CharacterFormProps) {
  const isEditMode = mode === "edit";
  const { createCharacter, updateCharacter } = useCharacterActions();
  const { currentProfile } = useProfile();
  const profileId = currentProfile!.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tagList = useCharacterTagList();
  const [activeTab, setActiveTab] = useState("info");

  // Form state
  const [name, setName] = useState(initialData?.name || "");
  const [version, setVersion] = useState(initialData?.version || "1.0.0");
  const [avatarImage, setAvatarImage] = useState<string | null>(initialData?.avatar_path || null);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [personality, setPersonality] = useState((initialData?.custom?.personality as string) || "");
  const [systemPrompt, setSystemPrompt] = useState(initialData?.system_override || "");
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(initialData?.lorebook_id || null);

  // Load avatar image with the hook for consistent loading behavior
  const { url: avatarUrl, isLoading: isLoadingAvatar } = useImageUrl(avatarImage);

  // Set author from profile settings or use a default
  const [author, setAuthor] = useState((initialData?.settings?.author as string) || currentProfile?.name);

  useEffect(() => {
    return () => {
      setIsEditing(false); // Reset editing state when component unmounts
    };
  }, [setIsEditing]);

  /* Just to prevent the form from being closed when the user is editing */
  useEffect(() => {
    // Check if any form field has been modified
    const isNameChanged = (initialData?.name && name !== initialData.name) || (mode === "create" && name !== "");
    const isPersonalityChanged =
      (initialData?.custom?.personality && personality !== (initialData.custom.personality as string)) || (mode === "create" && personality !== "");
    const isSystemPromptChanged =
      (initialData?.system_override !== systemPrompt && systemPrompt !== "") || (mode === "create" && systemPrompt !== "");
    const isTagsChanged = (initialData?.tags && JSON.stringify(tags) !== JSON.stringify(initialData.tags)) || (mode === "create" && tags.length > 0);
    const isAvatarChanged = (initialData?.avatar_path !== avatarImage && avatarImage !== null) || (mode === "create" && avatarImage !== null);
    const isLorebookChanged =
      (initialData?.lorebook_id !== selectedLorebookId && selectedLorebookId !== null) || (mode === "create" && selectedLorebookId !== null);

    if (isNameChanged || isPersonalityChanged || isSystemPromptChanged || isTagsChanged || isAvatarChanged || isLorebookChanged) {
      setIsEditing(true);
    }
  }, [version, name, personality, systemPrompt, author, tags, avatarImage, selectedLorebookId, initialData, setIsEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const settings: Record<string, unknown> = {
        author,
      };

      const custom: Record<string, unknown> = {
        personality,
      };

      const avatar_path = avatarImage ? await saveImage(avatarImage, name, "characters") : initialData?.avatar_path;
      const formData: Partial<Character> = {
        name,
        type: "character",
        version,
        avatar_path: avatar_path || null,
        profile_id: profileId,
        tags,
        settings,
        system_override: systemPrompt || null,
        external_update_link: null,
        auto_update: true,
        custom,
        character_manifest_id: null,
        lorebook_id: selectedLorebookId,
      };

      if (isEditMode && initialData) {
        await updateCharacter(profileId, initialData.id, formData);
        toast.success("Character updated successfully!");
      } else {
        await createCharacter(formData as any);
        toast.success("Character created successfully!");
      }

      setIsEditing(false); // Explicitly reset editing state after successful submission
      onSuccess();
    } catch (error) {
      toast.error(`Failed to ${isEditMode ? "update" : "create"} character: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full mt-4">
          <TabsTrigger value="info">Character Information</TabsTrigger>
          <TabsTrigger value="lorebook">Character Lorebook</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="pt-4">
          <CharacterInfoContent
            personality={personality}
            systemPrompt={systemPrompt}
            characterId={initialData?.id}
            expressions={initialData?.expressions || []}
            onPersonalityChange={setPersonality}
            onSystemPromptChange={setSystemPrompt}
          />
        </TabsContent>
        <TabsContent value="lorebook" className="pt-4">
          <LorebookContent selectedLorebookId={selectedLorebookId} onLorebookSelect={setSelectedLorebookId} profileId={profileId} />
        </TabsContent>
      </Tabs>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Processing..." : isEditMode ? "Update" : "Create"} Character
      </Button>
    </form>
  );
}
