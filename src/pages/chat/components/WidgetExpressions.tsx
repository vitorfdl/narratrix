import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useCurrentChatMessages, useCurrentChatParticipants } from "@/hooks/chatStore";
import { useExpressionStore } from "@/hooks/expressionStore";
import { useModels } from "@/hooks/modelsStore";
import { useMultipleImageUrls } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { Character, EXPRESSION_LIST } from "@/schema/characters-schema";
import { ChatMessage, basicPromptSuggestionList } from "@/schema/chat-message-schema";
import { useBackgroundInference } from "@/services/background-inference-service";
import { findClosestExpressionMatch } from "@/utils/fuzzy-search";
import { useLocalExpressionGenerationSettings } from "@/utils/local-storage";
import { Loader2Icon, Pause, Play, RefreshCw, Settings, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useThrottledCallback } from "use-debounce";

export type ExpressionGenerateSettings = {
  modelId: string;
  autoRefresh: boolean;
  requestPrompt: string;
  systemPrompt: string;
};

const ExpressionSuggestionList = [
  ...basicPromptSuggestionList,
  { title: "expression.list", description: "Available expressions for the character" },
  { title: "expression.last", description: "Last expression for the character" },
  { title: "chat.message", description: "Last message from the character" },
];

const defaultSystemPrompt = "You are an expert at determining the emotions of the character {{character.name}} from text.";
const defaultRequestPrompt = `Character: {{character.name}}
{{character.personality}}

--- {{character.name}}'s last message ---
{{chat.message}}

---

Last Expression (Avoid Repeating the same expression): {{expression.last}}
Based on the character's personality and their last paragraph, choose the most fitting expression from the following list:
{{expression.list}}

Return only the single word for the expression.`;

const WidgetExpressions = () => {
  const { generateQuietly } = useBackgroundInference();
  const models = useModels(); // Get models list for selecting a model
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // State for dialog visibility
  const [tempRequestPrompt, setTempRequestPrompt] = useState(""); // Temp state for dialog
  const [tempSystemPrompt, setTempSystemPrompt] = useState(""); // Temp state for dialog

  // Use the hook for settings
  const [expressionSettings, setExpressionSettings] = useLocalExpressionGenerationSettings();
  const { modelId: selectedModelId, autoRefresh: autoRefreshEnabled } = expressionSettings;

  // Get state and actions from the expression store
  const { selectedText, selectedMessageCharacterId, clearSelection } = useExpressionStore();

  // Helper functions to update specific settings
  const setSelectedModelId = (modelId: string) => {
    setExpressionSettings((prev) => ({ ...prev, modelId }));
  };
  const setAutoRefreshEnabled = (enabled: boolean) => {
    setExpressionSettings((prev) => ({ ...prev, autoRefresh: enabled }));
  };

  const participantList = useCurrentChatParticipants();
  const characterList = useCharacters();
  const messages = useCurrentChatMessages();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();
  const [animateLastSpeaker, setAnimateLastSpeaker] = useState(false);
  const [characterExpressions, setCharacterExpressions] = useState<Record<string, string>>({});
  const lastMessageContentRef = useRef<string>(""); // Ref for latest message content
  const lastSpeakerIdRef = useRef<string | undefined>(undefined); // Ref for latest speaker ID
  const lastMessageRef = useRef<ChatMessage | null>(null); // Ref for latest message object

  // Memoize active characters list
  const activeCharacters = useMemo(() => {
    return characterList?.filter(
      (character) => character.type === "character" && participantList?.some((p) => p.id === character.id && p.enabled),
    ) as Character[];
  }, [characterList, participantList]);

  // Memoize last message and speaker information
  const lastMessage = useMemo(() => (messages && messages.length > 0 ? messages[messages.length - 1] : null), [messages]);
  const lastSpeakerId = useMemo(() => lastMessage?.character_id, [lastMessage]);
  const lastMessageContent = useMemo(() => lastMessage?.messages?.[lastMessage?.message_index] || "", [lastMessage]);

  const lastSpeakerCharacter = useMemo(() => {
    return activeCharacters?.find((char) => char.id === lastSpeakerId);
  }, [activeCharacters, lastSpeakerId]);

  // Effect to update refs whenever the state changes
  useEffect(() => {
    lastMessageContentRef.current = lastMessageContent;
  }, [lastMessageContent]);

  useEffect(() => {
    lastSpeakerIdRef.current = lastSpeakerId ?? undefined; // Handle null case
  }, [lastSpeakerId]);

  useEffect(() => {
    lastMessageRef.current = lastMessage; // Update last message ref
  }, [lastMessage]);

  // Effect to populate temp state when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      setTempRequestPrompt(expressionSettings.requestPrompt);
      setTempSystemPrompt(expressionSettings.systemPrompt);
    }
  }, [isSettingsOpen, expressionSettings.requestPrompt, expressionSettings.systemPrompt]);

  // --- Load Expression Images ---
  const getExpressionForUrlLoading = useCallback(
    (characterId: string): { id: string; path: string | null } => {
      const character = activeCharacters?.find((char) => char.id === characterId);
      const expressionName = characterExpressions[characterId] || "neutral"; // Default to 'neutral'
      const expression = character?.expressions?.find((exp) => exp.name.toLowerCase() === expressionName.toLowerCase());
      return {
        id: characterId, // Use characterId as the key for the urlMap
        path: expression?.image_path ?? null, // Provide the path or null
      };
    },
    [activeCharacters, characterExpressions], // Stable dependencies
  );

  // Memoize the input array for useMultipleImageUrls
  const expressionObjectsToLoad = useMemo(() => {
    return activeCharacters.map((char) => getExpressionForUrlLoading(char.id));
  }, [activeCharacters, getExpressionForUrlLoading]);

  // Stable getter functions for useMultipleImageUrls
  const getPathForItem = useCallback((item: { path: string | null }) => item.path, []);
  const getIdForItem = useCallback((item: { id: string }) => item.id, []);

  // Use useMultipleImageUrls hook
  const { urlMap: expressionUrlMap, isLoading } = useMultipleImageUrls(expressionObjectsToLoad, getPathForItem, getIdForItem);
  // ------------------------------

  // Manual expression generation function (now reads from refs AND selected text)
  const generateExpression = useCallback(
    async (userPickedText?: string) => {
      // Determine the character ID: Use selected character if text is selected, otherwise use the last speaker
      const currentSpeakerId = userPickedText ? selectedMessageCharacterId : lastSpeakerIdRef.current;
      const currentLastMessage = lastMessageRef.current; // Still needed for chapter ID

      if (!currentSpeakerId || !selectedModelId || selectedModelId === "none") {
        if (selectedText) {
          clearSelection(); // Clear selection if we skipped because of it
        }
        return;
      }

      // Use selected text if available, otherwise fallback to last message content
      const messageContentToUse = userPickedText || currentLastMessage?.messages?.[0] || "";

      if (!messageContentToUse) {
        // If there's no selected text AND no last message content, we can't proceed
        if (selectedText) {
          clearSelection();
        }
        return;
      }

      const targetCharacter = activeCharacters?.find((char) => char.id === currentSpeakerId);
      if (!targetCharacter) {
        console.warn(`Target character with ID ${currentSpeakerId} not found in active list.`);
        if (selectedText) {
          clearSelection();
        }
        return;
      }

      console.log(`Attempting to generate expression for ${targetCharacter.name} using ${userPickedText ? "!!!!selected text" : "last message"}`);

      setAnimateLastSpeaker(true);
      setTimeout(() => setAnimateLastSpeaker(false), 1000);

      const availableExpressions = targetCharacter.expressions?.length
        ? targetCharacter.expressions.filter((exp) => exp.image_path).map((exp) => exp.name)
        : EXPRESSION_LIST;
      const availableExpressionNames = targetCharacter.expressions?.length ? targetCharacter.expressions.map((exp) => exp.name) : EXPRESSION_LIST;

      try {
        const expressionResult = await generateQuietly({
          context: {
            characterID: currentSpeakerId,
            chapterID: currentLastMessage?.chapter_id, // Use chapter ID from last message context if available
            extra: {
              "expression.list": availableExpressions.join(", "),
              "expression.last": characterExpressions[currentSpeakerId] || "neutral",
              // Use the determined message content (selected or last)
              "chat.message": messageContentToUse,
            },
          },
          modelId: selectedModelId,
          prompt: expressionSettings.requestPrompt || defaultRequestPrompt,
          parameters: {
            max_tokens: 50,
            max_context: 4052,
            min_p: 0.5,
            temperature: 0.8,
            stop: ["\n"],
          },
          systemPrompt: expressionSettings.systemPrompt || defaultSystemPrompt,
        });

        const rawExpression = expressionResult?.trim().split("\n")[0].split(" ")[0].toLowerCase() || "";
        const finalExpression = findClosestExpressionMatch(rawExpression, availableExpressionNames, "neutral");

        setCharacterExpressions((prev) => ({
          ...prev,
          [currentSpeakerId]: finalExpression,
        }));
        // Clear selection after successful generation
        if (selectedText) {
          clearSelection();
        }
      } catch (error) {
        toast.error(`Error generating expression for ${targetCharacter.name}:`, {
          description: error instanceof Error ? error.message : "An unknown error occurred",
        });
        console.error(`Error generating expression for ${targetCharacter.name}:`, error);
        setCharacterExpressions((prev) => ({
          ...prev,
          [currentSpeakerId]: "neutral",
        }));
        // Clear selection on error
        if (selectedText) {
          clearSelection();
        }
      }
    },
    [
      activeCharacters,
      generateQuietly,
      selectedModelId,
      expressionSettings.requestPrompt,
      expressionSettings.systemPrompt,
      characterExpressions,
      // Add selected text state and actions to dependencies
      selectedText,
      selectedMessageCharacterId,
      clearSelection,
    ],
  ); // Added characterExpressions and selected text related vars

  // Create a throttled version for updates during streaming - Call useThrottledCallback directly
  const throttledGenerateExpression = useThrottledCallback(generateExpression, 3000, { leading: true, trailing: false });

  // Effect to trigger THROTTLED generation DURING streaming
  useEffect(() => {
    if (autoRefreshEnabled && selectedModelId && selectedModelId !== "none") {
      if (selectedText && selectedMessageCharacterId) {
        generateExpression(selectedText);
      }
      if (lastSpeakerId && lastMessageContent) {
        throttledGenerateExpression(); // Call the throttled function directly
      }
    }
  }, [lastMessageContent, lastSpeakerId, autoRefreshEnabled, selectedModelId, selectedText, throttledGenerateExpression]);

  // Simplified Toggle auto-refresh: just update the state
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  }, [autoRefreshEnabled, setAutoRefreshEnabled]); // Dependencies: current state and its setter

  // Function to handle saving settings from the dialog
  const handleSaveSettings = useCallback(() => {
    setExpressionSettings((prev) => ({
      ...prev,
      requestPrompt: tempRequestPrompt,
      systemPrompt: tempSystemPrompt,
    }));
    setIsSettingsOpen(false);
  }, [setExpressionSettings, tempRequestPrompt, tempSystemPrompt]);

  // Function to get expression for a character (stable via useCallback)
  const getCharacterExpression = useCallback(
    (characterId: string) => {
      return characterExpressions[characterId] || "neutral";
    },
    [characterExpressions],
  );

  // Memoize single character and display character
  const singleCharacter = useMemo(() => (activeCharacters && activeCharacters.length === 1 ? activeCharacters[0] : null), [activeCharacters]);
  const displayCharacter = useMemo(() => {
    return (lastSpeakerCharacter ||
      singleCharacter ||
      (activeCharacters && activeCharacters.length > 0 ? activeCharacters[0] : null)) as Character | null;
  }, [lastSpeakerCharacter, singleCharacter, activeCharacters]);

  // Fill entire available space - using flex-1 to ensure the component properly fills available space in any container
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ minHeight: "200px" }}>
      {/* Controls at the top */}
      <div className="bg-card border-b px-2 py-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Model:</span>
          <div className="flex-grow z-10 flex items-center gap-2">
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select model..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {models && models.length > 0 ? (
                  models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No models available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => generateExpression()}
                // Disable if no model OR (no selected text AND no last speaker)
                disabled={!selectedModelId || selectedModelId === "none" || (!selectedText && !lastSpeakerId)}
                title={selectedText ? "Generate expression from selection" : "Generate expression for current speaker"}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant={autoRefreshEnabled ? "default" : "outline"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={toggleAutoRefresh}
                disabled={!selectedModelId || selectedModelId === "none"}
                title={autoRefreshEnabled ? "Disable auto-refresh" : "Enable auto-refresh"}
              >
                {autoRefreshEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          {/* Settings Button */}
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 p-0" title="Configure Prompts">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="">
              <DialogHeader>
                <DialogTitle>Configure Expression Prompts</DialogTitle>
                <DialogDescription>Customize the prompts used to generate character expressions.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <MarkdownTextArea
                    initialValue={tempSystemPrompt}
                    onChange={(value) => setTempSystemPrompt(value)}
                    editable={true}
                    placeholder={defaultSystemPrompt}
                    className="min-h-[100px] max-h-[20vh] overflow-y-auto"
                    suggestions={ExpressionSuggestionList}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="request-prompt">User Prompt (Request)</Label>
                  <MarkdownTextArea
                    initialValue={tempRequestPrompt}
                    onChange={(value) => setTempRequestPrompt(value)}
                    editable={true}
                    placeholder={defaultRequestPrompt}
                    suggestions={ExpressionSuggestionList}
                    className="min-h-[100px] max-h-[20vh]"
                  />
                  <p className="text-xs italic text-muted-foreground">
                    Available placeholders: {"{{"}character.name{"}}"}, {"{{"}character.personality{"}}"}, {"{{"}expression.list{"}}"}, {"{{"}
                    expression.last{"}}"}, {"{{"}chat.message{"}}"}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-background/50 backdrop-blur-sm relative">
        <div className="w-full h-full flex items-center justify-center">
          {activeCharacters && activeCharacters.length > 0 ? (
            <>
              {/* Single Character View */}
              <div className="w-full h-full flex flex-col items-center justify-center">
                {displayCharacter && (
                  <div
                    className={cn(
                      "w-full h-full relative transition-transform duration-150 ease-in-out",
                      animateLastSpeaker && displayCharacter.id === (selectedText ? selectedMessageCharacterId : lastSpeakerId)
                        ? "scale-105"
                        : "scale-100",
                    )}
                    style={{ minHeight: "200px", height: "100%" }}
                  >
                    <Avatar className="w-full h-full shadow-lg" style={{ aspectRatio: "1/1", minHeight: "100px" }}>
                      {!isLoading && (
                        <AvatarImage
                          src={expressionUrlMap[displayCharacter.id] || avatarUrlMap[displayCharacter.id] || undefined}
                          alt={displayCharacter.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <AvatarFallback>
                        <Loader2Icon className="w-[50%] h-[50%] animate-spin" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-center">
                      <p className="text-sm font-medium text-primary-foreground drop-shadow-md">
                        {/* Add visual indicator for selected text */}
                        {selectedText && autoRefreshEnabled && (
                          <div className="bg-primary/10 border-l-4 border-primary px-2 py-1 text-sm z-10 shadow-sm">
                            <p className="text-xs text-muted mb-0.5">Generating expression from selected text!</p>
                          </div>
                        )}
                        {displayCharacter.name}
                        {/* Show expression if it's the last speaker OR if text was selected for this character */}
                        {(displayCharacter.id === lastSpeakerId || (selectedText && displayCharacter.id === selectedMessageCharacterId)) && (
                          <span className="block text-sm font-normal text-primary-foreground/90 mt-0.5">
                            {getCharacterExpression(displayCharacter.id)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
              <User className="h-16 w-16 text-primary/20" />
              <p className="text-base font-medium">No Active Characters</p>
              <p className="text-sm">Character expressions will appear here once characters are added to the chat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WidgetExpressions;
