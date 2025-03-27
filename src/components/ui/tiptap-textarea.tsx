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
}: TipTapTextAreaProps) {
  return (
    <>
      {label && <div className="text-sm font-medium text-foreground mb-0">{label}</div>}
      <TipTapRender
        initialValue={initialValue}
        onChange={onChange}
        className={cn(
          "custom-scrollbar bg-foreground/5 px-3 py-2",
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
      />
    </>
  );
}
