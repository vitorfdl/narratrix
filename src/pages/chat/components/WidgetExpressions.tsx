import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuClock,
  LuFileText,
  LuImage,
  LuLayoutGrid,
  LuLoaderCircle,
  LuMessageCircle,
  LuPause,
  LuPlay,
  LuRefreshCw,
  LuRows3,
  LuSettings,
  LuSmile,
  LuStretchHorizontal,
  LuUser,
  LuUsers,
  LuWifiOff,
} from "react-icons/lu";
import { useThrottledCallback } from "use-debounce";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCharacterAvatars, useCharacters } from "@/hooks/characterStore";
import { useCurrentChatMessages, useCurrentChatParticipants } from "@/hooks/chatStore";
import { useExpressionStore } from "@/hooks/expressionStore";
import { useChatInferenceState } from "@/hooks/useChatInference";
import { useMultipleImageUrls } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { useGridCardDecorated } from "@/pages/chat/components/GridCard";
import WidgetConfig from "@/pages/chat/components/WidgetConfig";
import { Character, EXPRESSION_LIST } from "@/schema/characters-schema";
import { basicPromptSuggestionList, ChatMessage } from "@/schema/chat-message-schema";
import { useBackgroundInference } from "@/services/background-inference-service";
import { estimateTokens } from "@/services/inference/formatter/apply-context-limit";
import { findClosestExpressionMatch } from "@/utils/fuzzy-search";
import { useLocalExpressionGenerationSettings } from "@/utils/local-storage";

type ExpressionImageFit = "cover" | "contain" | "fill" | "scale-down" | "none";
type ExpressionLayoutMode = "horizontal" | "grid" | "vertical";
type ExpressionMultiGenerationMode = "latest-message" | "own-last-message";

const EXPRESSION_LAYOUT_OPTIONS: { value: ExpressionLayoutMode; label: string; icon: typeof LuUsers }[] = [
  { value: "horizontal", label: "Horizontal (side-by-side)", icon: LuStretchHorizontal },
  { value: "grid", label: "Grid", icon: LuLayoutGrid },
  { value: "vertical", label: "Vertical (stacked)", icon: LuRows3 },
];

const EXPRESSION_MULTI_GENERATION_OPTIONS: { value: ExpressionMultiGenerationMode; label: string; helper: string }[] = [
  {
    value: "latest-message",
    label: "React to latest message",
    helper: "Every character reacts to the same latest message (or your selected text).",
  },
  {
    value: "own-last-message",
    label: "Each character's own last line",
    helper: "Each character's expression reflects their own most recent message in the chat.",
  },
];

const EXPRESSION_IMAGE_FIT_OPTIONS: { value: ExpressionImageFit; label: string; helper: string }[] = [
  {
    value: "cover",
    label: "Cover (Default)",
    helper: "Fill the frame while preserving aspect ratio; may crop edges.",
  },
  {
    value: "contain",
    label: "Contain",
    helper: "Show the whole image inside the frame; may add letterboxing.",
  },
  {
    value: "fill",
    label: "Fill",
    helper: "Stretch the image to fill the frame; can distort aspect ratio.",
  },
  {
    value: "scale-down",
    label: "Scale Down",
    helper: "Keep the image at natural size unless it exceeds the frame.",
  },
  {
    value: "none",
    label: "None",
    helper: "Do not scale the image; overflow may be clipped.",
  },
];

export type ExpressionGenerateSettings = {
  chatTemplateId: string;
  autoRefresh: boolean;
  autoRunAfterComplete: boolean;
  requestPrompt: string;
  systemPrompt: string;
  throttleInterval: number; // Auto mode update frequency in milliseconds
  disableLogs: boolean;
  imageObjectFit: ExpressionImageFit;
  showAllCharacters: boolean;
  multiLayout: ExpressionLayoutMode;
  multiGenerationMode: ExpressionMultiGenerationMode;
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

const formatExpressionLabel = (expression?: string | null): string => {
  if (!expression) {
    return "Neutral";
  }
  return expression.charAt(0).toUpperCase() + expression.slice(1);
};

// A character qualifies for the expression widget only if it has at least one expression image.
const hasExpressionImages = (character: Character): boolean => Boolean(character.expressions?.some((expression) => expression.image_path));

const WidgetExpressions = () => {
  const isDecorated = useGridCardDecorated();
  const { generateQuietly } = useBackgroundInference();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // State for dialog visibility
  const [activeTab, setActiveTab] = useState("basic"); // State for active tab
  const [tempRequestPrompt, setTempRequestPrompt] = useState(""); // Temp state for dialog
  const [tempSystemPrompt, setTempSystemPrompt] = useState(""); // Temp state for dialog
  const [tempChatTemplateId, setTempChatTemplateId] = useState(""); // Temp state for chat template
  const [tempThrottleInterval, setTempThrottleInterval] = useState(8000); // Temp state for throttle interval
  const [tempDisableLogs, setTempDisableLogs] = useState(false);
  const [tempAutoRunAfterComplete, setTempAutoRunAfterComplete] = useState(false);
  const [tempImageObjectFit, setTempImageObjectFit] = useState<ExpressionImageFit>("cover");
  const [tempShowAllCharacters, setTempShowAllCharacters] = useState(false);
  const [tempMultiLayout, setTempMultiLayout] = useState<ExpressionLayoutMode>("horizontal");
  const [tempMultiGenerationMode, setTempMultiGenerationMode] = useState<ExpressionMultiGenerationMode>("latest-message");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingCharacterIds, setGeneratingCharacterIds] = useState<Set<string>>(() => new Set());

  // Use the hook for settings
  const [expressionSettings, setExpressionSettings] = useLocalExpressionGenerationSettings();

  const autoRefreshEnabled = expressionSettings.autoRefresh;
  const { isStreaming: isChatStreaming } = useChatInferenceState();
  const wasStreamingRef = useRef(false);

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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const characterExpressionsRef = useRef<Record<string, string>>({});
  const lastMessageContentRef = useRef<string>(""); // Ref for latest message content
  const lastSpeakerIdRef = useRef<string | undefined>(undefined); // Ref for latest speaker ID
  const lastMessageRef = useRef<ChatMessage | null>(null); // Ref for latest message object
  const messagesRef = useRef<ChatMessage[]>([]); // Ref for full message list (per-character lookup)

  useEffect(() => {
    characterExpressionsRef.current = characterExpressions;
  }, [characterExpressions]);

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

  useEffect(() => {
    messagesRef.current = messages ?? [];
  }, [messages]);

  // Most recent message content authored by a specific character (for "own last line" mode)
  const getLastMessageContentForCharacter = useCallback((characterId: string): string => {
    const list = messagesRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const message = list[i];
      if (message.character_id === characterId) {
        return message.messages?.[message.message_index] || message.messages?.[0] || "";
      }
    }
    return "";
  }, []);

  // Effect to populate temp state when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      setTempRequestPrompt(expressionSettings.requestPrompt);
      setTempSystemPrompt(expressionSettings.systemPrompt);
      setTempChatTemplateId(expressionSettings.chatTemplateId || "");
      setTempThrottleInterval(expressionSettings.throttleInterval || 8000);
      setTempDisableLogs(expressionSettings.disableLogs || false);
      setTempAutoRunAfterComplete(expressionSettings.autoRunAfterComplete || false);
      setTempImageObjectFit(expressionSettings.imageObjectFit ?? "cover");
      setTempShowAllCharacters(expressionSettings.showAllCharacters ?? false);
      setTempMultiLayout(expressionSettings.multiLayout ?? "horizontal");
      setTempMultiGenerationMode(expressionSettings.multiGenerationMode ?? "latest-message");
      setActiveTab("basic");
    }
  }, [
    isSettingsOpen,
    expressionSettings.requestPrompt,
    expressionSettings.systemPrompt,
    expressionSettings.chatTemplateId,
    expressionSettings.throttleInterval,
    expressionSettings.disableLogs,
    expressionSettings.autoRunAfterComplete,
    expressionSettings.imageObjectFit,
    expressionSettings.showAllCharacters,
    expressionSettings.multiLayout,
    expressionSettings.multiGenerationMode,
  ]);

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

  // Run a single inference for one character against a given message and store the resolved expression
  const runCharacterExpression = useCallback(
    async (character: Character, messageContent: string, chapterId?: string): Promise<void> => {
      const availableExpressions = character.expressions?.length ? character.expressions.filter((exp) => exp.image_path).map((exp) => exp.name) : EXPRESSION_LIST;
      const availableExpressionNames = character.expressions?.length ? character.expressions.map((exp) => exp.name) : EXPRESSION_LIST;

      const expressionResult = await generateQuietly({
        chatTemplateId: expressionSettings.chatTemplateId,
        context: {
          characterID: character.id,
          chapterID: chapterId,
          extra: {
            "expression.list": availableExpressions.join(", "),
            "expression.last": characterExpressionsRef.current[character.id] || "neutral",
            "chat.message": messageContent,
          },
        },
        prompt: expressionSettings.requestPrompt || defaultRequestPrompt,
        systemPrompt: expressionSettings.systemPrompt || defaultSystemPrompt,
        disableLogs: expressionSettings.disableLogs || false,
      });

      const rawExpression = expressionResult?.trim().split("\n")[0].split(" ")[0].toLowerCase() || "";
      const finalExpression = findClosestExpressionMatch(rawExpression, availableExpressionNames, "neutral");

      setCharacterExpressions((prev) => ({
        ...prev,
        [character.id]: finalExpression,
      }));
    },
    [generateQuietly, expressionSettings.chatTemplateId, expressionSettings.requestPrompt, expressionSettings.systemPrompt, expressionSettings.disableLogs],
  );

  // Single-character generation: only the current speaker (or selected text's author)
  const generateSingleExpression = useCallback(
    async (userPickedText?: string) => {
      const currentSpeakerId = userPickedText ? selectedMessageCharacterId : lastSpeakerIdRef.current;
      const currentLastMessage = lastMessageRef.current;

      if (!currentSpeakerId || !expressionSettings.chatTemplateId) {
        if (selectedText) {
          clearSelection();
        }
        return;
      }

      const messageContentToUse = userPickedText || currentLastMessage?.messages?.[0] || "";

      if (!messageContentToUse || messageContentToUse.trim() === "...") {
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

      setIsGenerating(true);
      try {
        await runCharacterExpression(targetCharacter, messageContentToUse, currentLastMessage?.chapter_id);
        setConnectionError(null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        setConnectionError(`Expression generation failed for ${targetCharacter.name}: ${errorMessage}`);
        console.error(`Error generating expression for ${targetCharacter.name}:`, error);
        setCharacterExpressions((prev) => ({
          ...prev,
          [currentSpeakerId]: "neutral",
        }));
        if (selectedText) {
          clearSelection();
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [activeCharacters, runCharacterExpression, expressionSettings.chatTemplateId, selectedText, selectedMessageCharacterId, clearSelection],
  );

  // Multi-character generation: every active participant that owns an expression list, run in parallel.
  // The model's concurrency queue (max_concurrency) serializes these automatically.
  const generateAllExpressions = useCallback(
    async (userPickedText?: string) => {
      if (!expressionSettings.chatTemplateId) {
        if (selectedText) {
          clearSelection();
        }
        return;
      }

      const triggerText = userPickedText || lastMessageContentRef.current || "";
      const chapterId = lastMessageRef.current?.chapter_id;
      const candidates = (activeCharacters ?? []).filter(hasExpressionImages);

      if (!candidates.length) {
        if (selectedText) {
          clearSelection();
        }
        return;
      }

      setIsGenerating(true);
      try {
        const results = await Promise.all(
          candidates.map(async (character) => {
            const messageContent = expressionSettings.multiGenerationMode === "own-last-message" ? getLastMessageContentForCharacter(character.id) : triggerText;

            if (!messageContent || messageContent.trim() === "...") {
              return { ok: true as const, name: character.name };
            }

            setGeneratingCharacterIds((prev) => {
              const next = new Set(prev);
              next.add(character.id);
              return next;
            });

            try {
              await runCharacterExpression(character, messageContent, chapterId);
              return { ok: true as const, name: character.name };
            } catch (error) {
              console.error(`Error generating expression for ${character.name}:`, error);
              return { ok: false as const, name: character.name };
            } finally {
              setGeneratingCharacterIds((prev) => {
                const next = new Set(prev);
                next.delete(character.id);
                return next;
              });
            }
          }),
        );

        const failures = results.filter((result) => !result.ok);
        if (failures.length) {
          setConnectionError(`Expression generation failed for ${failures.map((failure) => failure.name).join(", ")}`);
        } else {
          setConnectionError(null);
        }
      } finally {
        setIsGenerating(false);
        if (selectedText) {
          clearSelection();
        }
      }
    },
    [activeCharacters, runCharacterExpression, getLastMessageContentForCharacter, expressionSettings.chatTemplateId, expressionSettings.multiGenerationMode, selectedText, clearSelection],
  );

  // Route to single- or multi-character generation based on the current setting
  const generateExpression = useCallback(
    (userPickedText?: string) => {
      if (expressionSettings.showAllCharacters) {
        return generateAllExpressions(userPickedText);
      }
      return generateSingleExpression(userPickedText);
    },
    [expressionSettings.showAllCharacters, generateAllExpressions, generateSingleExpression],
  );

  // Create a throttled version for updates during streaming - Call useThrottledCallback directly
  const throttleIntervalMs = useMemo(() => {
    const rawInterval = Number(expressionSettings.throttleInterval);
    if (!Number.isFinite(rawInterval) || rawInterval <= 0) {
      return 8000;
    }
    return Math.max(rawInterval, 1000);
  }, [expressionSettings.throttleInterval]);

  const throttledGenerateExpression = useThrottledCallback(generateExpression, throttleIntervalMs, { leading: true, trailing: false });

  useEffect(() => {
    if (!autoRefreshEnabled) {
      throttledGenerateExpression.cancel();
    }
  }, [autoRefreshEnabled, throttledGenerateExpression]);

  useEffect(() => {
    return () => {
      throttledGenerateExpression.cancel();
    };
  }, [throttledGenerateExpression]);

  // Manual text selection always bypasses throttle -- it's a deliberate user action
  useEffect(() => {
    if (autoRefreshEnabled && expressionSettings.chatTemplateId && selectedText && selectedMessageCharacterId) {
      generateExpression(selectedText);
    }
  }, [autoRefreshEnabled, expressionSettings.chatTemplateId, selectedText, selectedMessageCharacterId, generateExpression]);

  // Throttled auto-refresh during streaming (skipped when "run after complete" is on)
  useEffect(() => {
    if (autoRefreshEnabled && expressionSettings.chatTemplateId && !expressionSettings.autoRunAfterComplete) {
      if (lastSpeakerId && lastMessageContent && lastMessageContent.trim() !== "...") {
        throttledGenerateExpression();
      }
    }
  }, [lastMessageContent, lastSpeakerId, autoRefreshEnabled, expressionSettings.chatTemplateId, expressionSettings.autoRunAfterComplete, throttledGenerateExpression]);

  // Fire once when streaming finishes (only when "run after complete" is on)
  useEffect(() => {
    if (wasStreamingRef.current && !isChatStreaming) {
      if (autoRefreshEnabled && expressionSettings.chatTemplateId && expressionSettings.autoRunAfterComplete) {
        generateExpression();
      }
    }
    wasStreamingRef.current = isChatStreaming;
  }, [isChatStreaming, autoRefreshEnabled, expressionSettings.chatTemplateId, expressionSettings.autoRunAfterComplete, generateExpression]);

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
      autoRunAfterComplete: tempAutoRunAfterComplete,
      imageObjectFit: tempImageObjectFit,
      showAllCharacters: tempShowAllCharacters,
      multiLayout: tempMultiLayout,
      multiGenerationMode: tempMultiGenerationMode,
    }));
    setIsSettingsOpen(false);
  }, [
    setExpressionSettings,
    tempRequestPrompt,
    tempSystemPrompt,
    tempChatTemplateId,
    tempThrottleInterval,
    tempDisableLogs,
    tempAutoRunAfterComplete,
    tempImageObjectFit,
    tempShowAllCharacters,
    tempMultiLayout,
    tempMultiGenerationMode,
  ]);

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

  const displayExpression = useMemo(() => {
    if (!displayCharacter) {
      return null;
    }
    return getCharacterExpression(displayCharacter.id);
  }, [displayCharacter, getCharacterExpression]);

  const displayImageSrc = useMemo(() => {
    if (!displayCharacter) {
      return undefined;
    }
    return expressionUrlMap[displayCharacter.id] || avatarUrlMap[displayCharacter.id] || undefined;
  }, [displayCharacter, expressionUrlMap, avatarUrlMap]);

  const imageObjectFit = expressionSettings.imageObjectFit ?? "cover";
  const imageObjectFitClass = useMemo(() => {
    switch (imageObjectFit) {
      case "contain":
        return "object-contain";
      case "fill":
        return "object-fill";
      case "scale-down":
        return "object-scale-down";
      case "none":
        return "object-none";
      case "cover":
      default:
        return "object-cover";
    }
  }, [imageObjectFit]);

  // Characters shown in multi-character mode: active participants that own at least one expression image
  const multiDisplayCharacters = useMemo(() => {
    return (activeCharacters ?? []).filter(hasExpressionImages);
  }, [activeCharacters]);

  const isMultiView = expressionSettings.showAllCharacters && multiDisplayCharacters.length > 0;

  const multiLayout = expressionSettings.multiLayout ?? "horizontal";
  const { multiContainerClass, multiCellClass } = useMemo(() => {
    switch (multiLayout) {
      case "vertical":
        return { multiContainerClass: "flex flex-col items-center gap-2 overflow-y-auto", multiCellClass: "w-full max-w-[55%] aspect-square shrink-0" };
      case "grid":
        return { multiContainerClass: "grid gap-2 overflow-y-auto content-start", multiCellClass: "aspect-square" };
      default:
        return { multiContainerClass: "flex flex-row items-stretch justify-center gap-2 overflow-x-auto", multiCellClass: "h-full flex-1 min-w-[100px]" };
    }
  }, [multiLayout]);

  const multiContainerStyle = multiLayout === "grid" ? { gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" } : undefined;

  const selectedImageFitDescription = useMemo(() => {
    const match = EXPRESSION_IMAGE_FIT_OPTIONS.find((option) => option.value === tempImageObjectFit);
    return match?.helper ?? "";
  }, [tempImageObjectFit]);

  const selectedMultiGenerationDescription = useMemo(() => {
    const match = EXPRESSION_MULTI_GENERATION_OPTIONS.find((option) => option.value === tempMultiGenerationMode);
    return match?.helper ?? "";
  }, [tempMultiGenerationMode]);

  const expressionSourceLabel = useMemo(() => {
    if (!displayCharacter) {
      return "Select a character to see their expression details.";
    }
    if (selectedText && displayCharacter.id === selectedMessageCharacterId) {
      return "Expression generated from your selected text.";
    }
    if (displayCharacter.id === lastSpeakerId) {
      return "Expression generated from the latest message.";
    }
    if (characterExpressions[displayCharacter.id]) {
      return "Last known expression for this character.";
    }
    return "Awaiting expression data.";
  }, [displayCharacter, selectedText, selectedMessageCharacterId, lastSpeakerId, characterExpressions]);

  // Fill entire available space - using flex-1 to ensure the component properly fills available space in any container
  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      <div className={cn("flex-1 min-h-0 flex items-center justify-center relative", isDecorated && "bg-background/50 backdrop-blur-sm")}>
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          {activeCharacters && activeCharacters.length > 0 ? (
            isMultiView ? (
              /* Multi-Character View */
              <div className={cn("w-full h-full p-2", multiContainerClass)} style={multiContainerStyle}>
                {multiDisplayCharacters.map((character) => {
                  const src = expressionUrlMap[character.id] || avatarUrlMap[character.id] || undefined;
                  const isCharGenerating = generatingCharacterIds.has(character.id);
                  return (
                    <div key={character.id} className={cn("relative min-h-0", multiCellClass)}>
                      <Avatar className={cn("w-full h-full rounded-md", isDecorated && "shadow-md")} style={{ aspectRatio: "1/1" }}>
                        <AvatarImage key={src} src={src} alt={character.name} className={cn("w-full h-full transition-opacity duration-200 ease-out opacity-100", imageObjectFitClass)} />
                        <AvatarFallback>{src ? <LuLoaderCircle className="w-[40%] h-[40%] animate-spin" /> : <LuUser className="w-[35%] h-[35%] text-primary/20" />}</AvatarFallback>
                      </Avatar>
                      {isCharGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/40">
                          <LuLoaderCircle className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1/2 max-w-[90%] -translate-x-1/2 truncate rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                        {character.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Single Character View */
              <div className="w-full h-full flex flex-col items-center justify-center min-h-0">
                {displayCharacter && (
                  <div className={cn("w-full h-full relative min-h-0")}>
                    <Avatar className={cn("w-full h-full", isDecorated && "shadow-lg")} style={{ aspectRatio: "1/1" }}>
                      <AvatarImage
                        key={displayImageSrc}
                        src={displayImageSrc}
                        alt={displayCharacter.name}
                        className={cn("w-full h-full transition-opacity duration-200 ease-out opacity-100", imageObjectFitClass)}
                      />
                      <AvatarFallback>{displayImageSrc ? <LuLoaderCircle className="w-[50%] h-[50%] animate-spin" /> : <LuUser className="w-[40%] h-[40%] text-primary/20" />}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
              <LuUser className="h-16 w-16 text-primary/20" />
              <p className="text-base font-medium">No Active Characters</p>
              <p className="text-sm">Character expressions will appear here once characters are added to the chat.</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls - shown inline when decorated, otherwise overlaid on hover */}
      <div
        className={cn(
          "flex-shrink-0 px-3 mt-2 mb-1",
          !isDecorated && "absolute bottom-0 left-0 right-0 z-10 mt-0 mb-2 opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
        )}
      >
        <div className="mx-auto w-full">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-2 py-1 shadow-sm">
            <div className="flex items-center gap-2">
              <Button
                variant={isGenerating ? "default" : "ghost"}
                size="xs"
                className="px-1"
                onClick={() => generateExpression()}
                disabled={isGenerating || !expressionSettings.chatTemplateId || (!selectedText && !lastSpeakerId)}
                aria-label={
                  expressionSettings.showAllCharacters ? "Generate expressions for all characters" : selectedText ? "Generate expression from selection" : "Generate expression for current speaker"
                }
                title={expressionSettings.showAllCharacters ? "Generate for all characters" : selectedText ? "Generate from selection" : "Generate for speaker"}
              >
                <LuRefreshCw className={cn("!h-3 !w-3", isGenerating && "animate-spin")} />
                <span className="ml-0.2 hidden sm:inline text-xs">{isGenerating ? "Generating..." : "Generate"}</span>
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
                {autoRefreshEnabled ? <LuPause className="!h-3 !w-3" /> : <LuPlay className="!h-3 !w-3" />}
                <span className="ml-0.2 hidden sm:inline text-xs">Auto</span>
              </Button>
            </div>

            <div className="flex items-center gap-1">
              {connectionError ? (
                <HoverCard openDelay={200} closeDelay={150}>
                  <HoverCardTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="w-auto text-destructive focus-visible:ring-destructive"
                      title="Expression service connection error"
                      aria-label="Expression service connection error"
                    >
                      <LuWifiOff className="h-4 w-4" aria-hidden="true" />
                      <span className="ml-0.2 hidden sm:inline text-xs">Connection</span>
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent align="end" className="w-56 text-sm">
                    {connectionError}
                  </HoverCardContent>
                </HoverCard>
              ) : displayCharacter ? (
                <HoverCard openDelay={200}>
                  <HoverCardTrigger asChild>
                    <Button variant="ghost" size="xs" className="w-auto" title="View current character expression" aria-label="View current character expression">
                      <LuSmile className="h-4 w-4" />
                      <span className="ml-0.2 hidden sm:inline text-xs">Details</span>
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent align="end" className="w-56">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{displayCharacter.name}</p>
                        <p className="text-xs font-medium text-foreground">{formatExpressionLabel(displayExpression)}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">{expressionSourceLabel}</p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <Button variant="ghost" size="xs" className="w-auto" disabled>
                  <LuSmile className="h-4 w-4" />
                  <span className="ml-0.2 hidden sm:inline text-xs">Details</span>
                </Button>
              )}
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="xs" className="w-auto" title="Configure Prompts" aria-label="Open expression settings">
                    <LuSettings />
                    <span className="ml-0.2 hidden sm:inline text-xs">Settings</span>
                  </Button>
                </DialogTrigger>
                <DialogContent size="window" className="max-h-[85vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-1 text-lg">
                      <LuSettings className="h-4 w-4 text-primary" />
                      Configure Expression Settings
                    </DialogTitle>
                    <DialogDescription>Customize the prompts and behavior for character expression generation.</DialogDescription>
                  </DialogHeader>

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid grid-cols-3 mb-3">
                      <TabsTrigger value="basic" className="flex items-center gap-1 py-1">
                        <LuMessageCircle className="h-3 w-3" />
                        <span>General</span>
                      </TabsTrigger>
                      <TabsTrigger value="template" className="flex items-center gap-1 py-1">
                        <LuFileText className="h-3 w-3" />
                        <span>Template</span>
                      </TabsTrigger>
                      <TabsTrigger value="advanced" className="flex items-center gap-1 py-1">
                        <LuClock className="h-3 w-3" />
                        <span>Advanced</span>
                      </TabsTrigger>
                    </TabsList>

                    <DialogBody>
                      <TabsContent value="basic" className="space-y-3 my-2">
                        <div className="space-y-4">
                          <div className="rounded-lg border p-3 space-y-3">
                            <div className="flex flex-row items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Label htmlFor="show-all-characters" className="flex items-center gap-1">
                                  <LuUsers className="h-3 w-3 text-muted-foreground" />
                                  <span>Show All Characters</span>
                                </Label>
                                <HelpTooltip>
                                  Display every active participant's expression at once instead of only the latest speaker. On generation, runs once per participant (respecting the model's parallel
                                  limit) and ignores participants without an expression list. Ideal for visual-novel scenes.
                                </HelpTooltip>
                              </div>
                              <Switch id="show-all-characters" checked={tempShowAllCharacters} onCheckedChange={setTempShowAllCharacters} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="multi-layout">Layout</Label>
                                <Select value={tempMultiLayout} onValueChange={(value) => setTempMultiLayout(value as ExpressionLayoutMode)} disabled={!tempShowAllCharacters}>
                                  <SelectTrigger id="multi-layout">
                                    <SelectValue placeholder="Select layout" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EXPRESSION_LAYOUT_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <span className="flex items-center gap-2">
                                          <option.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                          {option.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <Label htmlFor="multi-generation-mode">Reaction Source</Label>
                                  <HelpTooltip>{selectedMultiGenerationDescription || "Choose what text each character reacts to when showing all characters."}</HelpTooltip>
                                </div>
                                <Select value={tempMultiGenerationMode} onValueChange={(value) => setTempMultiGenerationMode(value as ExpressionMultiGenerationMode)} disabled={!tempShowAllCharacters}>
                                  <SelectTrigger id="multi-generation-mode">
                                    <SelectValue placeholder="Select reaction source" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EXPRESSION_MULTI_GENERATION_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

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

                      <TabsContent value="template" className="space-y-3 my-2">
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

                      <TabsContent value="advanced" className="space-y-3 my-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="throttle-interval">Auto Refresh Interval (ms)</Label>
                              <HelpTooltip>How often auto mode updates expressions during streaming. Default: 8000ms (8 seconds).</HelpTooltip>
                            </div>
                            <Input
                              id="throttle-interval"
                              type="number"
                              min="1000"
                              max="60000"
                              step="1000"
                              value={tempThrottleInterval}
                              onChange={(e) => setTempThrottleInterval(Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="image-object-fit" className="flex items-center gap-1">
                                <LuImage className="h-3 w-3 text-muted-foreground" />
                                <span>Image Fit Mode</span>
                              </Label>
                              <HelpTooltip>{selectedImageFitDescription || "Choose how expression images scale within the avatar frame."}</HelpTooltip>
                            </div>
                            <Select value={tempImageObjectFit} onValueChange={(value) => setTempImageObjectFit(value as ExpressionImageFit)}>
                              <SelectTrigger id="image-object-fit">
                                <SelectValue placeholder="Select image fit" />
                              </SelectTrigger>
                              <SelectContent>
                                {EXPRESSION_IMAGE_FIT_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="disable-logs">Disable Logs</Label>
                              <HelpTooltip>Disable logging for background inference operations.</HelpTooltip>
                            </div>
                            <Switch id="disable-logs" checked={tempDisableLogs} onCheckedChange={setTempDisableLogs} />
                          </div>
                          <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="auto-run-after-complete">Run After Completion</Label>
                              <HelpTooltip>
                                When enabled, auto mode waits for the full response to finish before generating an expression, instead of updating periodically during streaming.
                              </HelpTooltip>
                            </div>
                            <Switch id="auto-run-after-complete" checked={tempAutoRunAfterComplete} onCheckedChange={setTempAutoRunAfterComplete} />
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
