import { Loader2, Send, StopCircle } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MarkdownEditorRef } from "@/components/markdownRender/markdown-editor";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Button } from "@/components/ui/button";
import { useChatActions, useCurrentChatMessages, useCurrentChatParticipants } from "@/hooks/chatStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { cn } from "@/lib/utils";
import type { GenerationOptions, StreamingState } from "@/providers/inferenceChatProvider";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { QuickAction } from "@/schema/profiles-schema";
import { useLocalGenerationInputHistory } from "@/utils/local-storage";
import QuickActions from "./utils-generate/QuickActions";

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
  const quietResponseRef = useRef<boolean>(false);
  const [inputStreamingText, setInputStreamingText] = useState<string>("");
  const rotationAbortRef = useRef<boolean>(false);
  // Track history navigation

  const currentProfile = useCurrentProfile();
  const sendCommand = currentProfile?.settings.chat.sendShortcut;
  const participants = useCurrentChatParticipants();
  const chatMessages = useCurrentChatMessages();

  const { addChatMessage } = useChatActions();

  // Get enabled participants for message generation
  const enabledParticipants = participants?.filter((p) => p.enabled) || [];

  // Generate a unique key based on participants to force editor re-initialization
  const editorKey = participants ? `editor-${participants.length}-${enabledParticipants.length}` : "editor-default";

  // Ref for focusing the MarkdownTextArea
  const markdownRef = useRef<MarkdownEditorRef>(null);

  // Subscribe to streaming state changes
  useEffect(() => {
    const unsubscribe = inferenceService.subscribeToStateChanges((streamingState) => {
      // Check for quiet response mode
      if (streamingState.messageId === "generate-input-area") {
        quietResponseRef.current = true;
        setInputStreamingText(streamingState.accumulatedText);
      } else if (quietResponseRef.current && !streamingState.characterId) {
        // Reset quiet response mode when streaming ends
        quietResponseRef.current = false;
        setInputStreamingText("");
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
        // clear all streaming characters
        setStreamingCharacters({});
      }
    });

    return unsubscribe;
  }, [inferenceService]);

  // Global tab-to-focus handler
  useEffect(() => {
    const handleTabFocus = (e: KeyboardEvent) => {
      // Only trigger if not inside an input/textarea/select/button
      const active = document.activeElement;
      const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || (active as HTMLElement).isContentEditable);

      if (!isInput && e.key === "Tab" && !e.shiftKey) {
        markdownRef.current?.focus();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleTabFocus, true);
    return () => window.removeEventListener("keydown", handleTabFocus, true);
  }, []);

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
  }, [inputStreamingText]);

  const handleSubmit = useCallback(
    async (submittedText: string) => {
      if (!submittedText.trim()) {
        return;
      }

      if (!enabledParticipants.length) {
        toast.error("No enabled characters found");
        return;
      }

      // Promise that resolves when current generation is done (or aborted)
      const waitForGenerationToFinish = (): Promise<void> => {
        return new Promise((resolve) => {
          if (!inferenceService.isStreaming()) {
            resolve();
            return;
          }
          const unsubscribe = inferenceService.subscribeToStateChanges((state) => {
            if (rotationAbortRef.current) {
              unsubscribe();
              resolve();
              return;
            }
            if (!state?.characterId) {
              unsubscribe();
              resolve();
            }
          });
        });
      };

      rotationAbortRef.current = false;

      for (let i = 0; i < enabledParticipants.length; i++) {
        if (rotationAbortRef.current) {
          break;
        }

        const participant = enabledParticipants[i];
        if (!participant?.id) {
          continue;
        }

        setStreamingCharacters((prev) => ({ ...prev, [participant.id]: true }));

        try {
          const isFirst = i === 0;
          const userMsg = isFirst ? structuredClone(submittedText.trim()) : "";

          await inferenceService.generateMessage({
            characterId: participant.id,
            userMessage: userMsg,
            quietUserMessage: !isFirst, // only first attaches user message to chat
            stream: true,
            onStreamingStateChange: (state: StreamingState | null) => {
              handleStreamingStateChange(state);
              if (state?.characterId) {
                setStreamingCharacters((prev) => ({ ...prev, [state.characterId as string]: true }));
              } else {
                setStreamingCharacters((prev) => {
                  const newState = { ...prev };
                  delete newState[participant.id];
                  return newState;
                });
              }
            },
          });

          if (isFirst && !quietResponseRef.current) {
            if (!generationInputHistory.length || generationInputHistory.at(-1) !== submittedText) {
              const newHistory = [...generationInputHistory, submittedText.trim()].slice(-25);
              setGenerationInputHistory(newHistory);
            }
            setText("");
          }

          await waitForGenerationToFinish();

          if (rotationAbortRef.current) {
            break;
          }
        } catch (error) {
          toast.error(`${error}`);
          setStreamingCharacters((prev) => {
            const newState = { ...prev };
            delete newState[participant.id];
            return newState;
          });
          break;
        }
      }
    },
    [enabledParticipants, inferenceService, handleStreamingStateChange, generationInputHistory, setGenerationInputHistory],
  );

  // Function to check if any character is currently streaming
  const isAnyCharacterStreaming = useCallback(() => {
    return Object.keys(streamingCharacters).length > 0;
  }, [streamingCharacters]);

  // Handle cancellation of ongoing generation
  const handleCancel = useCallback(async () => {
    try {
      rotationAbortRef.current = true;
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

  useEffect(() => {
    if (text.length > 0) {
      setText(text);
    }
  }, [text]);

  const executeQuickAction = async (action: QuickAction, participantId?: string) => {
    const nextCharacter = participantId ? enabledParticipants.find((p) => p.id === participantId) : enabledParticipants[0];

    // Determine if the response should be quiet
    const quietResponse = action.streamOption === "textarea";

    const generationConfig: GenerationOptions = {
      chatTemplateID: action.chatTemplateId ?? undefined,
      characterId: nextCharacter?.id ?? participantId ?? "",
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
        // Generate a new variation of the last character message (like swiping right)
        const lastMessage = chatMessages?.[chatMessages.length - 1];
        if (lastMessage && lastMessage.type === "character") {
          generationConfig.characterId = lastMessage.character_id!;
          generationConfig.existingMessageId = lastMessage.id;
          // Calculate the next index to generate a new message variation
          const newIndex = lastMessage.messages.length;
          generationConfig.messageIndex = newIndex;
          generationConfig.extraSuggestions!.last_message = lastMessage.messages[lastMessage.message_index];
        } else if (participantId) {
          // If no previous character message exists but user selected a participant, target that participant
          generationConfig.characterId = participantId;
        }
      }
      if (participantMessageType === "new" && participantId) {
        generationConfig.characterId = participantId;
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
          extra: {},
        });
        generationConfig.existingMessageId = newChatID;
      }
    }

    try {
      if (generationConfig.userMessage && generationInputHistory.at(-1) !== text) {
        const newHistory = [...generationInputHistory, text].slice(-25);
        setGenerationInputHistory(newHistory);
      }
      setText("");
      await inferenceService.generateMessage(generationConfig);
    } catch (error) {
      console.error("Error generating message:", error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred");
    }
  };

  return (
    <div className="flex h-full flex-col relative">
      {!isAnyCharacterStreaming() || quietResponseRef.current ? (
        <MarkdownTextArea
          ref={markdownRef}
          key={editorKey}
          initialValue={text}
          onChange={(e) => setText(e)}
          editable={true}
          // editable={!isAnyCharacterStreaming() || quietResponseRef.current}
          placeholder={`Type your message here... (${sendCommand || "Ctrl+Enter"} to send)`}
          sendShortcut={sendCommand}
          className={cn(
            "flex-1 h-full overflow-none pb-9", // Add bottom padding to prevent overlap with absolute bar
            isAnyCharacterStreaming() && "animate-pulse",
          )}
          onSubmit={handleSubmit}
          enableHistory={true}
        />
      ) : (
        <div className="flex-1 h-full overflow-none pb-9">
          <div className="h-full w-full flex items-center justify-center">
            <Loader2 className="w-4! h-4! animate-spin" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 w-full flex items-center gap-2 p-2 bg-background/95 border-t border-border justify-between z-10">
        <div className="flex items-center gap-2 ring-none">
          <QuickActions handleExecuteAction={executeQuickAction} />
          {/* <Toggle tabIndex={-1} pressed={autoTranslate} onPressedChange={setAutoTranslate} title="Auto Translate" size="xs">
            <Languages className="!w-3.5 !h-3.5" />
          </Toggle> */}
        </div>
        {isAnyCharacterStreaming() ? (
          <Button variant="destructive" size="xs" onClick={handleCancel} title="Cancel Generation" className="ml-auto">
            <StopCircle className="!w-3.5 !h-3.5 mr-1" />
            Cancel
          </Button>
        ) : (
          <Button variant="default" size="xs" onClick={() => handleSubmit(text)} title={`Send Message (${sendCommand || "Ctrl+Enter"})`} className="ml-auto" disabled={!text.trim()}>
            <Send className="!w-3.5 !h-3.5 mr-1" />
            Send
          </Button>
        )}
      </div>
    </div>
  );
};

export default WidgetGenerate;
