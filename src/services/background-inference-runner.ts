import { ChatMessage } from "@/services/chat-message-service";
import { getChatTemplateById } from "@/services/template-chat-service";
import { getModelById, Model } from "@/services/model-service";
import { getInferenceTemplateById } from "@/services/template-inference-service";
import { getFormatTemplateById } from "@/services/template-format-service";
import { formatPrompt } from "@/services/inference/formatter";
import { removeNestedFields } from "@/services/inference/formatter/remove-nested-fields";
import type { InferenceMessage } from "@/schema/inference-engine-schema";
import { listCharacters } from "@/services/character-service";
import { getChatChapterById } from "@/services/chat-chapter-service";
import { useCurrentChatActiveChapterID } from "@/hooks/chatStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useModelManifests } from "@/hooks/manifestStore";
import { useInference } from "@/hooks/useInference";

// WARNING: This runner avoids React state, but still relies on hooks to access
// shared infrastructure. It should be called from React environment lifecycles.
// If needed, later we can refactor to a provider that supplies dependencies.

export interface BackgroundRunOptions {
  chatTemplateId: string;
  prompt: string;
  systemPrompt?: string;
  parameters?: Record<string, any>;
  // Future: toolset, history, character context
}

export async function runBackgroundInference(options: BackgroundRunOptions): Promise<string | null> {
  const { chatTemplateId, prompt, systemPrompt = "", parameters = {} } = options;

  // Hook-based deps (available only in React call sites). We keep it simple here.
  const manifests = useModelManifests();
  const currentProfile = useCurrentProfile();
  const currentChapterID = useCurrentChatActiveChapterID();
  const { runInference, cancelRequest } = useInference({});

  const chatTemplate = await getChatTemplateById(chatTemplateId).catch(() => null);
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
  const formatTemplate = await getFormatTemplateById(chatTemplate.format_template_id || "").catch(() => null);

  const messages: ChatMessage[] = [];
  const activeChapter = await getChatChapterById(currentChapterID || "").catch(() => null);
  const characterList = await listCharacters(currentProfile!.id);

  const promptResult = await formatPrompt({
    messageHistory: messages,
    userPrompt: prompt,
    modelSettings: model as Model,
    inferenceTemplate: template || undefined,
    formatTemplate,
    chatTemplate,
    systemOverridePrompt: systemPrompt,
    chatConfig: {
      character: undefined,
      user_character: undefined as any,
      chapter: activeChapter || undefined,
      extra: undefined,
    },
  });

  const { inferenceMessages, systemPrompt: formattedSystemPrompt, customStopStrings } = promptResult;
  const fixedParameters = removeNestedFields(parameters || chatTemplate?.config || {});
  if (customStopStrings) {
    fixedParameters.stop = fixedParameters.stop ? [...fixedParameters.stop, ...customStopStrings] : customStopStrings;
  }

  const modelSpecs = {
    id: model.id,
    model_type: model.inference_template_id ? "completion" : "chat",
    config: model.config,
    max_concurrent_requests: model.max_concurrency,
    engine: manifest.engine,
  };

  // Fire and wait (non-streaming)
  const requestId = await runInference({
    messages: inferenceMessages as InferenceMessage[],
    modelSpecs,
    systemPrompt: formattedSystemPrompt,
    parameters: fixedParameters,
    stream: false,
  });

  // We do not have stream events here; instead we rely on the returned promise resolving through
  // the inference hook's onComplete normally. To keep this isolated, we simply return null here,
  // and recommend using useBackgroundInference hook for robust background result handling.
  // For now, return null to avoid hanging.
  return null;
}
