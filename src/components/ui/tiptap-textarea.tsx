import { cn } from "@/lib/utils";
import { TipTapRender } from "./tiptap/tiptap-render";

interface TipTapTextAreaProps {
  initialValue?: string;
  onChange?: (content: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  editable?: boolean;
  disableRichText?: boolean;
  suggestions?: any[];
  sendShortcut?: "Enter" | "Ctrl+Enter" | "Shift+Enter" | "CMD+Enter";
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function TipTapTextArea({
  initialValue = "",
  onChange,
  className,
  label,
  placeholder,
  editable = true,
  disableRichText = false,
  suggestions = [],
  sendShortcut,
  onSubmit,
}: TipTapTextAreaProps) {
  return (
    <div className="flex flex-col h-full">
      {label && <div className="text-sm font-medium text-foreground mb-0 flex-none">{label}</div>}
      <div className="flex-1 min-h-0 relative">
        <TipTapRender
          initialValue={initialValue}
          onChange={onChange}
          className={cn(
            "custom-scrollbar h-full absolute inset-0 bg-foreground/5 px-3 py-2 overflow-auto",
            "border-0 border-b-2 border-b-primary/20",
            "transition-[border] duration-100",
            "focus-within:border-b-primary focus-within:bg-accent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          label={label}
          placeholder={placeholder}
          editable={editable}
          disableRichText={disableRichText}
          suggestions={suggestions}
          sendShortcut={sendShortcut}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
