import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
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
  selectedValue?: string;
}

export function Combobox({ items, onChange, trigger, placeholder = "Search...", selectedValue }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
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
        </Command>
      </PopoverContent>
    </Popover>
  );
}
