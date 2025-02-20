import React, { useCallback, KeyboardEvent } from "react";
import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Wand2, SpellCheck2, Languages } from "lucide-react";

interface WidgetGenerateProps {
    onSubmit?: (text: string) => void;
}

const WidgetGenerate: React.FC<WidgetGenerateProps> = ({ onSubmit }) => {
    const [text, setText] = React.useState("");
    const [autoTranslate, setAutoTranslate] = React.useState(false);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Check for Ctrl/Cmd + Enter
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit?.(text);
            setText("");
        }
    }, [text, onSubmit]);

    const handleImpersonate = useCallback(() => {
        const prefix = "/impersonate ";
        setText((prev) => prev.startsWith(prefix) ? prev : `${prefix}${prev}`);
    }, []);

    const handleSpellCheck = useCallback(() => {
        // TODO: Implement spellcheck functionality
        console.log("Spellcheck clicked");
    }, []);

    return (
        <div className="flex h-full flex-col gap-1 p-1">
            <ResizableTextarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-[90%]"
                placeholder="Type your message here... (Ctrl/Cmd + Enter to send)"
            />
            <div className="flex items-center gap-2 px-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleImpersonate}
                    title="Impersonate"
                >
                    <Wand2 className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSpellCheck}
                    title="Spell Check"
                >
                    <SpellCheck2 className="w-4 h-4" />
                </Button>
                <Toggle
                    pressed={autoTranslate}
                    onPressedChange={setAutoTranslate}
                    title="Auto Translate"
                    size="sm"
                >
                    <Languages className="w-4 h-4" />
                </Toggle>
            </div>
        </div>
    );
};

export default WidgetGenerate;
  
  