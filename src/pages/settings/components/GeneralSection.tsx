import { Button } from "@/components/ui/button";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AppSettings } from "@/schema/profiles-schema";
import { Howl } from "howler";
import { EyeOff, Globe, MessageSquare, Play } from "lucide-react";
import React, { useCallback, useRef } from "react";
import { SettingCollapsible, SettingItem, SettingSection } from "./ui/setting-section";

/**
 * Props for the GeneralSection component.
 */
interface GeneralSectionProps {
  settings: AppSettings;
  onSettingChange: (section: keyof AppSettings, key: string, value: any) => void;
}

/**
 * General settings section for the settings page.
 */
export const GeneralSection: React.FC<GeneralSectionProps> = ({ settings, onSettingChange }) => {
  // Ref to keep track of the current Howl instance
  const soundRef = useRef<Howl | null>(null);

  /**
   * Plays a preview of the currently selected beep sound.
   */
  const handlePreviewBeep = useCallback(() => {
    try {
      // Stop any currently playing sound
      if (soundRef.current) {
        soundRef.current.stop();
      }
      // Construct the path to the sound file
      const soundName = settings.chat.beepSound;
      if (!soundName || soundName === "none") {
        return;
      }
      const soundPath = `/sounds/${soundName}.mp3`;

      const howl = new Howl({
        src: [soundPath],
        volume: 0.6,
        onend: () => {
          soundRef.current = null;
        },
        onloaderror: (_id: any, err: any) => {
          console.error(`Failed to load sound: ${soundPath}`, err);
        },
        onplayerror: (_id: any, err: any) => {
          console.error(`Failed to play sound: ${soundPath}`, err);
        },
      });
      soundRef.current = howl;
      howl.play();
    } catch (error) {
      console.error("Error playing beep sound preview:", error);
    }
  }, [settings.chat.beepSound]);

  return (
    <SettingSection title="General">
      <SettingItem icon={<Globe className="w-4 h-4" />} label="Language">
        <Select value={settings.general.language} onValueChange={(value) => onSettingChange("general", "language", value)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            {/* Add more languages as needed */}
          </SelectContent>
        </Select>
      </SettingItem>

      <Separator />

      <SettingCollapsible icon={<MessageSquare className="w-4 h-4" />} label="Chat / Messages">
        <Separator />
        <SettingItem label="Beep sound when message ends">
          <div className="flex items-center gap-2">
            <Select value={settings.chat.beepSound} onValueChange={(value) => onSettingChange("chat", "beepSound", value)}>
              <SelectTrigger className="w-36" id="beep-sound">
                <SelectValue placeholder="Select beep sound" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="longbeep4">Default</SelectItem>
                <SelectItem value="beep1">Alt. 1</SelectItem>
                <SelectItem value="beep2">Alt. 2</SelectItem>
                <SelectItem value="longbeep3">Alt. 3</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" size="icon" variant="outline" aria-label="Preview beep sound" onClick={handlePreviewBeep} className="h-7 ml-1" disabled={settings.chat.beepSound === "none"}>
              <Play className="!w-4 !h-4" />
            </Button>
          </div>
        </SettingItem>

        <Separator />
        <SettingItem label="Send Shortcut">
          <Select value={settings.chat.sendShortcut} onValueChange={(value) => onSettingChange("chat", "sendShortcut", value)}>
            <SelectTrigger className="w-36" id="send-shortcut">
              <SelectValue placeholder="Shortcut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Enter">Enter</SelectItem>
              <SelectItem value="Ctrl+Enter">Ctrl+Enter</SelectItem>
              <SelectItem value="Shift+Enter">Shift+Enter</SelectItem>
              <SelectItem value="CMD+Enter">CMD+Enter</SelectItem>
            </SelectContent>
          </Select>
        </SettingItem>
      </SettingCollapsible>
      <Separator />

      <SettingCollapsible icon={<EyeOff className="w-4 h-4" />} label="Censorship Settings">
        <Separator />
        <SettingItem label="Censored Words" labelClassName="w-40">
          <CommandTagInput value={settings.censorship.customWords} maxTags={50} onChange={(value) => onSettingChange("censorship", "customWords", value)} />
        </SettingItem>
      </SettingCollapsible>
    </SettingSection>
  );
};
