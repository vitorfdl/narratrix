import React from "react";
import { LuALargeSmall, LuHighlighter, LuPalette } from "react-icons/lu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StepButton } from "@/components/ui/step-button";
import { Switch } from "@/components/ui/switch";
import { useThemeStore } from "@/hooks/ThemeContext";
import type { AppSettings, DelimiterHighlighting } from "@/schema/profiles-schema";
import { SettingCollapsible, SettingItem, SettingSection } from "./ui/setting-section";

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
const DEFAULT_DELIMITER_HIGHLIGHTING: DelimiterHighlighting = {
  quoteDouble: true,
  quoteLeft: true,
  brace: true,
  dashEm: true,
};

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({ settings, onSettingChange }) => {
  // Ensure fontSize is always a valid number within allowed range (12-24), fallback to 16 if invalid
  const fontSize: number = typeof settings.appearance.fontSize === "number" && !Number.isNaN(settings.appearance.fontSize) ? Math.min(24, Math.max(12, settings.appearance.fontSize)) : 16;

  const delimiterHighlighting: DelimiterHighlighting = settings.appearance.delimiterHighlighting ?? DEFAULT_DELIMITER_HIGHLIGHTING;

  // Get the original browser font size from ThemeContext
  const originalFontSize = useThemeStore((state) => state.originalFontSize);

  return (
    <SettingSection title="Appearance">
      <SettingItem icon={<LuPalette className="w-4 h-4" />} label="Theme">
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

      <SettingItem icon={<LuALargeSmall className="w-4 h-4" />} label="Font Size">
        <div className="flex items-center gap-3">
          <span
            className={`ml-2 px-2 py-0.5 rounded text-xxs text-muted-foreground font-medium border transition-colors
              ${fontSize === 16 ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-border"}`}
            aria-label="Default font size indicator"
          >
            Default ({originalFontSize}px)
          </span>
          <StepButton className="w-24" min={12} max={24} step={1} value={fontSize} onValueChange={(value) => onSettingChange("appearance", "fontSize", value)} />
        </div>
      </SettingItem>

      <Separator />

      <SettingCollapsible icon={<LuHighlighter className="w-4 h-4" />} label="Text Highlighting">
        <Separator />
        <SettingItem label={'Double Quotes "..."'} htmlFor="highlight-quote-double">
          <Switch
            id="highlight-quote-double"
            checked={delimiterHighlighting.quoteDouble}
            onCheckedChange={(checked) => onSettingChange("appearance", "delimiterHighlighting", { ...delimiterHighlighting, quoteDouble: !!checked } satisfies DelimiterHighlighting)}
          />
        </SettingItem>
        <Separator />
        <SettingItem label={"Curly Quotes \u201C...\u201D"} htmlFor="highlight-quote-left">
          <Switch
            id="highlight-quote-left"
            checked={delimiterHighlighting.quoteLeft}
            onCheckedChange={(checked) => onSettingChange("appearance", "delimiterHighlighting", { ...delimiterHighlighting, quoteLeft: !!checked } satisfies DelimiterHighlighting)}
          />
        </SettingItem>
        <Separator />
        <SettingItem label="Braces {{...}}" htmlFor="highlight-brace">
          <Switch
            id="highlight-brace"
            checked={delimiterHighlighting.brace}
            onCheckedChange={(checked) => onSettingChange("appearance", "delimiterHighlighting", { ...delimiterHighlighting, brace: !!checked } satisfies DelimiterHighlighting)}
          />
        </SettingItem>
        <Separator />
        <SettingItem label={"Em Dash \u2014...\u2014"} htmlFor="highlight-dash-em">
          <Switch
            id="highlight-dash-em"
            checked={delimiterHighlighting.dashEm}
            onCheckedChange={(checked) => onSettingChange("appearance", "delimiterHighlighting", { ...delimiterHighlighting, dashEm: !!checked } satisfies DelimiterHighlighting)}
          />
        </SettingItem>
      </SettingCollapsible>
    </SettingSection>
  );
};
