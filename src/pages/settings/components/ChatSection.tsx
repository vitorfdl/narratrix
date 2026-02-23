import { Howl } from "howler";
import React, { useCallback, useRef } from "react";
import { LuCircleUser, LuHighlighter, LuKeyboard, LuMessageSquare, LuPlay } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StepButton } from "@/components/ui/step-button";
import { Switch } from "@/components/ui/switch";
import type { AppSettings, DelimiterHighlighting } from "@/schema/profiles-schema";
import { SettingCollapsible, SettingItem, SettingSection } from "./ui/setting-section";

interface ChatSectionProps {
  settings: AppSettings;
  onSettingChange: (section: keyof AppSettings, key: string, value: unknown) => void;
}

const DEFAULT_DELIMITER_HIGHLIGHTING: DelimiterHighlighting = {
  quoteDouble: true,
  quoteLeft: true,
  brace: true,
  dashEm: true,
};

export const ChatSection: React.FC<ChatSectionProps> = ({ settings, onSettingChange }) => {
  const soundRef = useRef<Howl | null>(null);

  const avatarBorderRadius: number =
    typeof settings.chat.avatarBorderRadius === "number" && !Number.isNaN(settings.chat.avatarBorderRadius)
      ? Math.min(50, Math.max(0, settings.chat.avatarBorderRadius))
      : 50;

  const delimiterHighlighting: DelimiterHighlighting = settings.appearance.delimiterHighlighting ?? DEFAULT_DELIMITER_HIGHLIGHTING;

  const handlePreviewBeep = useCallback(() => {
    try {
      if (soundRef.current) {
        soundRef.current.stop();
      }
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
        onloaderror: (_id: unknown, err: unknown) => {
          console.error(`Failed to load sound: ${soundPath}`, err);
        },
        onplayerror: (_id: unknown, err: unknown) => {
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
    <SettingSection title="Chat / Messages">
      <SettingCollapsible icon={<LuCircleUser className="w-4 h-4" />} label="Avatars">
        <Separator />
        <SettingItem label="Show Avatars" htmlFor="show-avatars">
          <Switch id="show-avatars" checked={settings.chat.showAvatars} onCheckedChange={(checked) => onSettingChange("chat", "showAvatars", !!checked)} />
        </SettingItem>
        <Separator />
        <SettingItem label="Border Radius">
          <div className="flex items-center gap-3">
            <span
              className={`ml-2 px-2 py-0.5 rounded text-xxs text-muted-foreground font-medium border transition-colors
                ${avatarBorderRadius === 50 ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-border"}`}
              aria-label="Default avatar border radius indicator"
            >
              Default (50%)
            </span>
            <StepButton className="w-24" min={0} max={50} step={5} value={avatarBorderRadius} onValueChange={(value) => onSettingChange("chat", "avatarBorderRadius", value)} />
          </div>
        </SettingItem>
      </SettingCollapsible>

      <Separator />

      <SettingItem icon={<LuMessageSquare className="w-4 h-4" />} label="Beep sound when message ends">
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
            <LuPlay className="!w-4 !h-4" />
          </Button>
        </div>
      </SettingItem>

      <Separator />

      <SettingCollapsible icon={<LuKeyboard className="w-4 h-4" />} label="Shortcuts">
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
