import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useCurrentChatMessages, useCurrentChatParticipants } from "@/hooks/chatStore";
import { useModels } from "@/hooks/modelsStore";
import { useMultipleImageUrls } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { Character, EXPRESSION_LIST } from "@/schema/characters-schema";
import { ChatMessage, basicPromptSuggestionList } from "@/schema/chat-message-schema";
import { useBackgroundInference } from "@/services/background-inference-service";
import { findClosestExpressionMatch } from "@/utils/fuzzy-search";
import { useLocalExpressionGenerationSettings } from "@/utils/local-storage";
import { Pause, Play, RefreshCw, Settings, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
Personality: {{character.personality}}
Last Message: {{chat.message}}
Last Expression: {{expression.last}}

Based on the character's personality and their last message and last paragraph, choose the most fitting expression from the following list:
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
  const { urlMap: expressionUrlMap } = useMultipleImageUrls(expressionObjectsToLoad, getPathForItem, getIdForItem);
  // ------------------------------

  // Manual expression generation function (now reads from refs)
  const generateExpression = useCallback(async () => {
    const currentSpeakerId = lastSpeakerIdRef.current;
    const currentLastMessage = lastMessageRef.current;

    if (!currentSpeakerId || !currentLastMessage?.messages?.[0] || !selectedModelId || selectedModelId === "none") {
      console.log("Expression generation skipped: missing speaker, message, or model.");
      return;
    }

    const currentSpeakerCharacter = activeCharacters?.find((char) => char.id === currentSpeakerId);
    if (!currentSpeakerCharacter) {
      console.warn(`Speaker character with ID ${currentSpeakerId} not found in active list.`);
      return;
    }

    console.log(`Attempting to generate expression for ${currentSpeakerCharacter.name}`);

    setAnimateLastSpeaker(true);
    setTimeout(() => setAnimateLastSpeaker(false), 1000); // Animation for feedback

    const messageContent = currentLastMessage.messages[0]; // Use message from ref
    const availableExpressions = currentSpeakerCharacter.expressions?.length
      ? currentSpeakerCharacter.expressions.map((exp) => exp.name)
      : EXPRESSION_LIST;

    const availableExpressionNames = currentSpeakerCharacter.expressions?.length
      ? currentSpeakerCharacter.expressions.map((exp) => exp.name)
      : EXPRESSION_LIST;

    try {
      const expressionResult = await generateQuietly({
        context: {
          characterID: currentSpeakerId,
          chapterID: lastMessage?.chapter_id,
          extra: {
            "expression.list": availableExpressions.join(", "),
            "expression.last": characterExpressions[currentSpeakerId] || "neutral",
            "chat.message": messageContent,
          },
        },
        modelId: selectedModelId,
        prompt: expressionSettings.requestPrompt || defaultRequestPrompt,
        parameters: {
          max_tokens: 10,
          min_p: 0.9,
          temperature: 0.5,
        },
        // Use systemPrompt from settings if available
        systemPrompt: expressionSettings.systemPrompt || defaultSystemPrompt,
      });

      const rawExpression = expressionResult?.trim().split("\n")[0].split(" ")[0].toLowerCase() || "";

      // Use fuzzy search to find the closest valid expression
      const finalExpression = findClosestExpressionMatch(
        rawExpression,
        availableExpressionNames, // Pass the list of valid names
        "neutral", // Default value
      );

      setCharacterExpressions((prev) => ({
        ...prev,
        [currentSpeakerId]: finalExpression, // Use currentSpeakerId from ref
      }));
    } catch (error) {
      console.error(`Error generating expression for ${currentSpeakerCharacter.name}:`, error);
      setCharacterExpressions((prev) => ({
        ...prev,
        [currentSpeakerId]: "neutral", // Fallback on error
      }));
    }
  }, [activeCharacters, generateQuietly, selectedModelId, expressionSettings.requestPrompt, expressionSettings.systemPrompt, characterExpressions]); // Added characterExpressions to dependency array

  // Create a throttled version for updates during streaming - Call useThrottledCallback directly
  const throttledGenerateExpression = useThrottledCallback(
    generateExpression,
    3000, // Throttle generation to max once per 3000ms
    { leading: true, trailing: false }, // Trigger on the leading edge, not trailing
  );

  // Effect to trigger THROTTLED generation DURING streaming
  useEffect(() => {
    if (autoRefreshEnabled && selectedModelId && selectedModelId !== "none") {
      if (lastSpeakerId && lastMessageContent) {
        // console.log("Change detected (speaker/message), triggering throttled generation (max 1 per 3s)...");
        throttledGenerateExpression(); // Call the throttled function directly
      }
      // No else log needed here to avoid spamming console during rapid changes before throttle window
    }
    // Dependencies: Run when the definitive message content, speaker, or settings change
    // Add throttledGenerateExpression to dependencies
  }, [lastMessageContent, lastSpeakerId, autoRefreshEnabled, selectedModelId, throttledGenerateExpression]);

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
                onClick={generateExpression}
                disabled={!selectedModelId || selectedModelId === "none" || !lastSpeakerId}
                title="Generate expression for current speaker"
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
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Configure Expression Prompts</DialogTitle>
                <DialogDescription>Customize the prompts used to generate character expressions.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <div className="border border-input rounded-md">
                    <TipTapTextArea
                      initialValue={tempSystemPrompt}
                      onChange={(value) => setTempSystemPrompt(value)}
                      placeholder={defaultSystemPrompt}
                      className="min-h-[100px]"
                      disableRichText={true}
                      suggestions={ExpressionSuggestionList}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="request-prompt">User Prompt (Request)</Label>
                  <div className="border border-input rounded-md">
                    <TipTapTextArea
                      initialValue={tempRequestPrompt}
                      onChange={(value) => setTempRequestPrompt(value)}
                      placeholder={defaultRequestPrompt}
                      className="min-h-[150px]"
                      disableRichText={true}
                      suggestions={ExpressionSuggestionList}
                    />
                  </div>
                  <p className="text-xs italic text-muted-foreground">
                    Available placeholders: {"{{"}expression.list{"}}"}, {"{{"}expression.last{"}}"}, {"{{"}chat.message{"}}"}
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
                      animateLastSpeaker && displayCharacter.id === lastSpeakerId ? "scale-105" : "scale-100",
                    )}
                    style={{ minHeight: "200px", height: "100%" }}
                  >
                    <Avatar className="w-full h-full shadow-lg" style={{ aspectRatio: "1/1", minHeight: "100px" }}>
                      <AvatarImage
                        src={expressionUrlMap[displayCharacter.id] || avatarUrlMap[displayCharacter.id] || undefined}
                        alt={displayCharacter.name}
                        className="w-full h-full object-cover"
                      />
                      <AvatarFallback className="text-4xl bg-accent text-accent-foreground">
                        {displayCharacter.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-center">
                      <p className="text-lg font-medium text-primary-foreground drop-shadow-md">
                        {displayCharacter.name}
                        {displayCharacter.id === lastSpeakerId && (
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
