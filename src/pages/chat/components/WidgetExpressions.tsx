import { Clock, FileText, Loader2Icon, MessageCircle, Pause, Play, RefreshCw, Settings, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useThrottledCallback } from "use-debounce";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useCurrentChatMessages, useCurrentChatParticipants } from "@/hooks/chatStore";
import { useExpressionStore } from "@/hooks/expressionStore";
import { useMultipleImageUrls } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import WidgetConfig from "@/pages/chat/components/WidgetConfig";
import { Character, EXPRESSION_LIST } from "@/schema/characters-schema";
import { basicPromptSuggestionList, ChatMessage } from "@/schema/chat-message-schema";
import { useBackgroundInference } from "@/services/background-inference-service";
import { estimateTokens } from "@/services/inference/formatter/apply-context-limit";
import { findClosestExpressionMatch } from "@/utils/fuzzy-search";
import { useLocalExpressionGenerationSettings } from "@/utils/local-storage";

export type ExpressionGenerateSettings = {
  chatTemplateId: string;
  autoRefresh: boolean;
  requestPrompt: string;
  systemPrompt: string;
  throttleInterval: number; // Auto mode update frequency in milliseconds
  disableLogs: boolean; // Option to disable logs for background inference
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // State for dialog visibility
  const [activeTab, setActiveTab] = useState("basic"); // State for active tab
  const [tempRequestPrompt, setTempRequestPrompt] = useState(""); // Temp state for dialog
  const [tempSystemPrompt, setTempSystemPrompt] = useState(""); // Temp state for dialog
  const [tempChatTemplateId, setTempChatTemplateId] = useState(""); // Temp state for chat template
  const [tempThrottleInterval, setTempThrottleInterval] = useState(8000); // Temp state for throttle interval
  const [tempDisableLogs, setTempDisableLogs] = useState(false); // Temp state for disable logs

  // Use the hook for settings
  const [expressionSettings, setExpressionSettings] = useLocalExpressionGenerationSettings();

  // Get the selected template's modelId
  const autoRefreshEnabled = expressionSettings.autoRefresh;

  // Get state and actions from the expression store
  const { selectedText, selectedMessageCharacterId, clearSelection } = useExpressionStore();

  const setAutoRefreshEnabled = useCallback(
    (enabled: boolean) => {
      setExpressionSettings((prev) => ({ ...prev, autoRefresh: enabled }));
    },
    [setExpressionSettings],
  );

  const participantList = useCurrentChatParticipants();
  const characterList = useCharacters();
  const messages = useCurrentChatMessages();
  const { urlMap: avatarUrlMap } = useCharacterAvatars();
  // const [animateLastSpeaker, setAnimateLastSpeaker] = useState(false);
  const [characterExpressions, setCharacterExpressions] = useState<Record<string, string>>({});
  const lastMessageContentRef = useRef<string>(""); // Ref for latest message content
  const lastSpeakerIdRef = useRef<string | undefined>(undefined); // Ref for latest speaker ID
  const lastMessageRef = useRef<ChatMessage | null>(null); // Ref for latest message object

  // Memoize active characters list
  const activeCharacters = useMemo(() => {
    return characterList?.filter((character) => character.type === "character" && participantList?.some((p) => p.id === character.id && p.enabled)) as Character[];
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
      setTempChatTemplateId(expressionSettings.chatTemplateId || "");
      setTempThrottleInterval(expressionSettings.throttleInterval || 8000);
      setTempDisableLogs(expressionSettings.disableLogs || false);
      setActiveTab("basic");
    }
  }, [isSettingsOpen, expressionSettings.requestPrompt, expressionSettings.systemPrompt, expressionSettings.chatTemplateId, expressionSettings.throttleInterval, expressionSettings.disableLogs]);

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

  const { urlMap: expressionUrlMap } = useMultipleImageUrls(expressionObjectsToLoad, getPathForItem, getIdForItem);

  // Manual expression generation function (now reads from refs AND selected text)
  const generateExpression = useCallback(
    async (userPickedText?: string) => {
      // Determine the character ID: Use selected character if text is selected, otherwise use the last speaker
      const currentSpeakerId = userPickedText ? selectedMessageCharacterId : lastSpeakerIdRef.current;
      const currentLastMessage = lastMessageRef.current; // Still needed for chapter ID

      if (!currentSpeakerId || !expressionSettings.chatTemplateId) {
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

      // Skip expression generation if message content is just "..." three dots
      if (messageContentToUse.trim() === "...") {
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

      // setAnimateLastSpeaker(true);
      // setTimeout(() => setAnimateLastSpeaker(false), 1000);

      const availableExpressions = targetCharacter.expressions?.length ? targetCharacter.expressions.filter((exp) => exp.image_path).map((exp) => exp.name) : EXPRESSION_LIST;
      const availableExpressionNames = targetCharacter.expressions?.length ? targetCharacter.expressions.map((exp) => exp.name) : EXPRESSION_LIST;

      try {
        const expressionResult = await generateQuietly({
          chatTemplateId: expressionSettings.chatTemplateId,
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
          prompt: expressionSettings.requestPrompt || defaultRequestPrompt,
          systemPrompt: expressionSettings.systemPrompt || defaultSystemPrompt,
          disableLogs: expressionSettings.disableLogs || false,
        }).catch((error) => {
          toast.error(`Error generating expression for ${targetCharacter.name}: ${error}`);
          return "neutral";
        });

        const rawExpression = expressionResult?.trim().split("\n")[0].split(" ")[0].toLowerCase() || "";
        const finalExpression = findClosestExpressionMatch(rawExpression, availableExpressionNames, "neutral");

        setCharacterExpressions((prev) => ({
          ...prev,
          [currentSpeakerId]: finalExpression,
        }));
        // Clear selection after successful generation
        // if (selectedText) {
        //   clearSelection();
        // }
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
      expressionSettings.requestPrompt,
      expressionSettings.systemPrompt,
      expressionSettings.chatTemplateId,
      expressionSettings.disableLogs,
      characterExpressions,
      // Add selected text state and actions to dependencies
      selectedText,
      selectedMessageCharacterId,
      clearSelection,
    ],
  ); // Added characterExpressions and selected text related vars

  // Create a throttled version for updates during streaming - Call useThrottledCallback directly
  const throttledGenerateExpression = useThrottledCallback(generateExpression, expressionSettings.throttleInterval || 8000, { leading: true, trailing: false });

  // Effect to trigger THROTTLED generation DURING streaming
  useEffect(() => {
    if (autoRefreshEnabled && expressionSettings.chatTemplateId) {
      if (selectedText && selectedMessageCharacterId) {
        generateExpression(selectedText);
      }
    }
  }, [autoRefreshEnabled, expressionSettings.chatTemplateId, selectedText, selectedMessageCharacterId, generateExpression]);

  useEffect(() => {
    if (autoRefreshEnabled && expressionSettings.chatTemplateId) {
      if (lastSpeakerId && lastMessageContent && lastMessageContent.trim() !== "...") {
        throttledGenerateExpression(); // Call the throttled function directly
      }
    }
  }, [lastMessageContent, lastSpeakerId, autoRefreshEnabled, expressionSettings.chatTemplateId, throttledGenerateExpression]);

  // Simplified Toggle auto-refresh: just update the state
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  }, [autoRefreshEnabled, setAutoRefreshEnabled]); // Dependencies: current state and setter

  // Function to handle saving settings from the dialog
  const handleSaveSettings = useCallback(() => {
    setExpressionSettings((prev) => ({
      ...prev,
      requestPrompt: tempRequestPrompt,
      systemPrompt: tempSystemPrompt,
      chatTemplateId: tempChatTemplateId,
      throttleInterval: tempThrottleInterval,
      disableLogs: tempDisableLogs,
    }));
    setIsSettingsOpen(false);
  }, [setExpressionSettings, tempRequestPrompt, tempSystemPrompt, tempChatTemplateId, tempThrottleInterval, tempDisableLogs]);

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
    return (lastSpeakerCharacter || singleCharacter || (activeCharacters && activeCharacters.length > 0 ? activeCharacters[0] : null)) as Character | null;
  }, [lastSpeakerCharacter, singleCharacter, activeCharacters]);

  // Fill entire available space - using flex-1 to ensure the component properly fills available space in any container
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ minHeight: "200px" }}>
      <div className="flex-1 flex items-center justify-center bg-background/50 backdrop-blur-sm relative">
        <div className="w-full h-full flex items-center justify-center">
          {activeCharacters && activeCharacters.length > 0 ? (
            <>
              {/* Single Character View */}
              <div className="w-full h-full flex flex-col items-center justify-center">
                {displayCharacter && (
                  <div className={cn("w-full h-full relative")} style={{ minHeight: "200px", height: "100%" }}>
                    <Avatar className="w-full h-full shadow-lg" style={{ aspectRatio: "1/1", minHeight: "100px" }}>
                      <AvatarImage
                        key={(expressionUrlMap[displayCharacter.id] || avatarUrlMap[displayCharacter.id]) as string}
                        src={expressionUrlMap[displayCharacter.id] || avatarUrlMap[displayCharacter.id] || undefined}
                        alt={displayCharacter.name}
                        className="w-full h-full object-cover transition-opacity duration-200 ease-out opacity-100"
                      />
                      <AvatarFallback>
                        <Loader2Icon className="w-[50%] h-[50%] animate-spin" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-center">
                      <p className="text-sm font-medium text-primary-foreground drop-shadow-md">
                        {/* Add visual indicator for selected text */}

                        {displayCharacter.name}
                        {/* Show expression if it's the last speaker OR if text was selected for this character */}
                        {(displayCharacter.id === lastSpeakerId || (selectedText && displayCharacter.id === selectedMessageCharacterId)) && (
                          <span className="block text-sm font-normal text-primary-foreground/90 mt-0.5">{getCharacterExpression(displayCharacter.id)}</span>
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

      {/* Controls - always visible compact toolbar */}
      <div className="px-3  mt-2">
        <div className="mx-auto w-full">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-2 py-1 shadow-sm">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => generateExpression()}
                disabled={!expressionSettings.chatTemplateId || (!selectedText && !lastSpeakerId)}
                aria-label={selectedText ? "Generate expression from selection" : "Generate expression for current speaker"}
                title={selectedText ? "Generate from selection" : "Generate for speaker"}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline text-xs">Generate</span>
              </Button>

              <Button
                variant={autoRefreshEnabled ? "default" : "ghost"}
                size="xs"
                onClick={toggleAutoRefresh}
                disabled={!expressionSettings.chatTemplateId}
                aria-pressed={autoRefreshEnabled}
                aria-label={autoRefreshEnabled ? "Disable auto-refresh" : "Enable auto-refresh"}
                title={autoRefreshEnabled ? "Auto-refresh on" : "Auto-refresh off"}
              >
                {autoRefreshEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline text-xs">Auto</span>
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="xs" className="w-auto" title="Configure Prompts" aria-label="Open expression settings">
                    <Settings size={1} />
                    <span className="ml-1 hidden sm:inline text-xs">Settings</span>
                  </Button>
                </DialogTrigger>
                <DialogContent size="window" className="max-h-[85vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-1 text-lg">
                      <Settings className="h-4 w-4 text-primary" />
                      Configure Expression Settings
                    </DialogTitle>
                    <DialogDescription>Customize the prompts and behavior for character expression generation.</DialogDescription>
                  </DialogHeader>

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid grid-cols-3 mb-3">
                      <TabsTrigger value="basic" className="flex items-center gap-1 py-1">
                        <MessageCircle className="h-3 w-3" />
                        <span>Prompts</span>
                      </TabsTrigger>
                      <TabsTrigger value="template" className="flex items-center gap-1 py-1">
                        <FileText className="h-3 w-3" />
                        <span>Template</span>
                      </TabsTrigger>
                      <TabsTrigger value="advanced" className="flex items-center gap-1 py-1">
                        <Clock className="h-3 w-3" />
                        <span>Advanced</span>
                      </TabsTrigger>
                    </TabsList>

                    <DialogBody>
                      <TabsContent value="basic" className="space-y-3 mt-2">
                        <div className="space-y-4">
                          <div className="grid gap-2">
                            <Label htmlFor="request-prompt">User Prompt (Request)</Label>
                            <MarkdownTextArea
                              initialValue={tempRequestPrompt}
                              onChange={(value) => setTempRequestPrompt(value)}
                              editable={true}
                              placeholder={defaultRequestPrompt}
                              suggestions={ExpressionSuggestionList}
                              className="min-h-[100px] max-h-[25vh]"
                            />
                            <p className="text-xs italic text-muted-foreground">
                              Available placeholders: {"{{"}character.name{"}}"}, {"{{"}character.personality{"}}"}, {"{{"}expression.list{"}}"}, {"{{"}expression.last{"}}"}, {"{{"}chat.message{"}}"}
                            </p>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="template" className="space-y-3 mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="templateId">Chat Template</Label>
                            <WidgetConfig currentChatTemplateID={tempChatTemplateId || null} onChatTemplateChange={(chatTemplateId) => setTempChatTemplateId(chatTemplateId)} />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="systemPrompt">System Prompt Override</Label>
                              <span className="text-xs text-muted-foreground">{estimateTokens(tempSystemPrompt || "", 0)} tokens</span>
                            </div>
                            <MarkdownTextArea
                              key={tempSystemPrompt ? `systemPrompt-${tempSystemPrompt}` : "new-systemPrompt"}
                              initialValue={tempSystemPrompt || ""}
                              editable={true}
                              className="min-h-[100px]"
                              suggestions={ExpressionSuggestionList}
                              onChange={(value) => setTempSystemPrompt(value)}
                              placeholder="Leave empty to use the default system prompt from the selected template"
                            />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="advanced" className="space-y-3 mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="throttle-interval">Auto Refresh Interval (ms)</Label>
                            <Input
                              id="throttle-interval"
                              type="number"
                              min="1000"
                              max="60000"
                              step="1000"
                              value={tempThrottleInterval}
                              onChange={(e) => setTempThrottleInterval(Number(e.target.value))}
                              className="h-8"
                            />
                            <p className="text-xs text-muted-foreground">How often auto mode will update expressions during streaming. Default: 8000ms (8 seconds)</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="disable-logs">Disable Logs</Label>
                            <div className="flex items-center space-x-2 h-8">
                              <Switch id="disable-logs" checked={tempDisableLogs} onCheckedChange={setTempDisableLogs} />
                            </div>
                            <p className="text-xs text-muted-foreground">Disable logging for background inference operations</p>
                          </div>
                        </div>
                      </TabsContent>
                    </DialogBody>
                  </Tabs>

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
        </div>
      </div>
    </div>
  );
};

export default WidgetExpressions;
