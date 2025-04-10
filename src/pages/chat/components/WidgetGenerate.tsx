import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/ProfileContext";
import { useChatActions, useCurrentChatMessages, useCurrentChatParticipants } from "@/hooks/chatStore";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { GenerationOptions, StreamingState } from "@/services/inference-service";
import { useLocalGenerationInputHistory } from "@/utils/local-storage";
import { MDXEditorMethods } from "@mdxeditor/editor";
import { StopCircle } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QuickActions, { QuickAction } from "./utils-generate/QuickActions";

interface WidgetGenerateProps {
  onSubmit?: (text: string) => void;
}

const WidgetGenerate: React.FC<WidgetGenerateProps> = () => {
  const inferenceService = useInferenceServiceFromContext();
  // const { generateQuietly } = useBackgroundInference();
  const [text, setText] = React.useState("");
  const [generationInputHistory, setGenerationInputHistory] = useLocalGenerationInputHistory();
  // const [autoTranslate, setAutoTranslate] = React.useState(false);
  const [streamingCharacters, setStreamingCharacters] = useState<Record<string, boolean>>({});
  const streamingCheckRef = useRef<number | null>(null);
  const quietResponseRef = useRef<boolean>(false);
  const [inputStreamingText, setInputStreamingText] = useState<string>("");
  const textAreaRef = useRef<MDXEditorMethods>(null);
  // Track history navigation

  const profile = useProfile();
  const sendCommand = profile.currentProfile?.settings.chat.sendShortcut;
  const participants = useCurrentChatParticipants();
  const chatMessages = useCurrentChatMessages();

  const { addChatMessage } = useChatActions();

  // Get enabled participants for message generation
  const enabledParticipants = participants?.filter((p) => p.enabled) || [];

  // Generate a unique key based on participants to force editor re-initialization
  const editorKey = participants ? `editor-${participants.length}-${enabledParticipants.length}` : "editor-default";

  // Listen for streaming updates when we're in quiet response mode
  const handleStreamingStateChange = useCallback((state: StreamingState | null) => {
    if (state && state.messageId === "generate-input-area") {
      quietResponseRef.current = true;
      setInputStreamingText(state.accumulatedText);
    } else if (quietResponseRef.current && !state) {
      // Reset when streaming ends
      quietResponseRef.current = false;
    }
  }, []);

  // Effect to apply streaming text to the input when in quiet response mode
  useEffect(() => {
    if (quietResponseRef.current && inputStreamingText) {
      setText(inputStreamingText);
    }
  }, [inputStreamingText, quietResponseRef.current]);

  /**
   * Focus the editor when the Tab key is pressed
   */
  useEffect(() => {
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();

        // Find the CodeMirror editor inside the markdown textarea
        const editorElement = document.querySelector(".rich-text-area .cm-editor");
        if (editorElement) {
          // Focus the editor
          (editorElement as HTMLElement).focus();

          // Try to place cursor at end if possible
          const textArea = editorElement.querySelector(".cm-content");
          if (textArea) {
            const range = document.createRange();
            const sel = window.getSelection();

            // Try to position at the end
            if (textArea.lastChild) {
              range.setStartAfter(textArea.lastChild);
              range.collapse(true);

              if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleTabKey);
    return () => {
      window.removeEventListener("keydown", handleTabKey);
    };
  }, []);

  const handleSubmit = useCallback(
    async (submittedText: string) => {
      if (!submittedText.trim()) {
        return;
      }

      // Add to history if not a duplicate of the most recent entry
      if (!generationInputHistory.length || generationInputHistory[generationInputHistory.length - 1] !== submittedText) {
        // Add to history, limiting entries to X
        const newHistory = [...generationInputHistory, submittedText.trim()].slice(-25);
        setGenerationInputHistory(newHistory);
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
          userMessage: submittedText.trim(),
          stream: true,
          onStreamingStateChange: (state) => {
            // Handle streaming state changes for both regular and quiet responses
            handleStreamingStateChange(state);

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

        // Clear the input text if not in quiet mode
        if (!quietResponseRef.current) {
          setText("");
        }
      } catch (error) {
        toast.error(`${error}`);
        setStreamingCharacters((prev) => {
          const newState = { ...prev };
          if (nextCharacter?.id) {
            delete newState[nextCharacter.id];
          }
          return newState;
        });
      }
    },
    [enabledParticipants, inferenceService, handleStreamingStateChange, generationInputHistory],
  );

  // Function to check if any character is currently streaming
  const isAnyCharacterStreaming = useCallback(() => {
    return Object.keys(streamingCharacters).length > 0;
  }, [streamingCharacters]);

  // Handle cancellation of ongoing generation
  const handleCancel = useCallback(async () => {
    try {
      const success = await inferenceService.cancelGeneration();
      if (success) {
        // Reset streaming characters state
        setStreamingCharacters({});
        if (quietResponseRef.current) {
          quietResponseRef.current = false;
        }
        toast.success("Generation cancelled");
      } else {
        toast.error("Failed to cancel generation");
      }
    } catch (error) {
      console.error("Error cancelling generation:", error);
      toast.error("Error cancelling generation");
    }
  }, [inferenceService]);

  // Sync streaming state with the inference service
  const syncStreamingState = useCallback(() => {
    const streamingState = inferenceService.getStreamingState();

    // Check for quiet response mode
    if (streamingState.messageId === "generate-input-area") {
      quietResponseRef.current = true;
      setInputStreamingText(streamingState.accumulatedText);
    }

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

      // Also reset quiet response mode if needed
      if (quietResponseRef.current) {
        quietResponseRef.current = false;
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

  const executeQuickAction = async (action: QuickAction) => {
    const nextCharacter = enabledParticipants[0];

    // Determine if the response should be quiet
    const quietResponse = action.streamOption === "textarea";

    const generationConfig: GenerationOptions = {
      chatTemplateID: action.chatTemplateId,
      characterId: nextCharacter.id,
      systemPromptOverride: action.systemPromptOverride,
      userMessage: action.userPrompt,
      stream: true,
      quietResponse,
      quietUserMessage: true,
      extraSuggestions: {
        input: structuredClone(text),
      },
      onStreamingStateChange: (state) => {
        // Handle streaming state changes for both regular and quiet responses
        handleStreamingStateChange(state);

        if (state?.characterId) {
          setStreamingCharacters((prev) => ({ ...prev, [state.characterId as string]: true }));
        }
      },
    };

    if (action.streamOption === "participantMessage") {
      const participantMessageType = action.participantMessageType;

      if (participantMessageType === "swap") {
        // Swap the last message with the new user message
        const lastMessage = chatMessages?.[chatMessages.length - 1];
        if (lastMessage && lastMessage.type === "character") {
          generationConfig.characterId = lastMessage.character_id!;
          generationConfig.existingMessageId = lastMessage.id;
          generationConfig.extraSuggestions!.last_message = lastMessage.messages[lastMessage.message_index];
        }
      }
    }

    if (action.streamOption === "userMessage") {
      const lastMessage = chatMessages?.[chatMessages.length - 1];
      if (lastMessage && lastMessage.type === "user") {
        generationConfig.existingMessageId = lastMessage.id;
        generationConfig.extraSuggestions!.last_message = lastMessage.messages[lastMessage.message_index];
      } else {
        const { id: newChatID } = await addChatMessage({
          character_id: null,
          messages: ["..."],
          type: "user",
        });
        generationConfig.existingMessageId = newChatID;
      }
    }

    try {
      setText("");
      await inferenceService.generateMessage(generationConfig);
    } catch (error) {
      console.error("Error generating message:", error);
      toast.error("Error generating message");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none flex items-center gap-2 p-0.5 justify-between">
        <div className="flex items-center gap-2">
          <QuickActions handleExecuteAction={executeQuickAction} />
          {/* <Toggle tabIndex={-1} pressed={autoTranslate} onPressedChange={setAutoTranslate} title="Auto Translate" size="xs">
            <Languages className="!w-3.5 !h-3.5" />
          </Toggle> */}
        </div>
        {isAnyCharacterStreaming() && (
          <Button variant="destructive" size="xs" onClick={handleCancel} title="Cancel Generation" className="ml-auto">
            <StopCircle className="!w-3.5 !h-3.5 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      <MarkdownTextArea
        key={editorKey}
        initialValue={text}
        onChange={(e) => setText(e)}
        editable={!isAnyCharacterStreaming() || quietResponseRef.current} // Allow editing during quiet response
        placeholder={`Type your message here... (${sendCommand || "Ctrl+Enter"} to send)`}
        sendShortcut={sendCommand}
        onSubmit={handleSubmit}
        enableHistory={true}
        ref={textAreaRef}
      />
    </div>
  );
};

export default WidgetGenerate;
