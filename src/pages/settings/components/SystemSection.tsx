import { AppSettings } from "@/schema/profiles-schema";
import { Download } from "lucide-react";
import React from "react";
import { SettingItem, SettingSection } from "./ui/setting-section";

/**
 * Props for the SystemSection component.
 */
interface SystemSectionProps {
  settings: AppSettings;
  onSettingChange: (section: keyof AppSettings, key: string, value: any) => void;
}

/**
 * System settings section for the settings page.
 */
export const SystemSection: React.FC<SystemSectionProps> = () => {
  return (
    <SettingSection title="System">
      <SettingItem icon={<Download className="w-4 h-4" />} label="Updates">
        <div className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">Move to page Settings {">>"} Updates</div>
      </SettingItem>

      {/* <SettingItem label="Debug Mode" htmlFor="system-debug">
        <Switch
          id="system-debug"
          checked={settings.system.debugMode}
          onCheckedChange={(checked) => onSettingChange("system", "debugMode", !!checked)}
        />
      </SettingItem> */}

      {/* <SettingItem label="Automatic Updates" htmlFor="system-autoupdate">
        <Switch
          id="system-autoupdate"
          checked={settings.system.autoUpdate}
          onCheckedChange={(checked) => onSettingChange("system", "autoUpdate", !!checked)}
        />
      </SettingItem> */}
    </SettingSection>
  );
};
