import { Tag as TagIcon, X } from "lucide-react";
import { KeyboardEvent, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  className?: string;
}

export function CommandTagInput({ value = [], onChange, suggestions = [], placeholder = "Add tags...", maxTags = 10, disabled = false, className }: TagInputProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const trimmedInput = inputValue.trim();

    if (e.key === "Enter" && trimmedInput !== "") {
      // If the suggestion list is open and has items, let cmdk handle Enter.
      if (open && filteredSuggestions.length > 0) {
        // Potentially check if an item is highlighted if needed, but cmdk should handle this.
        // No preventDefault() here.
      } else {
        // If list is closed or empty, prevent default and add the tag.
        e.preventDefault();
        addTag(trimmedInput);
      }
    }

    // Remove last tag on backspace if input is empty
    if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      // Potentially preventDefault if needed, but backspace usually doesn't trigger form submission.
      onChange(value.slice(0, -1));
    }
  };

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase(); // Normalize tags
    if (normalizedTag === "" || value.length >= maxTags || value.map((t) => t.toLowerCase()).includes(normalizedTag)) {
      setInputValue(""); // Clear input even if tag wasn't added
      return;
    }

    onChange([...value, tag.trim()]); // Keep original casing for display
    setInputValue("");
    // Optionally close the list after adding a tag?
    // setOpen(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const filteredSuggestions = suggestions.filter((suggestion) => !value.map((t) => t.toLowerCase()).includes(suggestion.toLowerCase()) && suggestion.toLowerCase().includes(inputValue.toLowerCase()));

  // Determine if the command list should be shown
  const showCommandList = open && inputValue.length > 0 && filteredSuggestions.length > 0;

  return (
    <div className="flex flex-col gap-2 w-full bg-none">
      <Command shouldFilter={false} className="relative overflow-visible bg-transparent">
        {" "}
        {/* Ensure Command allows overflow */}
        <div
          className={cn(
            "flex flex-wrap gap-x-2 gap-y-1 items-center w-full rounded-sm px-3 py-1 min-h-7", // Adjusted vertical padding and height
            "input-fields ",
            "transition-all duration-100",
            "focus-within:border-b-primary focus-within:bg-transparent/15", // Use focus-within for container focus
            disabled ? "cursor-not-allowed opacity-50" : "cursor-text", // Add disabled style and cursor
            className,
          )}
          onClick={() => !disabled && inputRef.current?.focus()} // Prevent focus when disabled
        >
          {/* Optional: Adjust Icon style/placement if needed */}
          <TagIcon className="h-4 w-4 text-muted-foreground/70 mr-1 shrink-0" />

          {value.map((tag) => (
            <Badge
              key={tag}
              variant="default"
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] h-5" // Slightly smaller badge
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent click from focusing input
                  if (!disabled) {
                    removeTag(tag);
                  }
                }}
                disabled={disabled}
                aria-label={`Remove ${tag} tag`}
                className="rounded-full bg-muted text-foreground p-0.5 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <X className="h-2.5 w-2.5" /> {/* Slightly smaller X */}
              </button>
            </Badge>
          ))}

          {/* Replace CommandInput with a standard input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              // Update onChange to handle standard input event
              setInputValue(e.target.value);
              setOpen(true); // Keep open while typing
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled || value.length >= maxTags}
            placeholder={value.length >= maxTags ? "Tag limit reached" : placeholder}
            className={cn(
              "flex-1 border-0 p-0 focus:ring-0 focus:outline-none text-xs font-mono bg-transparent min-w-[80px]", // Adjusted font, min-width
              "placeholder:text-muted-foreground/40 placeholder:italic", // Placeholder style like Input
            )}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)} // Delay blur to allow selection
          />
        </div>
        {/* Use absolute positioning relative to the Command container */}
        {showCommandList && (
          // Match Input dropdown style
          <CommandList className="absolute top-full mt-1 w-full z-50 bg-background border border-border rounded-sm shadow-md max-h-[200px] overflow-y-auto">
            <CommandEmpty className="px-3 py-2 text-xs text-muted-foreground">No matching tags found</CommandEmpty>
            <CommandGroup>
              {/* Optional: Add header like Input hints */}
              {/* <div className="px-3 py-1 text-[10px] text-muted-foreground/70 bg-muted/30 border-b border-border">Suggestions</div> */}
              {filteredSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  value={suggestion} // Add value for cmdk filtering/selection
                  onSelect={() => {
                    addTag(suggestion);
                    // setOpen(false); // Close after selection? Input hints don't auto-close
                  }}
                  // Match Input hint item style
                  className="px-3 py-1.5 text-xs cursor-pointer hover:bg-accent transition-colors flex items-center gap-2"
                >
                  {/* Optional: Add indicator like Input hints */}
                  {/* <div className="w-1 h-1 rounded-full bg-primary/60" /> */}
                  <span>{suggestion}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
      </Command>

      {value.length >= maxTags && <p className="text-xs text-muted-foreground">Maximum of {maxTags} tags reached</p>}
    </div>
  );
}
