import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StepButton } from "@/components/ui/step-button";
import { useThemeStore } from "@/hooks/ThemeContext";
import { AppSettings } from "@/schema/profiles-schema";
import { ALargeSmallIcon, Palette } from "lucide-react";
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
  // Ensure fontSize is always a valid number within allowed range (12-24), fallback to 16 if invalid
  const fontSize: number =
    typeof settings.appearance.fontSize === "number" && !Number.isNaN(settings.appearance.fontSize)
      ? Math.min(24, Math.max(12, settings.appearance.fontSize))
      : 16;

  // Get the original browser font size from ThemeContext
  const originalFontSize = useThemeStore((state) => state.originalFontSize);

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

      <Separator />

      <SettingItem icon={<ALargeSmallIcon className="w-4 h-4" />} label="Font Size">
        <div className="flex items-center gap-3">
          <span
            className={`ml-2 px-2 py-0.5 rounded text-xxs text-muted-foreground font-medium border transition-colors
              ${fontSize === 16 ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-border"}`}
            aria-label="Default font size indicator"
          >
            Default ({originalFontSize}px)
          </span>
          <StepButton
            className="w-24"
            min={12}
            max={24}
            step={1}
            value={fontSize}
            onValueChange={(value) => onSettingChange("appearance", "fontSize", value)}
          />
        </div>
      </SettingItem>
    </SettingSection>
  );
};
