import { useChatActions, useChatStore } from "@/hooks/chatStore";
import type { SheetValues } from "@/schema/template-character-sheet-schema";

/**
 * Chat-scoped sheet value overrides. Values filled from a chat are stored on the
 * chat (participant settings or user_character_settings) and never touch the
 * character's own defaults.
 */
export function useChatSheetValues(characterId: string | undefined, enabled: boolean) {
  const participant = useChatStore((state) => (enabled && characterId ? state.selectedChat?.participants?.find((p) => p.id === characterId) : undefined));
  const userCharacterId = useChatStore((state) => (enabled ? state.selectedChat?.user_character_id : undefined));
  const userCharacterSettings = useChatStore((state) => (enabled ? state.selectedChat?.user_character_settings : undefined));
  const { updateParticipant, updateSelectedChat } = useChatActions();

  const isUserCharacter = !!characterId && userCharacterId === characterId;
  const userEntry = isUserCharacter ? userCharacterSettings?.find((entry) => entry.id === characterId) : undefined;

  const overrides = ((participant?.settings?.sheet_values ?? userEntry?.settings?.sheet_values) as SheetValues | undefined) ?? undefined;
  const isChatScoped = enabled && (!!participant || isUserCharacter);

  const saveOverrides = async (values: SheetValues) => {
    if (!characterId || !isChatScoped) {
      return;
    }
    if (participant) {
      await updateParticipant(characterId, { settings: { ...participant.settings, sheet_values: values } });
    } else if (isUserCharacter) {
      const current = userCharacterSettings ?? [];
      const existing = current.find((entry) => entry.id === characterId);
      const nextEntry = { id: characterId, settings: { ...(existing?.settings ?? {}), sheet_values: values } };
      await updateSelectedChat({
        user_character_settings: [...current.filter((entry) => entry.id !== characterId), nextEntry],
      });
    }
  };

  return { overrides, saveOverrides, isChatScoped };
}
