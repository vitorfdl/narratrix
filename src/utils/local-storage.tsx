import { CharacterPageSettings } from "@/pages/characters/CharactersPage";
import { ExpressionGenerateSettings } from "@/pages/chat/components/WidgetExpressions";
import { GridPosition, defaultPositions } from "@/schema/grid";
import { produce } from "immer";
import { useAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { useMemo } from "react";

/**
 * Local storage for characters pages settings
 */
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

export function useLocalCharactersPagesSettings() {
  return useAtom(charactersPagesSettingsAtom);
}

/**
 * Local storage for grid layout
 */
const gridLayoutAtom = atomWithStorage<GridPosition[]>("gridLayout", defaultPositions, {
  getItem: (key, initialValue) => {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      try {
        const storedLayout = JSON.parse(storedValue) as GridPosition[];

        const mergedLayout = produce(storedLayout, (draftLayout: GridPosition[]) => {
          const storedIds = new Set(draftLayout.map((pos: GridPosition) => pos.id));
          defaultPositions.forEach((defaultPos) => {
            if (!storedIds.has(defaultPos.id)) {
              draftLayout.push(defaultPos);
            }
          });
        });

        return mergedLayout;
      } catch (error) {
        console.error("Failed to parse stored grid layout:", error);
        return initialValue;
      }
    }
    return initialValue;
  },
  setItem: (key, newValue) => {
    localStorage.setItem(key, JSON.stringify(newValue));
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
});

export function useLocalGridLayout() {
  return useAtom(gridLayoutAtom);
}

/**
 * Local storage for chat tabs
 */
const chatTabsAtomFamily = atomFamily((profileId: string) => {
  const key = `chatTabs-${profileId}`;
  return atomWithStorage<string[]>(key, []);
});

// Hook to use chat tabs with a specific profile ID
export function useLocalChatTabs(profileId: string) {
  const chatTabsAtom = useMemo(() => chatTabsAtomFamily(profileId), [profileId]);
  return useAtom(chatTabsAtom);
}

/**
 * Local storage for expression settings
 */
const expressionGenerationSettingsAtom = atomWithStorage<ExpressionGenerateSettings>("expressionGenerationSettings", {
  modelId: "none",
  autoRefresh: false,
  requestPrompt: "",
  systemPrompt: "",
});

export function useLocalExpressionGenerationSettings() {
  return useAtom(expressionGenerationSettingsAtom);
}
