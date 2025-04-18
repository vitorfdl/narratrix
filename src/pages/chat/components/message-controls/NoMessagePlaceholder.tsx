import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import {
  useChatActions,
  useCurrentChatActiveChapterID,
  useCurrentChatChapters,
  useCurrentChatId,
  useCurrentChatParticipants,
} from "@/hooks/chatStore";
import { useInferenceServiceFromContext } from "@/providers/inferenceChatProvider";
import { Command, PencilLine, SendIcon } from "lucide-react";
import React, { useState } from "react";
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
    case "key":
      return <kbd className={kbdClass}>{shortcutKey.value}</kbd>;
    case "icon":
      // Currently only supports Command icon
      return (
        <kbd className={kbdClass}>
          <Command className="w-4 h-4" />
        </kbd>
      );
    case "separator":
      return <span className="text-xs mx-0.5">{shortcutKey.value}</span>;
    default:
      return null;
  }
};

export const NoMessagePlaceholder: React.FC = () => {
  const currentProfile = useCurrentProfile();
  const currentChatChapters = useCurrentChatChapters();
  const activeChapterId = useCurrentChatActiveChapterID();
  const inferenceService = useInferenceServiceFromContext();
  const currentChatParticipants = useCurrentChatParticipants();
  const { addChatMessage } = useChatActions();
  const currentChatId = useCurrentChatId();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentChapter = currentChatChapters.find((chapter) => chapter.id === activeChapterId);

  const kbdClass =
    "px-2 py-1 text-xs font-sans font-semibold text-muted-foreground bg-muted border border-border rounded-md min-w-[2.5rem] h-[1.75rem] inline-flex items-center justify-center";
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
  const sections: ShortcutSection[] = shortcutsDoc as ShortcutSection[];
  const sendMessageShortcut = sections
    .find((section) => section.title === "Generation Input")
    ?.shortcuts.find((shortcut) => shortcut.label === "Send Message");

  sendMessageShortcut!.keys = getSendMessageKeys();

  // Helper: Preview first 3 lines, ellipsize if longer
  const getPreviewLines = (text: string, maxLines = 2): string => {
    const lines = text.split("\n");
    if (lines.length <= maxLines) {
      return text;
    }
    return `${lines.slice(0, maxLines).join("\n")}...`;
  };

  const startMessageAction = async () => {
    setIsSending(true);
    setError(null);
    try {
      if (currentChapter?.custom?.auto_start_message) {
        // Auto-inference mode: use inferenceService to generate the first message
        if (!currentChapter.start_message) {
          throw new Error("No start message defined for this chapter.");
        }
        if (!currentChatParticipants || currentChatParticipants.length === 0) {
          throw new Error("No chat participants available.");
        }
        // Find the first enabled participant for character_id
        const enabledParticipant = currentChatParticipants.find((p) => p.enabled);
        if (!enabledParticipant) {
          throw new Error("No enabled chat participant found.");
        }
        // Create a system message placeholder for the intro (optional, for UI feedback)
        const systemMessage = await addChatMessage({
          character_id: enabledParticipant.id,
          type: "system",
          messages: ["Generating chapter intro..."],
          extra: { script: "start_chapter" },
        });
        // Start inference to generate the intro message
        try {
          await inferenceService.generateMessage({
            existingMessageId: systemMessage.id,
            messageIndex: 0,
            userMessage: currentChapter.start_message,
            characterId: enabledParticipant.id,
            quietUserMessage: true,
            extraSuggestions: {},
          });
        } catch (inferenceError) {
          setError("Failed to generate chapter intro message.");
          // Update the system message to show the error
          await addChatMessage({
            character_id: enabledParticipant.id,
            type: "system",
            messages: ["Failed to generate chapter intro. Please try again."],
            extra: { script: "start_chapter" },
          });
          // Optionally log error
          // eslint-disable-next-line no-console
          console.error(inferenceError);
        }
      } else {
        // Default behavior: just add the system message with the start_message
        await addChatMessage({
          character_id: null,
          type: "system",
          messages: [currentChapter!.start_message!],
          extra: { script: "start_chapter" },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate chapter start message.");
      // Optionally log error
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-sm @container">
      {/* Preview Pane & Actions */}
      {currentChapter?.start_message && (
        <div className="w-full max-w-[90%] xl:max-w-[700px] px-4 flex flex-col items-center mb-6">
          {/* Preview Card */}
          <div className="w-full bg-card border border-border rounded-xl shadow-sm p-4 mb-3 flex flex-col items-start">
            <span className="text-xs font-semibold text-primary/80 mb-1">Chapter Intro Preview</span>
            {/* Render the chapter intro preview using MarkdownTextArea in non-editable mode */}
            <MarkdownTextArea
              initialValue={getPreviewLines(currentChapter.start_message)}
              editable={false}
              className=" text-sm leading-relaxed line-clamp-3 w-full"
              label={undefined}
            />
          </div>
          {/* Action Buttons */}
          <div className="flex flex-row gap-3 w-full justify-center">
            <Button
              size="lg"
              className="ring-2 ring-primary/80 text-primary-foreground  font-semibold shadow animate-in"
              disabled={isSending}
              onClick={startMessageAction}
              aria-label="Send Chapter Intro"
            >
              <SendIcon className="w-4 h-4 mr-2" />
              Start Chapter
            </Button>
          </div>
        </div>
      )}
      {!currentChapter?.start_message && (
        <div className="flex flex-row items-center gap-2 my-6">
          <PencilLine className="w-4 h-4 text-secondary-foreground" />
          <span>Write your own first message</span>
        </div>
      )}
      {/* Error Message */}
      {error && (
        <div className="text-destructive text-center mb-2" role="alert">
          {error}
        </div>
      )}
      {/* Shortcuts Section (faded) */}
      <div className="w-full max-w-[90%] xl:max-w-[800px] px-4 opacity-30">
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
