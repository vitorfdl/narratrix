import { ProfileResponse } from "@/schema/profiles-schema";
import { useAtom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

const profileAtom = atomWithStorage<ProfileResponse | undefined>(
  "profile",
  undefined,
  createJSONStorage(() => sessionStorage),
);

const currentTabAtom = atomWithStorage<string | undefined>(
  "currentTab",
  undefined,
  createJSONStorage(() => sessionStorage),
);

const currentFormatTemplateAtom = atomWithStorage<string | null>(
  "currentFormatTemplate",
  null,
  createJSONStorage(() => sessionStorage),
);

export function useSessionProfile() {
  return useAtom(profileAtom);
}

export function useSessionCurrentTab() {
  return useAtom(currentTabAtom);
}

export function useSessionCurrentFormatTemplate() {
  return useAtom(currentFormatTemplateAtom);
}
