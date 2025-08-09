import { FormatTemplate } from "@/schema/template-format-schema";
import { DEFAULT_THINKING_CONFIG, StreamingState } from "./types";

/**
 * Enhanced chunk processor with buffer for handling streaming text with reasoning tags
 */
export const processStreamChunk = (chunk: string, streamingState: StreamingState, formatTemplate: FormatTemplate | null): { textToAdd: string; reasoningToAdd: string } => {
  const { prefix = "<think>", suffix = "</think>" } = formatTemplate?.config.reasoning || DEFAULT_THINKING_CONFIG;

  // If thinking is disabled (empty prefix or suffix), treat all content as regular text
  if (!prefix || !suffix) {
    // Clear any buffered content and add to text
    const allText = streamingState.chunkBuffer + chunk;
    streamingState.chunkBuffer = "";
    streamingState.isThinking = false;
    return { textToAdd: allText, reasoningToAdd: "" };
  }

  // Combine buffer with new chunk
  let workingText = streamingState.chunkBuffer + chunk;
  let textToAdd = "";
  let reasoningToAdd = "";

  // Process the working text
  while (workingText.length > 0) {
    if (streamingState.isThinking) {
      // Look for end tag
      const endTagIndex = workingText.indexOf(suffix);

      if (endTagIndex !== -1) {
        // Found complete end tag
        reasoningToAdd += workingText.substring(0, endTagIndex);
        workingText = workingText.substring(endTagIndex + suffix.length);
        streamingState.isThinking = false;
      } else {
        // Check if we have a partial end tag at the end
        const partialMatch = findPartialTagMatch(workingText, suffix);
        if (partialMatch > -1) {
          // Save partial match in buffer
          reasoningToAdd += workingText.substring(0, partialMatch);
          streamingState.chunkBuffer = workingText.substring(partialMatch);
          workingText = "";
        } else {
          // No partial match, consume all as reasoning
          reasoningToAdd += workingText;
          streamingState.chunkBuffer = "";
          workingText = "";
        }
      }
    } else {
      // Look for start tag
      const startTagIndex = workingText.indexOf(prefix);

      if (startTagIndex !== -1) {
        // Found complete start tag
        textToAdd += workingText.substring(0, startTagIndex);
        workingText = workingText.substring(startTagIndex + prefix.length);
        streamingState.isThinking = true;
      } else {
        // Check if we have a partial start tag at the end
        const partialMatch = findPartialTagMatch(workingText, prefix);
        if (partialMatch > -1) {
          // Save partial match in buffer
          textToAdd += workingText.substring(0, partialMatch);
          streamingState.chunkBuffer = workingText.substring(partialMatch);
          workingText = "";
        } else {
          // No partial match, consume all as text
          textToAdd += workingText;
          streamingState.chunkBuffer = "";
          workingText = "";
        }
      }
    }
  }

  return { textToAdd, reasoningToAdd };
};

/**
 * Helper function to find partial tag matches at the end of text
 */
const findPartialTagMatch = (text: string, tag: string): number => {
  // Check if the end of text could be the beginning of the tag
  for (let i = 1; i < tag.length && i <= text.length; i++) {
    if (text.endsWith(tag.substring(0, i))) {
      return text.length - i;
    }
  }
  return -1;
};
