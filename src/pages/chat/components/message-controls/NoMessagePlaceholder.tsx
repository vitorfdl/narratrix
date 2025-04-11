import { ProfileResponse } from "@/schema/profiles-schema";
import { Command } from "lucide-react";
import React from "react";

interface NoMessagePlaceholderProps {
  currentProfile: ProfileResponse | null;
}

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
    case "key":
      return <kbd className={kbdClass}>{shortcutKey.value}</kbd>;
    case "icon":
      // Currently only supports Command icon
      return (
        <kbd className={kbdClass}>
          <Command className="w-3.5 h-3.5" />
        </kbd>
      );
    case "separator":
      return <span className="text-xs mx-0.5">{shortcutKey.value}</span>;
    default:
      return null;
  }
};

export const NoMessagePlaceholder: React.FC<NoMessagePlaceholderProps> = ({ currentProfile }) => {
  const kbdClass = "px-2 py-1 text-xs font-sans font-semibold text-muted-foreground bg-muted border border-border rounded-md";
  const sendShortcut = currentProfile?.settings.chat.sendShortcut || "Ctrl+Enter"; // Default to Ctrl+Enter
  const shortcutParts = sendShortcut.split("+");
  const mainKey = shortcutParts.pop();
  const modifierKeys = shortcutParts;

  // Helper to generate keys for Send Message dynamically
  const getSendMessageKeys = (): ShortcutKey[] => {
    const keys: ShortcutKey[] = [];
    modifierKeys.forEach((key) => {
      // Handle potential 'Cmd' or 'Meta' keys which should render the Command icon
      keys.push({ type: key.toUpperCase() === "CMD" || key.toUpperCase() === "META" ? "icon" : "key", value: key });
    });
    if (mainKey) {
      keys.push({ type: "key", value: mainKey });
    }
    return keys;
  };

  // Define shortcut sections and items data
  const sections: ShortcutSection[] = [
    {
      title: "General",
      shortcuts: [
        {
          label: "Toggle Live Inspector",
          keys: [
            { type: "key", value: "Ctrl" },
            { type: "separator", value: "/" },
            { type: "icon", value: "Command" },
            { type: "key", value: "'" },
          ],
        }, // Corrected apostrophe key
        {
          label: "Close Current Tab",
          keys: [
            { type: "key", value: "Ctrl" },
            { type: "separator", value: "/" },
            { type: "icon", value: "Command" },
            { type: "key", value: "W" },
          ],
        },
      ],
    },
    {
      title: "Generation Input",
      shortcuts: [
        { label: "Focus ", keys: [{ type: "key", value: "Tab" }] },
        { label: "Send Message", keys: getSendMessageKeys() },
        { label: "Access Input History", keys: [{ type: "key", value: "Up" }] },
        // {
        //   label: "Edit Last Message",
        //   keys: [
        //     { type: "key", value: "Ctrl" },
        //     { type: "key", value: "Up" },
        //   ],
        // },
      ],
    },
    // Add more sections here in the future by extending the 'sections' array
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-sm @container">
      <div className="text-muted-foreground text-center mb-6">No messages yet. Start the conversation by sending a message.</div>
      <div className="w-full max-w-[90%] xl:max-w-[800px] px-4">
        <h3 className="text-center mb-5 font-medium text-base">Keyboard Shortcuts:</h3>

        <div className="grid grid-cols-1 @xl:grid-cols-2 gap-x-10 gap-y-4">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col space-y-3">
              {/* Section Header */}
              <div className="border-b border-border pb-1 text-center font-semibold text-primary">{section.title}</div>
              {/* Section Shortcuts */}
              {section.shortcuts.map((shortcut) => (
                <div key={`${section.title}-${shortcut.label}`} className="flex justify-between items-center space-x-2 min-h-[28px]">
                  {" "}
                  {/* Improved key uniqueness */}
                  <span className="mr-2 whitespace-nowrap">{shortcut.label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {shortcut.keys.map((key, keyIndex) => (
                      // Use a more robust key including section, shortcut label, and key index
                      <RenderKey
                        key={`${section.title}-${shortcut.label}-${key.type}-${key.value}-${keyIndex}`}
                        shortcutKey={key}
                        kbdClass={kbdClass}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
