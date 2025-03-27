import { CharacterPageSettings } from "@/pages/characters/CharactersPage";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const settingsAtom = atomWithStorage<string>("profileId", "");

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

export function useLocalProfileId() {
  return useAtom(settingsAtom);
}

export function useLocalCharactersPagesSettings() {
  return useAtom(charactersPagesSettingsAtom);
}
