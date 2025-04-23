import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Button } from "@/components/ui/button";
import {
  useChatActions,
  useCurrentChatActiveChapterID,
  useCurrentChatChapters,
  useCurrentChatParticipants,
  useCurrentChatUserCharacterID,
} from "@/hooks/chatStore";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { getCharacterById } from "@/services/character-service";
import { replaceStringPlaceholders } from "@/services/inference-steps/replace-text";
import { LayoutTemplateIcon, PencilLine, SendIcon, UserPlus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

export const NoMessagePlaceholder: React.FC = () => {
  const currentChatChapters = useCurrentChatChapters();
  const activeChapterId = useCurrentChatActiveChapterID();
  const inferenceService = useInferenceServiceFromContext();
  const currentChatParticipants = useCurrentChatParticipants();
  const userCharacterId = useCurrentChatUserCharacterID();
  const { addChatMessage } = useChatActions();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentChapter = currentChatChapters.find((chapter) => chapter.id === activeChapterId);

  // Helper: Preview first 3 lines, ellipsize if longer
  const getPreviewLines = (text: string, maxLines = 2): string => {
    const lines = text.split("\n");
    if (lines.length <= maxLines) {
      return text;
    }
    return `${lines.slice(0, maxLines).join("\n")}...`;
  };

  const startMessageAction = async () => {
    setIsSending(true);
    setError(null);
    try {
      if (currentChapter?.custom?.auto_start_message) {
        // Auto-inference mode: use inferenceService to generate the first message
        if (!currentChapter.start_message) {
          throw new Error("No start message defined for this chapter.");
        }
        if (!currentChatParticipants || currentChatParticipants.length === 0) {
          throw new Error("No chat participants available.");
        }
        // Find the first enabled participant for character_id
        const enabledParticipant = currentChatParticipants.find((p) => p.enabled);
        if (!enabledParticipant) {
          throw new Error("No enabled chat participant found.");
        }

        // Create a system message placeholder for the intro (optional, for UI feedback)
        const systemMessage = await addChatMessage({
          character_id: enabledParticipant.id,
          type: "system",
          messages: ["Generating chapter intro..."],
          extra: { script: "start_chapter" },
        });

        // Start inference to generate the intro message
        await inferenceService.generateMessage({
          existingMessageId: systemMessage.id,
          messageIndex: 0,
          userMessage: currentChapter.start_message,
          characterId: enabledParticipant.id,
          quietUserMessage: true,
          extraSuggestions: {},
        });
      } else {
        const characterID = currentChatParticipants?.find((p) => p.enabled)?.id!;
        const character = await getCharacterById(characterID);
        const userCharacter = await getCharacterById(userCharacterId || "");

        const message = replaceStringPlaceholders(currentChapter!.start_message! || "", {
          character: character || undefined,
          chapter: currentChapter,
          user_character: userCharacter || undefined,
          extra: {},
          censorship: {},
        });

        // Default behavior: just add the system message with the start_message
        await addChatMessage({
          character_id: null,
          type: "system",
          messages: [message],
          extra: { script: "start_chapter" },
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate chapter start message.");
      // Optionally log error
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-sm @container">
      {/* Preview Pane & Actions */}
      {currentChapter?.start_message && (
        <div className="w-full max-w-[90%] xl:max-w-[700px] px-4 flex flex-col items-center mb-6">
          {/* Preview Card */}
          <div className="w-full bg-card border border-border rounded-xl shadow-sm p-4 mb-3 flex flex-col items-start">
            <span className="text-xs font-semibold text-primary/80 mb-1">{currentChapter.title}</span>
            {/* Render the chapter intro preview using MarkdownTextArea in non-editable mode */}
            <MarkdownTextArea
              initialValue={getPreviewLines(currentChapter.start_message)}
              editable={false}
              className=" text-sm leading-relaxed line-clamp-3 w-full"
              label={undefined}
            />
          </div>
          {/* Action Buttons */}
          <div className="flex flex-row gap-3 w-full justify-center">
            <Button
              size="lg"
              className="ring-2 ring-primary/80 text-primary-foreground  font-semibold shadow animate-in"
              disabled={isSending}
              onClick={startMessageAction}
              aria-label="Send Chapter Intro"
            >
              <SendIcon className="w-4 h-4 mr-2" />
              Start Chapter
            </Button>
          </div>
        </div>
      )}
      {/* Error Message */}
      {error && (
        <div className="text-destructive text-center mb-2" role="alert">
          {error}
        </div>
      )}
      {!currentChapter?.start_message && (
        <div className="flex flex-col items-center gap-4 mt-10 w-full max-w-xs">
          {/* Step 1: Create a Chat Template */}
          <div className="flex flex-row items-center gap-2 w-full">
            <LayoutTemplateIcon className="w-4 h-4 text-secondary-foreground" />
            <span className="font-medium">1. Create a Chat Template</span>
          </div>
          <div className="text-xs text-muted-foreground w-full pl-7 -mt-2 mb-2">Pick your model and your format</div>
          {/* Step 2: Add a participant */}
          <div className="flex flex-row items-center gap-2 w-full">
            <UserPlus className="w-4 h-4 text-secondary-foreground" />
            <span className="font-medium">2. Add a participant</span>
          </div>
          {/* Step 3: Write your first message */}
          <div className="flex flex-row items-center gap-2 w-full">
            <PencilLine className="w-4 h-4 text-secondary-foreground" />
            <span className="font-medium">3. Write your first message</span>
          </div>
        </div>
      )}
    </div>
  );
};
