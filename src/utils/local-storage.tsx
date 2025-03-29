import { CharacterPageSettings } from "@/pages/characters/CharactersPage";
import { GridPosition, defaultPositions } from "@/schema/grid";
import { useAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { useMemo } from "react";
const charactersPagesSettingsAtom = atomWithStorage<CharacterPageSettings>("charactersPagesSettings", {
  view: {
    cardsPerRow: 6,
    cardSize: "medium",
  },
  sort: {
    field: "name",
    direction: "asc",
  },
  selectedTags: [],
});

// Keep the original implementation for backward compatibility
const gridLayoutAtom = atomWithStorage<GridPosition[]>("gridLayout", defaultPositions);

export function useLocalCharactersPagesSettings() {
  return useAtom(charactersPagesSettingsAtom);
}

export function useLocalGridLayout() {
  return useAtom(gridLayoutAtom);
}

// Chat tabs atom family for profile-specific chat tabs
const chatTabsAtomFamily = atomFamily((profileId: string) => {
  const key = `chatTabs-${profileId}`;
  return atomWithStorage<string[]>(key, []);
});

// Hook to use chat tabs with a specific profile ID
export function useLocalChatTabs(profileId: string) {
  const chatTabsAtom = useMemo(() => chatTabsAtomFamily(profileId), [profileId]);
  return useAtom(chatTabsAtom);
}
