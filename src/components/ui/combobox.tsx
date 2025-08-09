import { Check, Star, X } from "lucide-react";
import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  label: string;
  value: string;
  disabled?: boolean;
  hint?: string;
  favorite?: boolean;
  onFavoriteToggle?: () => void;
}

interface ComboboxProps {
  items: ComboboxItem[];
  onChange: (value: string | null) => void;
  trigger: React.ReactNode;
  placeholder?: string;
  selectedValue?: string | null;
  clearable?: boolean;
}

export function Combobox({ items, onChange, trigger, placeholder = "Search...", selectedValue, clearable = false }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const handleClear = React.useCallback(() => {
    onChange(null);
    setOpen(false);
  }, [onChange]);

  const handleItemSelect = React.useCallback(
    (value: string) => {
      onChange(value);
      setOpen(false);
    },
    [onChange],
  );

  const handleFavoriteClick = React.useCallback((e: React.MouseEvent, onFavoriteToggle?: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (onFavoriteToggle) {
      onFavoriteToggle();
    }
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="p-0 z-[60]"
        style={{ width: "var(--radix-popover-trigger-width)", minWidth: "200px" }}
        align="start"
        onWheel={(e) => {
          // Ensure wheel events are handled properly within the popover
          e.stopPropagation();
        }}
      >
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>

            {/* Clear option when clearable and has selection */}
            {clearable && selectedValue && (
              <CommandGroup>
                <CommandItem onSelect={handleClear} className="flex items-center text-muted-foreground hover:text-foreground border-b border-border">
                  <X className="mr-2 h-4 w-4" />
                  Clear selection
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  keywords={[item.label, item.hint].filter(Boolean) as string[]}
                  onSelect={() => {
                    if (!item.disabled) {
                      handleItemSelect(item.value);
                    }
                  }}
                  disabled={item.disabled}
                  className={cn("flex justify-between items-center w-full group", item.disabled ? "cursor-not-allowed opacity-50" : "")}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    {item.onFavoriteToggle && (
                      <button
                        onClick={(e) => handleFavoriteClick(e, item.onFavoriteToggle)}
                        className={cn("p-0 mr-2 rounded-sm transition-colors hover:bg-accent/50 opacity-0 group-hover:opacity-100", item.favorite && "opacity-100")}
                        title={item.favorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star className={cn("h-3 w-3 transition-colors", item.favorite ? "fill-muted-foreground text-muted-foreground" : "text-muted-foreground hover:text-foreground")} />
                      </button>
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className={cn("truncate p-0 m-0", item.disabled ? "line-through" : "")}>{item.label}</span>
                      {item.hint && <span className="text-xs text-muted-foreground truncate">{item.hint}</span>}
                    </div>
                  </div>

                  <Check className={cn("h-2 w-2 ml-0", selectedValue === item.value ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
