import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as React from "react";

export interface ComboboxItem {
  label: string;
  value: string;
  disabled?: boolean;
  hint?: string;
}

interface ComboboxProps {
  items: ComboboxItem[];
  onChange: (value: string) => void;
  trigger: React.ReactNode;
  placeholder?: string;
}

export function Combobox({ items, onChange, trigger, placeholder = "Search..." }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 justify-between" align="end">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandEmpty>No item found.</CommandEmpty>
          <CommandGroup>
            {items.map((item) => (
              <CommandItem
                key={item.value}
                value={item.value}
                onSelect={(currentValue) => {
                  if (!item.disabled) {
                    onChange(currentValue);
                    setOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={`${item.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <div className="flex flex-col">
                  <span className={item.disabled ? "line-through" : ""}>{item.label}</span>
                  {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
