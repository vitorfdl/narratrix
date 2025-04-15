import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useCurrentChatActiveChapterID } from "@/hooks/chatStore";
import { useModelManifests } from "@/hooks/manifestStore";
import { useInference } from "@/hooks/useInference";
import { Character } from "@/schema/characters-schema";
import { InferenceMessage, ModelSpecs } from "@/schema/inference-engine-schema";
import { useCallback, useRef } from "react";
import { listCharacters } from "./character-service";
import { getChatChapterById } from "./chat-chapter-service";
import { ChatMessage } from "./chat-message-service";
import { formatPrompt } from "./inference-steps/formatter";
import { removeNestedFields } from "./inference-steps/remove-nested-fields";
import { Model, getModelById } from "./model-service";
import { getChatTemplateById } from "./template-chat-service";
import { getInferenceTemplateById } from "./template-inference-service";

/**
 * Options for background inference
 */
export interface BackgroundInferenceOptions {
  model: Model;
  templateId?: string;
  prompt: InferenceMessage[];
  systemPrompt?: string;
  parameters?: Record<string, any>;
}

/**
 * Options for quick inference
 */
export interface QuickInferenceOptions {
  modelId?: string;
  chatTemplateId?: string;
  prompt: string;
  systemPrompt?: string;
  parameters?: Record<string, any>;
  maxResponseTokens?: number;
  context?: {
    userCharacterID?: string;
    characterID?: string;
    chapterID?: string;
    extra?: Record<string, string>;
  };
}

/**
 * Hook for background inference that properly handles asynchronous operations
 * and returns actual results without affecting chat state
 */
export function useBackgroundInference() {
  const currentProfile = useCurrentProfile();
  // Get all models, manifests, and templates at the component level
  const manifests = useModelManifests();

  const currentChapterID = useCurrentChatActiveChapterID();
  // Track ongoing requests
  const activeRequests = useRef<Record<string, boolean>>({});

  // Set up inference with callbacks
  const { runInference, cancelRequest } = useInference({
    onComplete: (response, requestId) => {
      if (!activeRequests.current[requestId]) {
        return;
      }

      // Remove from active requests
      delete activeRequests.current[requestId];

      const completeText = response.result?.full_response || response.result?.text;
      // Process complete response
      if (completeText) {
        // Resolve the promise for this request ID
        if (promiseResolvers.current[requestId]) {
          promiseResolvers.current[requestId].resolve(completeText);
          delete promiseResolvers.current[requestId];
          // consoleActions.updateRequestResponse(requestId, completeText);
        }
      }
    },
    onError: (error, requestId) => {
      if (!activeRequests.current[requestId]) {
        return;
      }

      // Remove from active requests
      delete activeRequests.current[requestId];

      // Reject the promise for this request ID
      if (promiseResolvers.current[requestId]) {
        promiseResolvers.current[requestId].reject(new Error(error.message || "Unknown inference error"));
        delete promiseResolvers.current[requestId];
      }
    },
  });

  // Promise resolvers for tracking and resolving background inference requests
  const promiseResolvers = useRef<Record<string, { resolve: (value: string) => void; reject: (reason: any) => void }>>({});

  /**
   * Execute background inference with a model and prompt
   * Returns a promise that resolves with the generated text
   */
  const executeInference = useCallback(
    async (options: BackgroundInferenceOptions): Promise<string> => {
      const { prompt, systemPrompt = "", parameters = {}, model } = options;

      // Create a promise that will be resolved when inference completes
      return new Promise<string>((resolve, reject) => {
        const manifest = manifests.find((m) => m.id === model.manifest_id);
        // Create model specs for the inference
        const modelSpecs: ModelSpecs = {
          id: model.id,
          model_type: model.inference_template_id ? "completion" : "chat",
          config: model.config,
          max_concurrent_requests: model.max_concurrency,
          engine: manifest?.engine || "",
        };
        // Queue the inference request
        runInference({
          messages: prompt,
          modelSpecs,
          systemPrompt: systemPrompt,
          parameters,
          stream: false, // No streaming for background inference
        })
          .then((requestId) => {
            if (!requestId) {
              reject(new Error("Failed to create inference request"));
              return;
            }

            // Store the request and its promise resolvers
            activeRequests.current[requestId] = true;
            promiseResolvers.current[requestId] = { resolve, reject };

            // Set a timeout to prevent hanging promises
            setTimeout(() => {
              if (promiseResolvers.current[requestId]) {
                delete activeRequests.current[requestId];
                delete promiseResolvers.current[requestId];
                reject(new Error("Background inference timeout"));

                // Attempt to cancel the request
                cancelRequest(requestId).catch(console.error);
              }
            }, 60000); // 1 minute timeout
          })
          .catch(reject);
      });
    },
    [runInference, cancelRequest],
  );

  /**
   * Wrapper function for quick inference with just a prompt
   * Uses the lists of models, manifests, and templates that were loaded at the component level
   */
  const generateQuietly = useCallback(
    async (options: QuickInferenceOptions): Promise<string | null> => {
      try {
        const { prompt, systemPrompt, parameters, context, chatTemplateId } = options;

        // Find model, manifest, and template using the arrays we already have
        const chatTemplate = await getChatTemplateById(chatTemplateId || "").catch(() => null);
        if (!chatTemplate) {
          console.error(`Template with ID ${chatTemplateId} not found`);
          return null;
        }

        const model = chatTemplate?.model_id ? await getModelById(chatTemplate.model_id) : null;
        if (!model) {
          console.error(`Model with ID ${chatTemplate?.model_id} not found`);
          return null;
        }

        const manifest = manifests.find((m) => m.id === model.manifest_id);
        if (!manifest) {
          console.error(`Manifest with ID ${model.manifest_id} not found`);
          return null;
        }

        const template = await getInferenceTemplateById(model.inference_template_id || "").catch(() => null);

        // Create inference message
        const messages: ChatMessage[] = [];
        const activeChapter = await getChatChapterById(currentChapterID || "").catch(() => null);

        const characterList = await listCharacters(currentProfile!.id);
        const promptResult = await formatPrompt({
          messageHistory: messages,
          userPrompt: prompt,
          modelSettings: model,
          inferenceTemplate: template,
          chatTemplate: {
            custom_prompts: [],
            config: {
              ...chatTemplate?.config,
              // max_context: parameters?.max_context || 2048,
              // max_tokens: parameters?.max_tokens || 50,
              // max_depth: parameters?.max_depth || 2,
            },
          },
          systemOverridePrompt: systemPrompt,
          chatConfig: {
            character: characterList.find((character) => character.id === context?.characterID),
            user_character: characterList.find((character) => character.id === context?.userCharacterID) as Character,
            chapter: activeChapter || undefined,
            extra: context?.extra,
          },
        });

        const { inferenceMessages, systemPrompt: formattedSystemPrompt, customStopStrings } = promptResult;

        const fixedParameters = removeNestedFields(parameters || chatTemplate?.config || {});
        if (customStopStrings) {
          fixedParameters.stop = fixedParameters.stop ? [...fixedParameters.stop, ...customStopStrings] : customStopStrings;
        }

        // Execute the inference
        return await executeInference({
          model,
          templateId: template?.id || "",
          prompt: inferenceMessages,
          systemPrompt: formattedSystemPrompt,
          parameters: fixedParameters,
        });
      } catch (error: any) {
        console.error("Background inference error:", typeof error, error);
        throw error.message;
      }
    },
    [manifests, executeInference],
  );

  return {
    generateQuietly,
  };
}

// Potential future additions:
// - Function to lookup model/template configurations by ID if needed
// - More sophisticated error handling/retry logic
