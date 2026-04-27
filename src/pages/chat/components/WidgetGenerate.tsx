import React, { useCallback, useEffect, useRef, useState } from "react";
import { LuCircleStop, LuLoaderCircle, LuSend } from "react-icons/lu";
import { toast } from "sonner";
import type { MarkdownEditorRef } from "@/components/markdownRender/markdown-editor";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/agentStore";
import { cancelAgentWorkflow, useAgentWorkflowStore } from "@/hooks/agentWorkflowStore";
import { getCurrentChatId, useChatStore, useCurrentChatActiveChapterID, useCurrentChatId, useCurrentChatMessages, useCurrentChatParticipants, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useAgentWorkflow } from "@/hooks/useAgentWorkflow";
import type { GenerationOptions, StreamingState } from "@/hooks/useChatInference";
import { useInferenceServiceFromContext } from "@/hooks/useChatInference";
import { cn } from "@/lib/utils";
import { QuickAction } from "@/schema/profiles-schema";
import { cancelChatGeneration, clearChatGenerationCancellation, isChatGenerationCancelled } from "@/services/chat-generation-cancellation";
import { orchestrateGeneration } from "@/services/chat-generation-orchestrator";
import { createChatMessage, getChatMessagesByChatId, getNextMessagePosition } from "@/services/chat-message-service";
import { useLocalGenerationInputHistory } from "@/utils/local-storage";
import QuickActions from "./utils-generate/QuickActions";

interface WidgetGenerateProps {
  onSubmit?: (text: string) => void;
}

const WidgetGenerate: React.FC<WidgetGenerateProps> = () => {
  const inferenceService = useInferenceServiceFromContext();
  const [text, setText] = React.useState("");
  const [generationInputHistory, setGenerationInputHistory] = useLocalGenerationInputHistory();
  const [streamingCharacters, setStreamingCharacters] = useState<Record<string, boolean>>({});
  const [orchestratingChatIds, setOrchestratingChatIds] = useState<Set<string>>(() => new Set());
  const quietResponseRef = useRef<boolean>(false);
  const [inputStreamingText, setInputStreamingText] = useState<string>("");
  const orchestrationAbortRef = useRef<Record<string, boolean>>({});

  const currentProfile = useCurrentProfile();
  const currentChatId = useCurrentChatId();
  const currentChatActiveChapterId = useCurrentChatActiveChapterID();
  const sendCommand = currentProfile?.settings.chat.sendShortcut;
  const participants = useCurrentChatParticipants();
  const chatMessages = useCurrentChatMessages();
  const userCharacterId = useCurrentChatUserCharacterID() ?? null;
  const agentList = useAgents();
  const isAnyAgentRunningInCurrentChat = useAgentWorkflowStore((state) => Object.values(state.states).some((agentState) => agentState.chatId === currentChatId && agentState.isRunning));

  const { executeWorkflow } = useAgentWorkflow();

  const addUserMessageToChat = useCallback(async (chatId: string, chapterId: string, message: string) => {
    const position = await getNextMessagePosition(chatId, chapterId);
    const newMessage = await createChatMessage({
      chat_id: chatId,
      chapter_id: chapterId,
      character_id: null,
      type: "user",
      messages: [message],
      message_index: 0,
      position,
      disabled: false,
      tokens: null,
      extra: {},
    });

    if (chatId === getCurrentChatId()) {
      const updatedMessages = await getChatMessagesByChatId(chatId, chapterId);
      if (chatId === getCurrentChatId()) {
        useChatStore.setState({ selectedChatMessages: updatedMessages });
      }
    }

    return newMessage;
  }, []);

  // Get enabled participants for message generation
  const enabledParticipants = participants?.filter((p) => p.enabled) || [];

  // Generate a unique key based on participants to force editor re-initialization
  const editorKey = participants ? `editor-${participants.length}-${enabledParticipants.length}` : "editor-default";

  // Ref for focusing the MarkdownTextArea
  const markdownRef = useRef<MarkdownEditorRef>(null);

  // Subscribe to streaming state changes scoped to this chat.
  // Sync local state immediately so switching chats clears the previous chat's indicators.
  useEffect(() => {
    const currentState = inferenceService.getStreamingState(currentChatId);
    if (currentState.characterId) {
      setStreamingCharacters({ [currentState.characterId]: true });
    } else {
      setStreamingCharacters({});
    }
    quietResponseRef.current = false;
    setInputStreamingText("");

    const unsubscribe = inferenceService.subscribeToStateChanges((streamingState) => {
      if (streamingState.messageId === "generate-input-area") {
        quietResponseRef.current = true;
        setInputStreamingText(streamingState.accumulatedText);
      } else if (quietResponseRef.current && !streamingState.characterId) {
        quietResponseRef.current = false;
        setInputStreamingText("");
      }

      if (streamingState.characterId) {
        setStreamingCharacters((prev) => {
          if (prev[streamingState.characterId as string]) {
            return prev;
          }
          return {
            ...prev,
            [streamingState.characterId as string]: true,
          };
        });
      } else {
        setStreamingCharacters({});
      }
    }, currentChatId);

    return unsubscribe;
  }, [inferenceService, currentChatId]);

  // Global tab-to-focus handler
  useEffect(() => {
    const handleTabFocus = (e: KeyboardEvent) => {
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

      const targetChatId = currentChatId;
      const targetChapterId = currentChatActiveChapterId;
      if (!targetChapterId) {
        toast.error("No active chapter found");
        return;
      }

      const waitForGenerationToFinish = (): Promise<void> => {
        return new Promise((resolve) => {
          if (!inferenceService.isStreaming(targetChatId)) {
            resolve();
            return;
          }
          const unsubscribe = inferenceService.subscribeToStateChanges((state) => {
            if (orchestrationAbortRef.current[targetChatId]) {
              unsubscribe();
              resolve();
              return;
            }
            if (!state?.characterId) {
              unsubscribe();
              resolve();
            }
          }, targetChatId);
        });
      };

      clearChatGenerationCancellation(targetChatId);
      orchestrationAbortRef.current[targetChatId] = false;
      setOrchestratingChatIds((prev) => new Set(prev).add(targetChatId));

      try {
        await orchestrateGeneration(submittedText.trim(), {
          chatId: targetChatId,
          participants: participants ?? [],
          agents: agentList,
          userCharacterId,
          addUserMessage: async (text) => {
            await addUserMessageToChat(targetChatId, targetChapterId, text);
          },
          executeWorkflow,
          generateMessage: (opts: GenerationOptions) => inferenceService.generateMessage(opts),
          waitForGenerationToFinish,
          isAborted: () => !!orchestrationAbortRef.current[targetChatId] || isChatGenerationCancelled(targetChatId),
        });

        if (!orchestrationAbortRef.current[targetChatId]) {
          if (!generationInputHistory.length || generationInputHistory.at(-1) !== submittedText) {
            const newHistory = [...generationInputHistory, submittedText.trim()].slice(-25);
            setGenerationInputHistory(newHistory);
          }
          if (!quietResponseRef.current) {
            setText("");
          }
        }
      } catch (error) {
        toast.error(`${error}`);
      } finally {
        setOrchestratingChatIds((prev) => {
          const next = new Set(prev);
          next.delete(targetChatId);
          return next;
        });
        delete orchestrationAbortRef.current[targetChatId];
        clearChatGenerationCancellation(targetChatId);
      }
    },
    [
      enabledParticipants,
      participants,
      agentList,
      userCharacterId,
      inferenceService,
      executeWorkflow,
      generationInputHistory,
      setGenerationInputHistory,
      currentChatId,
      currentChatActiveChapterId,
      addUserMessageToChat,
    ],
  );

  // Returns true while the full generation loop is active (agent phases + inference streaming)
  const isAnyCharacterStreaming = useCallback(() => {
    return Object.keys(streamingCharacters).length > 0;
  }, [streamingCharacters]);

  const isGenerating = orchestratingChatIds.has(currentChatId) || isAnyCharacterStreaming() || isAnyAgentRunningInCurrentChat;

  const handleCancel = useCallback(async () => {
    try {
      cancelChatGeneration(currentChatId);
      orchestrationAbortRef.current[currentChatId] = true;
      setOrchestratingChatIds((prev) => {
        const next = new Set(prev);
        next.delete(currentChatId);
        return next;
      });

      // Cancel agent workflows running in this chat only
      const agentStates = useAgentWorkflowStore.getState().states;
      for (const [runKey, state] of Object.entries(agentStates)) {
        if (state.isRunning && state.chatId === currentChatId) {
          cancelAgentWorkflow(runKey);
        }
      }

      // Cancel inference if active (may not be running during a pure-agent phase)
      const success = await inferenceService.cancelGeneration(currentChatId);
      if (success) {
        setStreamingCharacters({});
        if (quietResponseRef.current) {
          quietResponseRef.current = false;
        }
      } else if (!isAnyAgentRunningInCurrentChat) {
        setStreamingCharacters({});
      }
      toast.success("Generation cancelled");
    } catch (error) {
      console.error("Error cancelling generation:", error);
      toast.error("Error cancelling generation");
    }
  }, [inferenceService, currentChatId, isAnyAgentRunningInCurrentChat]);

  useEffect(() => {
    if (text.length > 0) {
      setText(text);
    }
  }, [text]);

  const executeQuickAction = async (action: QuickAction, participantId?: string) => {
    const nextCharacter = participantId ? enabledParticipants.find((p) => p.id === participantId) : enabledParticipants[0];

    const quietResponse = action.streamOption === "textarea";

    const generationConfig: GenerationOptions = {
      chatId: currentChatId,
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
      onStreamingStateChange: handleStreamingStateChange,
    };

    if (action.streamOption === "participantMessage") {
      const participantMessageType = action.participantMessageType;

      if (participantMessageType === "swap") {
        const lastMessage = chatMessages?.[chatMessages.length - 1];
        if (lastMessage && lastMessage.type === "character") {
          generationConfig.characterId = lastMessage.character_id!;
          generationConfig.existingMessageId = lastMessage.id;
          const newIndex = lastMessage.messages.length;
          generationConfig.messageIndex = newIndex;
          generationConfig.extraSuggestions!.last_message = lastMessage.messages[lastMessage.message_index];
        } else if (participantId) {
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
        if (!currentChatActiveChapterId) {
          toast.error("No active chapter found");
          return;
        }
        const { id: newChatID } = await addUserMessageToChat(currentChatId, currentChatActiveChapterId, "...");
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
      {!isGenerating || quietResponseRef.current ? (
        <MarkdownTextArea
          ref={markdownRef}
          key={editorKey}
          initialValue={text}
          onChange={(e) => setText(e)}
          editable={true}
          placeholder={`Type your message here... (${sendCommand || "Ctrl+Enter"} to send)`}
          sendShortcut={sendCommand}
          className={cn("flex-1 h-full overflow-none pb-9", isGenerating && "animate-pulse")}
          onSubmit={handleSubmit}
          enableHistory={true}
        />
      ) : (
        <div className="flex-1 h-full overflow-none pb-9">
          <div className="h-full w-full flex items-center justify-center">
            <LuLoaderCircle className="w-4! h-4! animate-spin" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 w-full flex items-center gap-2 p-2 bg-background/95 border-t border-border justify-between z-10">
        <div className="flex items-center gap-2 ring-none">
          <QuickActions handleExecuteAction={executeQuickAction} />
        </div>
        {isGenerating ? (
          <Button variant="destructive" size="xs" onClick={handleCancel} title="Cancel Generation" className="ml-auto">
            <LuCircleStop className="!w-3.5 !h-3.5 mr-1" />
            Cancel
          </Button>
        ) : (
          <Button variant="default" size="xs" onClick={() => handleSubmit(text)} title={`Send Message (${sendCommand || "Ctrl+Enter"})`} className="ml-auto" disabled={!text.trim()}>
            <LuSend className="!w-3.5 !h-3.5" />
            Send
          </Button>
        )}
      </div>
    </div>
  );
};

export default WidgetGenerate;
