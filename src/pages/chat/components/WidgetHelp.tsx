import { useCurrentProfile } from "@/hooks/ProfileStore";
import { Command } from "lucide-react";
import React from "react";
import shortcutsDoc from "./shortcuts_doc.json";

// Define types for better structure
interface ShortcutKey {
  type: "key" | "icon" | "separator";
  value: string; // Key name, icon name ('Command'), or separator character ('/')
}

interface ShortcutItem {
  label: string;
  keys: ShortcutKey[];
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

// Helper function to render individual key elements
const RenderKey: React.FC<{ shortcutKey: ShortcutKey; kbdClass: string }> = ({ shortcutKey, kbdClass }) => {
  switch (shortcutKey.type) {
    case "key": {
      return <kbd className={kbdClass}>{shortcutKey.value}</kbd>;
    }
    case "icon": {
      // Currently only supports Command icon
      return (
        <kbd className={kbdClass}>
          <Command className="w-4 h-4" />
        </kbd>
      );
    }
    case "separator": {
      return <span className="text-xs mx-0.5">{shortcutKey.value}</span>;
    }
    default: {
      return null;
    }
  }
};

/**
 * WidgetHelp displays a list of keyboard shortcuts grouped by section.
 *
 * @param sendShortcut Optional string to override the default send message shortcut (e.g., "Ctrl+Enter").
 */
export const WidgetHelp: React.FC = () => {
  const currentProfile = useCurrentProfile();
  const kbdClass = "px-2 py-1 text-xs font-sans font-semibold text-muted-foreground bg-muted border border-border rounded-md min-w-[2.5rem] h-[1.75rem] inline-flex items-center justify-center";

  const sendShortcut = currentProfile?.settings.chat.sendShortcut || "Ctrl+Enter"; // Default to Ctrl+Enter
  // Helper to generate keys for Send Message dynamically
  const getSendMessageKeys = (): ShortcutKey[] => {
    if (!sendShortcut) {
      return [
        { type: "key", value: "Ctrl" },
        { type: "separator", value: "+" },
        { type: "key", value: "Enter" },
      ];
    }
    const shortcutParts = sendShortcut.split("+");
    const mainKey = shortcutParts.pop();
    const modifierKeys = shortcutParts;
    const keys: ShortcutKey[] = [];
    modifierKeys.forEach((key) => {
      keys.push({ type: key.toUpperCase() === "CMD" || key.toUpperCase() === "META" ? "icon" : "key", value: key });
      keys.push({ type: "separator", value: "+" });
    });
    if (mainKey) {
      keys.push({ type: "key", value: mainKey });
    }
    // Remove trailing separator if present
    if (keys.length > 1 && keys[keys.length - 2].type === "separator") {
      keys.splice(keys.length - 2, 1);
    }
    return keys;
  };

  // Prepare shortcut sections and update Send Message shortcut dynamically
  const sections: ShortcutSection[] = shortcutsDoc as ShortcutSection[];
  const sendMessageSection = sections.find((section) => section.title === "Generation Input");
  const sendMessageShortcut = sendMessageSection?.shortcuts.find((shortcut) => shortcut.label === "Send Message");
  if (sendMessageShortcut) {
    sendMessageShortcut.keys = getSendMessageKeys();
  }

  return (
    <div className="w-full p-16 @container">
      <h3 className="text-center mb-5 font-medium text-base text-foreground/70">Keyboard Shortcuts:</h3>
      <div className="grid grid-cols-1 @xl:grid-cols-2 gap-x-10 gap-y-4">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col space-y-3">
            <div className="border-b border-border pb-1 text-center font-semibold text-primary/50">{section.title}</div>
            {section.shortcuts.map((shortcut) => (
              <div key={`${section.title}-${shortcut.label}`} className="flex justify-between items-center space-x-2 min-h-[28px]">
                <span className="mr-2 whitespace-nowrap text-foreground/80">{shortcut.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {shortcut.keys.map((key, keyIndex) => (
                    <RenderKey key={`${section.title}-${shortcut.label}-${key.type}-${key.value}-${keyIndex}`} shortcutKey={key} kbdClass={kbdClass} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
