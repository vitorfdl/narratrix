import { ProfileResponse } from "@/schema/profiles";
import { useAtom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

const profileAtom = atomWithStorage<ProfileResponse | undefined>("profile", undefined, createJSONStorage(() => sessionStorage));

export function useSessionProfile() {
  return useAtom(profileAtom);
}
