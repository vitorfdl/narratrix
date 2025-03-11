import { useAtom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

const profileIdAtom = atomWithStorage<string | undefined>("profileId", "", createJSONStorage(() => sessionStorage));

export function useSessionProfileID() {
  return useAtom(profileIdAtom);
}
