import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import * as React from "react";

export interface ComboboxItem {
  label: string;
  value: string;
  disabled?: boolean;
  hint?: string;
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
                  className={cn("flex justify-between items-center w-full", item.disabled ? "cursor-not-allowed opacity-50" : "")}
                >
                  <div className="flex flex-col">
                    <span className={item.disabled ? "line-through" : ""}>{item.label}</span>
                    {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
                  </div>
                  <Check className={cn("mr-2 h-4 w-4", selectedValue === item.value ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
