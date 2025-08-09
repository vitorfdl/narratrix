import { LightbulbIcon } from "lucide-react";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hints?: string[];
  caseSensitive?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, hints, caseSensitive = false, value, defaultValue, onChange, ...props }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>(value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : "");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isControlled = value !== undefined;

  // Sync with external value prop changes for controlled components
  useEffect(() => {
    if (isControlled && value !== inputValue) {
      setInputValue(String(value || ""));
    }
  }, [value, isControlled, inputValue]);

  // Filter hints based on input value
  const filteredHints = useMemo(() => {
    if (!hints || hints.length === 0) {
      return [];
    }
    if (!inputValue) {
      return hints;
    }

    const currentValue = inputValue.trim();
    if (!currentValue) {
      return hints;
    }

    return hints.filter((hint) => {
      if (caseSensitive) {
        return hint.includes(currentValue);
      }
      return hint.toLowerCase().includes(currentValue.toLowerCase());
    });
  }, [hints, inputValue, caseSensitive]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Only update internal state if uncontrolled
    if (!isControlled) {
      setInputValue(newValue);
    }

    // Open dropdown if we have hints and input is not empty
    if (hints && hints.length > 0) {
      if (newValue.trim()) {
        setIsOpen(true);
      } else {
        // Show all hints if input is cleared
        setIsOpen(true);
      }
    }

    // Pass the event to parent's onChange handler
    onChange?.(e);
  };

  const handleHintSelect = (hint: string) => {
    // Only update internal state if uncontrolled
    if (!isControlled) {
      setInputValue(hint);
    }

    setIsOpen(false);

    // Create a synthetic event to pass to onChange
    const input = document.createElement("input");
    input.value = hint;

    const event = {
      target: input,
      currentTarget: input,
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    onChange?.(event);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close dropdown if no filtered hints
  useEffect(() => {
    if (filteredHints.length === 0 && inputValue) {
      setIsOpen(false);
    }
  }, [filteredHints, inputValue]);

  // Get the correct value to display
  const displayValue = isControlled ? value : inputValue;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <input
          type={type}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="on"
          aria-autocomplete="none"
          spellCheck="false"
          className={cn(
            "flex h-7 w-full rounded-sm input-fields px-3 py-1/2 text-foreground text-xs font-mono ",
            "transition-all duration-100",
            "outline-none ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            hints && hints.length > 0 ? "pr-7" : "",
            className,
          )}
          ref={ref}
          onClick={() => hints && hints.length > 0 && setIsOpen(true)}
          onChange={handleChange}
          value={displayValue}
          {...props}
        />
        {hints && hints.length > 0 && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
            <LightbulbIcon size={16} className={cn("transition-colors duration-200", isOpen ? "text-primary" : "text-muted-foreground/70")} />
          </div>
        )}
      </div>

      {filteredHints.length > 0 && isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-sm shadow-md max-h-[200px] overflow-y-auto">
          <div className="px-3 py-1 text-[10px] text-muted-foreground/70 bg-muted/30 border-b border-border">Suggestions (or type your own)</div>
          {filteredHints.map((hint) => (
            <div key={hint} className="px-3 py-2 text-xs cursor-pointer hover:bg-accent transition-colors flex items-center gap-2" onClick={() => handleHintSelect(hint)}>
              <div className="w-1 h-1 rounded-full bg-primary/60" />
              <span>{hint}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
Input.displayName = "Input";

export { Input };
