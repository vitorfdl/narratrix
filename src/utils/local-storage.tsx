import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const settingsAtom = atomWithStorage<string>("profileId", "");

export function useLocal() {
  return useAtom(settingsAtom);
}
