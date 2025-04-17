import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppSettings } from "@/schema/profiles-schema";
import { Palette } from "lucide-react";
import React from "react";
import { SettingItem, SettingSection } from "./ui/setting-section";

/**
 * Props for the AppearanceSection component.
 */
interface AppearanceSectionProps {
  settings: AppSettings;
  onSettingChange: (section: keyof AppSettings, key: string, value: any) => void;
}

/**
 * Appearance settings section for the settings page.
 */
export const AppearanceSection: React.FC<AppearanceSectionProps> = ({ settings, onSettingChange }) => {
  return (
    <SettingSection title="Appearance">
      <SettingItem icon={<Palette className="w-4 h-4" />} label="Theme">
        <Select value={settings.appearance.theme} onValueChange={(value) => onSettingChange("appearance", "theme", value)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </SettingItem>
    </SettingSection>
  );
};
