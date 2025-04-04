import { Button } from "@/components/ui/button";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { Toggle } from "@/components/ui/toggle";
import { useProfile } from "@/hooks/ProfileContext";
import { useCurrentChatParticipants } from "@/hooks/chatStore";
import { cn } from "@/lib/utils";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { Languages, SpellCheck2, Wand2 } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface WidgetGenerateProps {
  onSubmit?: (text: string) => void;
}

const WidgetGenerate: React.FC<WidgetGenerateProps> = () => {
  const inferenceService = useInferenceServiceFromContext();
  const [text, setText] = React.useState("");
  const [autoTranslate, setAutoTranslate] = React.useState(false);
  const [streamingCharacters, setStreamingCharacters] = useState<Record<string, boolean>>({});
  const streamingCheckRef = useRef<number | null>(null);

  const profile = useProfile();
  const sendCommand = profile.currentProfile?.settings.chat.sendShortcut;
  const participants = useCurrentChatParticipants();

  // Get enabled participants for message generation
  const enabledParticipants = participants?.filter((p) => p.enabled) || [];

  // Generate a unique key based on participants to force editor re-initialization
  const editorKey = participants ? `editor-${participants.length}-${enabledParticipants.length}` : "editor-default";

  const handleSubmit = useCallback(
    async (submittedText: string) => {
      if (!submittedText.trim()) {
        return;
      }
      // Get the next enabled character to respond
      const nextCharacter = enabledParticipants[0];
      if (!nextCharacter) {
        toast.error("No enabled characters found");
        return;
      }

      // Set loading state for this character
      setStreamingCharacters((prev) => ({ ...prev, [nextCharacter?.id ?? "unknown"]: true }));

      try {
        // Use the inference service to generate a message
        await inferenceService.generateMessage({
          characterId: nextCharacter?.id ?? "",
          userMessage: submittedText,
          stream: true,
          onStreamingStateChange: (state) => {
            if (state?.characterId) {
              setStreamingCharacters((prev) => ({
                ...prev,
                [state.characterId as string]: true,
              }));
            } else {
              // When state is null, streaming has completed or errored
              setStreamingCharacters((prev) => {
                const newState = { ...prev };
                // Clear all streaming characters since we don't track by message ID here
                if (nextCharacter?.id) {
                  delete newState[nextCharacter.id];
                }
                return newState;
              });
            }
          },
        });

        // Clear the input text
        setText("");
      } catch (error) {
        console.error("Error generating message:", error);
        setStreamingCharacters((prev) => {
          const newState = { ...prev };
          if (nextCharacter?.id) {
            delete newState[nextCharacter.id];
          }
          return newState;
        });
      }
    },
    [enabledParticipants, inferenceService],
  );

  // Function to check if any character is currently streaming
  const isAnyCharacterStreaming = useCallback(() => {
    return Object.keys(streamingCharacters).length > 0;
  }, [streamingCharacters]);

  // Sync streaming state with the inference service
  const syncStreamingState = useCallback(() => {
    const streamingState = inferenceService.getStreamingState();

    if (streamingState.characterId) {
      setStreamingCharacters((prev) => {
        // If already tracked, no need to update
        if (prev[streamingState.characterId as string]) {
          return prev;
        }

        // Add the new streaming character
        return {
          ...prev,
          [streamingState.characterId as string]: true,
        };
      });
    } else {
      // If no character is currently streaming according to the service,
      // but we have tracked streaming characters, clear them
      if (Object.keys(streamingCharacters).length > 0) {
        setStreamingCharacters({});
      }
    }
  }, [inferenceService, streamingCharacters]);

  // This effect needs to run whenever participants change
  useEffect(() => {
    syncStreamingState();

    // Set up interval to periodically check streaming state
    if (streamingCheckRef.current) {
      window.clearInterval(streamingCheckRef.current);
    }

    streamingCheckRef.current = window.setInterval(() => {
      syncStreamingState();
    }, 500);

    return () => {
      if (streamingCheckRef.current) {
        window.clearInterval(streamingCheckRef.current);
        streamingCheckRef.current = null;
      }
    };
  }, [syncStreamingState, participants]);

  useEffect(() => {
    if (text.length > 0) {
      setText(text);
    }
  }, [text]);

  const handleImpersonate = useCallback(() => {
    const prefix = "/impersonate ";
    setText((prev) => (prev.startsWith(prefix) ? prev : `${prefix}${prev}`));
  }, []);

  const handleSpellCheck = useCallback(() => {}, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none flex items-center gap-2 p-0.5">
        <Button variant="ghost" size="xs" onClick={handleImpersonate} title="Impersonate">
          <Wand2 className="!w-3.5 !h-3.5" />
        </Button>
        <Button variant="ghost" size="xs" onClick={handleSpellCheck} title="Spell Check">
          <SpellCheck2 className="!w-3.5 !h-3.5" />
        </Button>
        <Toggle pressed={autoTranslate} onPressedChange={setAutoTranslate} title="Auto Translate" size="xs">
          <Languages className="!w-3.5 !h-3.5" />
        </Toggle>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden border border-input rounded-md">
        <TipTapTextArea
          key={editorKey}
          initialValue={text}
          onChange={(e) => setText(e)}
          editable={!isAnyCharacterStreaming()} // Disable input while inference is running
          className={cn("h-full max-h-full", "rounded-md duration-0")}
          placeholder={`Type your message here... (${sendCommand || "Ctrl+Enter"} to send)`}
          sendShortcut={sendCommand}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};

export default WidgetGenerate;
