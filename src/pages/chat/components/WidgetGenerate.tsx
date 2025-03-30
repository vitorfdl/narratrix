import { Button } from "@/components/ui/button";
import { TipTapTextArea } from "@/components/ui/tiptap-textarea";
import { Toggle } from "@/components/ui/toggle";
import { useProfile } from "@/hooks/ProfileContext";
import { useChatActions, useCurrentChatId, useCurrentChatParticipants, useCurrentChatTemplateID } from "@/hooks/chatStore";
import { useChatTemplate } from "@/hooks/chatTemplateStore";
import { useModelManifestById } from "@/hooks/manifestStore";
import { useModelById } from "@/hooks/modelsStore";
import { useInference } from "@/hooks/useInference";
import { cn } from "@/lib/utils";
import { ChatMessageType } from "@/schema/chat-message-schema";
import { InferenceMessage, ModelSpecs } from "@/schema/inference-engine-schema";
import { Languages, SpellCheck2, Wand2 } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface WidgetGenerateProps {
  onSubmit?: (text: string) => void;
}

const WidgetGenerate: React.FC<WidgetGenerateProps> = () => {
  const [text, setText] = React.useState("");
  const [autoTranslate, setAutoTranslate] = React.useState(false);
  const [loadingCharacterId, setLoadingCharacterId] = useState<string | null>(null);

  // Use a single ref object to track streaming state
  const streamingState = useRef({
    messageId: null as string | null,
    requestId: null as string | null,
    accumulatedText: "",
  });

  const profile = useProfile();
  const sendCommand = profile.currentProfile?.settings.chat.sendShortcut;
  const participants = useCurrentChatParticipants();
  const chatId = useCurrentChatId();
  const { addChatMessage, updateChatMessage } = useChatActions();
  const chatTemplateID = useCurrentChatTemplateID();
  const chatTemplate = useChatTemplate(chatTemplateID || "");
  const modelSettings = useModelById(chatTemplate?.model_id || "");
  const manifestSettings = useModelManifestById(modelSettings?.manifest_id || "");

  // Cast participants to include the inference properties from settings
  const enabledParticipants = participants.filter((p) => p.enabled);

  // Helper to reset all streaming state
  const resetStreamingState = useCallback(() => {
    setLoadingCharacterId(null);
    streamingState.current = {
      messageId: null,
      requestId: null,
      accumulatedText: "",
    };
  }, []);

  // Set up inference with callbacks
  const { runInference } = useInference({
    onStream: (response, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      if (loadingCharacterId && streamingState.current.messageId && response.result?.text) {
        // Append the new text to our accumulated text
        streamingState.current.accumulatedText += response.result.text;

        // Update the message with the accumulated text
        updateCharacterMessage(streamingState.current.messageId, streamingState.current.accumulatedText);
      }
    },
    onComplete: (response, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      if (loadingCharacterId && streamingState.current.messageId) {
        // Determine the final text, prioritizing the most complete response
        const finalText = response.result?.full_response || response.result?.text;

        // Final update to the message
        updateCharacterMessage(streamingState.current.messageId, finalText);

        // Reset all streaming state
        resetStreamingState();
      }
    },
    onError: (error, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      console.error("Inference error:", error);

      // Reset all streaming state
      resetStreamingState();
    },
  });

  const updateCharacterMessage = async (messageId: string, messageText: string) => {
    try {
      // Directly update the message by ID
      await updateChatMessage(messageId, {
        messages: [messageText],
        message_index: 0,
      });
    } catch (err) {
      console.error("Failed to update character message:", err);
    }
  };

  const handleSubmit = useCallback(
    async (submittedText: string) => {
      if (!submittedText.trim() || !chatId) {
        return;
      }

      // First, add the user's message to the chat
      try {
        await addChatMessage({
          chat_id: chatId,
          character_id: null,
          type: "user" as ChatMessageType,
          position: Date.now(), // Using timestamp for position
          messages: [submittedText],
          message_index: 0,
        });

        // Clear the input text
        setText("");

        // Get the next enabled character to respond
        const nextCharacter = enabledParticipants[0];
        if (nextCharacter) {
          // Reset stream state before starting new inference
          resetStreamingState();

          // Set loading state for this character
          setLoadingCharacterId(nextCharacter.id);

          // Create a placeholder message for the character that will be updated
          const newMessage = await addChatMessage({
            chat_id: chatId,
            character_id: nextCharacter.id,
            type: "character" as ChatMessageType,
            position: Date.now() + 1, // Ensure it comes after the user message
            messages: ["..."], // Placeholder for streaming response
            message_index: 0,
          });

          // Store the message ID for the streaming updates
          streamingState.current.messageId = newMessage.id;

          // Prepare messages for inference
          const inferenceMessages: InferenceMessage[] = [
            {
              role: "user",
              text: submittedText,
            },
          ];

          // Use the model settings from the template
          const modelSpecs: ModelSpecs = {
            id: modelSettings!.id,
            model_type: "chat",
            config: modelSettings!.config,
            max_concurrent_requests: modelSettings!.max_concurrency || 1,
            engine: manifestSettings!.engine,
          };

          // Start the inference process with streaming enabled
          const requestId = await runInference({
            messages: inferenceMessages,
            modelSpecs,
            systemPrompt: nextCharacter.settings?.system_prompt || "",
            parameters: nextCharacter.settings?.model_parameters || {},
            stream: true, // Enable streaming
          });

          // Store the request ID to filter events
          if (requestId) {
            streamingState.current.requestId = requestId;
          }
        }
      } catch (error) {
        console.error("Error handling message submission:", error);
        resetStreamingState();
      }
    },
    [chatId, addChatMessage, enabledParticipants, runInference, modelSettings, resetStreamingState, manifestSettings],
  );

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
    <div className="flex h-full flex-col gap-1 p-1">
      <div className="flex-none flex items-center gap-2 px-1">
        <Button variant="ghost" size="sm" onClick={handleImpersonate} title="Impersonate">
          <Wand2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleSpellCheck} title="Spell Check">
          <SpellCheck2 className="w-4 h-4" />
        </Button>
        <Toggle pressed={autoTranslate} onPressedChange={setAutoTranslate} title="Auto Translate" size="sm">
          <Languages className="w-4 h-4" />
        </Toggle>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden border border-input rounded-md">
        <TipTapTextArea
          initialValue={text}
          onChange={(e) => setText(e)}
          editable={!loadingCharacterId} // Disable input while inference is running
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
