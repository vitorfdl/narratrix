import { InferenceMessage } from "@/schema/inference-engine-schema";
import { InferenceTemplate } from "@/schema/template-inferance-schema";
import { PromptFormatterConfig } from "./formatter";
import { applyTextReplacements } from "./replace-text";

interface ApplyInferenceTemplateConfig {
  systemPrompt: string | undefined;
  inferenceTemplate: InferenceTemplate;
  messages: InferenceMessage[];
  chatConfig: PromptFormatterConfig["chatConfig"];
}

// Helper function to replace literal '\\n' with actual newline characters '\n'
function processNewlines(str: string): string {
  return str.replace(/\\n/g, "\n");
}

async function applyInferenceTemplate(params: ApplyInferenceTemplateConfig): Promise<{ text: string; customStopStrings: string[] }> {
  const { systemPrompt, inferenceTemplate, messages, chatConfig } = params;
  const { config } = inferenceTemplate;
  const formattedParts: string[] = [];

  // 1. Format System Prompt
  if (systemPrompt) {
    const systemPromptPrefix = applyTextReplacements(processNewlines(config.systemPromptFormatting.prefix), chatConfig);
    const systemPromptSuffix = applyTextReplacements(processNewlines(config.systemPromptFormatting.suffix), chatConfig);

    formattedParts.push(`${systemPromptPrefix}${systemPrompt}${systemPromptSuffix}`);
  }

  const assistantPrefix = applyTextReplacements(processNewlines(config.assistantMessageFormatting.prefix), chatConfig);
  const assistantSuffix = applyTextReplacements(processNewlines(config.assistantMessageFormatting.suffix), chatConfig);

  const userPrefix = applyTextReplacements(processNewlines(config.userMessageFormatting.prefix), chatConfig);
  const userSuffix = applyTextReplacements(processNewlines(config.userMessageFormatting.suffix), chatConfig);

  // 2. Format Messages
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const isLastMessage = i === messages.length - 1;
    let formattedText: string;

    switch (message.role) {
      case "user":
        formattedText = `${userPrefix}${message.text}${userSuffix}`;
        break;
      case "assistant": {
        // If it's the last message and it's an assistant message, omit the suffix.
        formattedText = isLastMessage ? `${assistantPrefix}${message.text}` : `${assistantPrefix}${message.text}${assistantSuffix}`;
        break;
      }
      // NOTE: Agent logic is commented out as it's not in InferenceMessageSchema
      // case "agent":
      //   ...
      //   break;
      default:
        console.warn(`Unknown message role encountered: ${message.role}`);
        formattedText = message.text; // Default to raw text
        break;
    }
    formattedParts.push(formattedText);
  }

  // 3. Combine parts and conditionally append final assistant prefill
  const basePrompt = formattedParts.join("");

  const sufixStopStrings = [userSuffix, assistantSuffix].filter((suffix) => suffix !== "");
  const formattedStopStrings = [...config.customStopStrings, ...sufixStopStrings];

  // Only add the final prefix and prefill if the last message wasn't an assistant message.
  if (lastMessage && lastMessage.role === "assistant") {
    return { text: basePrompt, customStopStrings: formattedStopStrings };
  }

  const finalAssistantPrefill = processNewlines(config.assistantMessageFormatting.prefill);
  return { text: `${basePrompt}${assistantPrefix}${finalAssistantPrefill}`, customStopStrings: formattedStopStrings };
}

export { applyInferenceTemplate };
