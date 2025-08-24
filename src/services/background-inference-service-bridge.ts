import { getChatTemplateById } from "@/services/template-chat-service";
import { getModelById, Model } from "@/services/model-service";
import { getInferenceTemplateById } from "@/services/template-inference-service";
import { getFormatTemplateById } from "@/services/template-format-service";
import { formatPrompt } from "@/services/inference/formatter";
import { removeNestedFields } from "@/services/inference/formatter/remove-nested-fields";
import { useModelManifests } from "@/hooks/manifestStore";
import { useInference } from "@/hooks/useInference";
import type { InferenceMessage, ModelSpecs } from "@/schema/inference-engine-schema";

// Lightweight bridge to run a one-off, non-streaming inference from non-React services.
// Note: This still relies on hooks; ensure callers are within React render context.

export interface BridgeRunOptions {
  chatTemplateId: string;
  prompt: string;
  systemPrompt?: string;
  parameters?: Record<string, any>;
}

export async function runBackgroundInference(options: BridgeRunOptions): Promise<string | null> {
  const { chatTemplateId, prompt, systemPrompt = "", parameters = {} } = options;

  const manifests = useModelManifests();
  const { runInference } = useInference({});

  const chatTemplate = await getChatTemplateById(chatTemplateId).catch(() => null);
  if (!chatTemplate) {
    return null;
  }

  const model = chatTemplate?.model_id ? await getModelById(chatTemplate.model_id) : null;
  if (!model) {
    return null;
  }

  const manifest = manifests.find((m) => m.id === model.manifest_id);
  if (!manifest) {
    return null;
  }

  const template = await getInferenceTemplateById(model.inference_template_id || "").catch(() => null);
  const formatTemplate = await getFormatTemplateById(chatTemplate.format_template_id || "").catch(() => null);

  const promptResult = await formatPrompt({
    messageHistory: [],
    userPrompt: prompt,
    modelSettings: model as Model,
    inferenceTemplate: template || undefined,
    formatTemplate,
    chatTemplate,
    systemOverridePrompt: systemPrompt,
    chatConfig: {},
  });

  const { inferenceMessages, systemPrompt: formattedSystemPrompt, customStopStrings } = promptResult;
  const fixedParameters = removeNestedFields(parameters || chatTemplate?.config || {});
  if (customStopStrings) {
    fixedParameters.stop = fixedParameters.stop ? [...fixedParameters.stop, ...customStopStrings] : customStopStrings;
  }

  const modelSpecs: ModelSpecs = {
    id: model.id,
    model_type: model.inference_template_id ? "completion" : "chat",
    config: model.config,
    max_concurrent_requests: model.max_concurrency,
    engine: manifest.engine,
  };

  const confirmId = await runInference({
    messages: inferenceMessages as InferenceMessage[],
    modelSpecs,
    systemPrompt: formattedSystemPrompt,
    parameters: fixedParameters,
    stream: false,
  });

  // The current inference hook resolves via events; for now return null.
  return null;
}
