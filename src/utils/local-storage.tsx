import { Theme } from "@tauri-apps/api/window";
import { produce } from "immer";
import { useAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { useMemo } from "react";
import { AgentPageSettings } from "@/pages/agents/AgentPage";
import { CharacterPageSettings } from "@/pages/characters/CharactersPage";
import { SummarySettings } from "@/pages/chat/components/message-controls/SummaryDialog";
import { ExpressionGenerateSettings } from "@/pages/chat/components/WidgetExpressions";
import { defaultLorebookPageSettings, LorebookPageSettings } from "@/pages/lorebooks/LorebooksPage";
import { ModelsPageSettings } from "@/pages/models/ModelsPage";
import { defaultPositions, GridPosition } from "@/schema/grid";
import { QuickAction } from "@/schema/profiles-schema";

/**
 * Local storage for characters pages settings
 */
const charactersPagesSettingsAtom = atomWithStorage<CharacterPageSettings>("charactersPagesSettings", {
  view: {
    mode: "grid",
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
 * Local storage for agent page settings
 */
const agentPageSettingsAtom = atomWithStorage<AgentPageSettings>("agentPageSettings", {
  view: {
    mode: "grid",
    cardsPerRow: 4,
    cardSize: "medium",
  },
  sort: {
    field: "name",
    direction: "asc",
  },
  selectedTags: [],
});

export function useLocalAgentPageSettings() {
  return useAtom(agentPageSettingsAtom);
}

/**
 * Local storage for lorebook page settings
 */
const lorebookPageSettingsAtom = atomWithStorage<LorebookPageSettings>("lorebookPageSettings", defaultLorebookPageSettings);

export function useLocalLorebookPageSettings() {
  return useAtom(lorebookPageSettingsAtom);
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
          for (const defaultPos of defaultPositions) {
            if (!storedIds.has(defaultPos.id)) {
              draftLayout.push(defaultPos);
            }
          }
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
const expressionGenerationSettingsAtom = atomWithStorage<ExpressionGenerateSettings>(
  "expressionGenerationSettings",
  {
    chatTemplateId: "",
    autoRefresh: false,
    requestPrompt: "",
    systemPrompt: "",
    throttleInterval: 8000, // Default 8 seconds
    disableLogs: false,
    imageObjectFit: "cover",
  },
  {
    getItem: (key, initialValue) => {
      const storedValue = localStorage.getItem(key);
      if (!storedValue) {
        return initialValue;
      }

      try {
        const parsed = JSON.parse(storedValue) as Partial<ExpressionGenerateSettings>;
        return {
          chatTemplateId: parsed.chatTemplateId ?? initialValue.chatTemplateId,
          autoRefresh: parsed.autoRefresh ?? initialValue.autoRefresh,
          requestPrompt: parsed.requestPrompt ?? initialValue.requestPrompt,
          systemPrompt: parsed.systemPrompt ?? initialValue.systemPrompt,
          throttleInterval: parsed.throttleInterval ?? initialValue.throttleInterval,
          disableLogs: parsed.disableLogs ?? initialValue.disableLogs,
          imageObjectFit: parsed.imageObjectFit ?? initialValue.imageObjectFit,
        } satisfies ExpressionGenerateSettings;
      } catch (error) {
        console.error("Failed to parse expression generation settings:", error);
        return initialValue;
      }
    },
    setItem: (key, newValue) => {
      localStorage.setItem(key, JSON.stringify(newValue));
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
    },
  },
);

export function useLocalExpressionGenerationSettings() {
  return useAtom(expressionGenerationSettingsAtom);
}

/**
 * Local storage for quick actions
 */
const quickActionsAtom = atomWithStorage<QuickAction[]>("quickActions", []);

export function useLocalQuickActions() {
  return useAtom(quickActionsAtom);
}

/**
 * Local Storage for Theme
 */
const themeAtom = atomWithStorage<Theme | "system">("theme", "system");

export function useLocalTheme() {
  return useAtom(themeAtom);
}

/**
 * Local Storage Generation Input History
 */
const generationInputHistoryAtom = atomWithStorage<string[]>("generationInputHistory", []);

export function useLocalGenerationInputHistory() {
  return useAtom(generationInputHistoryAtom);
}

/**
 * Local Storage Generation Input History
 */
const summarySettingsAtom = atomWithStorage<SummarySettings>("summarySettings", {
  chatTemplateID: "",
  requestPrompt: "",
  systemPrompt: "",
  injectionPrompt: "---\n{{summary}}\n---",
});

export function useLocalSummarySettings() {
  return useAtom(summarySettingsAtom);
}

/**
 * Local storage for models page settings
 */
const modelsPageSettingsAtom = atomWithStorage<ModelsPageSettings>("modelsPageSettings", {
  view: {
    cardsPerRow: 4,
  },
  sort: {
    field: "name",
    direction: "asc",
  },
  filter: {
    type: "all",
  },
});

export function useLocalModelsPageSettings() {
  return useAtom(modelsPageSettingsAtom);
}
