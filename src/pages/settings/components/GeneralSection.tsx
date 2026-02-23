import React from "react";
import { LuEyeOff, LuGlobe } from "react-icons/lu";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AppSettings } from "@/schema/profiles-schema";
import { SettingCollapsible, SettingItem, SettingSection } from "./ui/setting-section";

/**
 * Props for the GeneralSection component.
 */
interface GeneralSectionProps {
  settings: AppSettings;
  onSettingChange: (section: keyof AppSettings, key: string, value: unknown) => void;
}

/**
 * General settings section for the settings page.
 */
export const GeneralSection: React.FC<GeneralSectionProps> = ({ settings, onSettingChange }) => {
  return (
    <SettingSection title="General">
      <SettingItem icon={<LuGlobe className="w-4 h-4" />} label="Language">
        <Select value={settings.general.language} onValueChange={(value) => onSettingChange("general", "language", value)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </SettingItem>

      <Separator />

      <SettingCollapsible icon={<LuEyeOff className="w-4 h-4" />} label="Censorship Settings">
        <Separator />
        <SettingItem label="Censored Words" labelClassName="w-40">
          <CommandTagInput value={settings.censorship.customWords} maxTags={50} onChange={(value) => onSettingChange("censorship", "customWords", value)} />
        </SettingItem>
      </SettingCollapsible>
    </SettingSection>
  );
};
