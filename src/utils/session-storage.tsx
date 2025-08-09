import { useAtom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { ProfileResponse } from "@/schema/profiles-schema";

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

const currentInferenceTemplateAtom = atomWithStorage<string | null>(
  "currentInferenceTemplate",
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

export function useSessionCurrentInferenceTemplate() {
  return useAtom(currentInferenceTemplateAtom);
}
