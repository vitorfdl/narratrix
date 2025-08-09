import { useCallback, useMemo } from "react";
import { useChatActions, useCurrentChatActiveChapterID, useCurrentChatChapters, useCurrentChatId, useCurrentChatMessages, useCurrentChatParticipants } from "@/hooks/chatStore";
import { useModelManifests } from "@/hooks/manifestStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { Character } from "@/schema/characters-schema";
import { ChatMessage } from "@/schema/chat-message-schema";
import { formatPrompt as formatPromptUtil } from "@/services/inference/formatter";
import { useLocalSummarySettings } from "@/utils/local-storage";
import { listCharacters } from "../character-service";
import { ChatParticipant, getChatById } from "../chat-service";
import { listModels } from "../model-service";
import { listChatTemplates } from "../template-chat-service";
import { getFormatTemplateById } from "../template-format-service";
import { listInferenceTemplates } from "../template-inference-service";

/**
 * Returns a comma-separated string of enabled character names from the participants list.
 * Only includes participants whose IDs match a character in the provided characterList.
 *
 * @param participantsList - Array of chat participants
 * @param characterList - Array of available characters
 * @returns Comma-separated string of character names
 */
function getParticipantGroups(participantsList: ChatParticipant[], characterList: Character[]): string {
  if (!participantsList || !characterList) {
    return "";
  }

  // Build a map for efficient character lookup
  const characterMap = new Map(characterList.map((char) => [char.id, char.name]));

  // Filter enabled participants whose IDs match a character, then map to names
  const names = participantsList
    .filter((participant) => participant.enabled && characterMap.has(participant.id))
    .map((participant) => characterMap.get(participant.id)!)
    .filter(Boolean);

  return names.join(", ");
}

/**
 * Hook for formatting prompts for inference
 */
export function usePromptFormatter() {
  const currentProfile = useCurrentProfile();
  const currentChatId = useCurrentChatId();
  const chatMessages = useCurrentChatMessages();
  const { fetchChatMessages } = useChatActions();
  const modelManifestList = useModelManifests();
  const chapterList = useCurrentChatChapters();
  const participantsList = useCurrentChatParticipants();
  const currentChapterID = useCurrentChatActiveChapterID();
  const [localSummarySettings] = useLocalSummarySettings();

  if (!currentProfile) {
    throw new Error("Current profile not found");
  }

  // Memoize expensive data fetching operations
  const memoizedDataFetchers = useMemo(
    () => ({
      getChatTemplates: () => listChatTemplates({ profile_id: currentProfile.id }),
      getModels: () => listModels({ profile_id: currentProfile.id }),
      getCharacters: () => listCharacters(currentProfile.id),
      getInferenceTemplates: () => listInferenceTemplates({ profile_id: currentProfile.id }),
    }),
    [currentProfile.id],
  );

  // Memoize character name mapping to avoid recalculation
  const createCharacterNameMap = useCallback(async (characterList: Character[]) => {
    const nameMap = new Map<string, string>();
    characterList.forEach((char) => {
      nameMap.set(char.id, char.name);
    });
    return nameMap;
  }, []);

  // Memoize message filtering and name assignment
  const processMessagesWithNames = useCallback(
    async (messagesToUse: ChatMessage[] | undefined, characterList: Character[], userCharacterOrProfileName: string, excludeMessageId?: string) => {
      const characterNameMap = await createCharacterNameMap(characterList);

      return (messagesToUse || chatMessages)
        ?.map((msg) => ({
          ...msg,
          character_name: msg.character_id ? characterNameMap.get(msg.character_id) : msg.type === "user" ? userCharacterOrProfileName : undefined,
        }))
        ?.filter((msg) => msg.id !== excludeMessageId)
        ?.filter((msg) => !msg.disabled);
    },
    [chatMessages, createCharacterNameMap],
  );

  /**
   * Format prompts for the inference engine
   */
  const formatPrompt = useCallback(
    async (
      userMessage?: string,
      characterId?: string,
      systemPromptOverride?: string,
      chatTemplateID?: string,
      messagesToUse?: ChatMessage[],
      extraSuggestions?: Record<string, any>,
      excludeMessageId?: string,
    ) => {
      // Batch all async operations for better performance
      const [currentChat, chatTemplateList, modelList, characterList, inferenceTemplateList] = await Promise.all([
        getChatById(currentChatId),
        memoizedDataFetchers.getChatTemplates(),
        memoizedDataFetchers.getModels(),
        memoizedDataFetchers.getCharacters(),
        memoizedDataFetchers.getInferenceTemplates(),
      ]);

      const chatTemplate = chatTemplateID ? chatTemplateList.find((template) => template.id === chatTemplateID)! : chatTemplateList.find((template) => template.id === currentChat?.chat_template_id)!;

      if (!chatTemplate) {
        throw new Error("Chat template not found");
      }

      const modelSettings = modelList.find((model) => model.id === chatTemplate.model_id)!;

      if (!modelSettings) {
        throw new Error(`Model settings for chat template ${chatTemplate.name} not found`);
      }

      const manifestSettings = modelManifestList.find((manifest) => manifest.id === modelSettings.manifest_id)!;
      if (!manifestSettings) {
        throw new Error(`Manifest settings for model ${modelSettings.name} not found`);
      }

      const formatTemplate = await getFormatTemplateById(chatTemplate.format_template_id || "");
      if (!formatTemplate) {
        throw new Error(`Format template for chat template ${chatTemplate.name} not found`);
      }

      const inferenceTemplate = inferenceTemplateList.find((template) => template.id === modelSettings.inference_template_id)!;

      // Get the user character name or the profile name
      const userCharacter = characterList.find((character) => character.id === currentChat?.user_character_id);
      const userCharacterOrProfileName = userCharacter?.name || currentProfile?.name;

      // Process messages with optimized character name mapping
      const chatWithNames = await processMessagesWithNames(messagesToUse, characterList, userCharacterOrProfileName, excludeMessageId);

      const characterPromptOverride = characterList.find((character) => character.id === characterId)?.system_override;
      const character = characterList.find((character) => character.id === characterId);

      // Extra Suggestions
      const chatExtra = extraSuggestions || {};
      chatExtra.group = getParticipantGroups(participantsList || [], characterList);

      // Format the prompt
      const prompt = await formatPromptUtil({
        messageHistory: chatWithNames || [],
        userPrompt: userMessage,
        systemOverridePrompt: systemPromptOverride || characterPromptOverride || undefined,
        modelSettings,
        formatTemplate,
        inferenceTemplate,
        chatTemplate: {
          custom_prompts: chatTemplate?.custom_prompts,
          config: chatTemplate?.config,
          lorebook_list: chatTemplate?.lorebook_list || [],
        },
        chatConfig: {
          injectionPrompts: {
            summary: localSummarySettings.injectionPrompt,
          },
          character,
          user_character: (userCharacter as Character) || { name: userCharacterOrProfileName, custom: { personality: "" } },
          chapter: chapterList.find((chapter) => chapter.id === currentChapterID),
          extra: chatExtra,
          censorship: {
            words: formatTemplate.config.settings.apply_censorship ? currentProfile?.settings?.censorship?.customWords : [],
          },
        },
      });

      return {
        ...prompt,
        manifestSettings,
        modelSettings,
        chatTemplate,
        formatTemplate,
        isChat: !inferenceTemplate,
      };
    },
    [currentChatId, memoizedDataFetchers, modelManifestList, currentProfile, chapterList, currentChapterID, localSummarySettings, processMessagesWithNames],
  );

  return {
    formatPrompt,
    fetchChatMessages,
  };
}
