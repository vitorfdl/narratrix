import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepButton } from "@/components/ui/step-button";
import { AppSettings } from "@/schema/profiles-schema";
import { Palette } from "lucide-react";
import React, { useEffect, useState } from "react";
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
  // Local state for global font size (in px)
  const [fontSize, setFontSize] = useState<number>(16);

  // Apply the font size to the root element on change
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

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

      {/* Font Size Slider */}
      <SettingItem label="Font Size">
        <div className="flex items-center space-x-2">
          <StepButton className="w-24" min={12} max={24} step={1} value={fontSize} onValueChange={setFontSize} />
          <span className="text-sm">{fontSize}px</span>
        </div>
      </SettingItem>
    </SettingSection>
  );
};
