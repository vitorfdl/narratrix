import { Dice6 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

interface RandomButtonProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number;
  min?: number;
  max?: number;
  onValueChange: (value: number) => void;
  className?: string;
}

export function RandomButton({ value, min = 0, max = 100, onValueChange, className, ...props }: RandomButtonProps) {
  const [, setIsFocused] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(value.toString());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleRandomize = () => {
    const newValue = Math.floor(Math.random() * (max - min + 1)) + min;
    onValueChange(newValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Only blur if the focus is leaving the container entirely
    const currentTarget = e.currentTarget;
    requestAnimationFrame(() => {
      if (!currentTarget.contains(document.activeElement)) {
        setIsFocused(false);
        let newValue = Number.parseFloat(localValue);

        if (Number.isNaN(newValue)) {
          setLocalValue(value.toString());
          return;
        }

        if (min !== undefined && newValue < min) {
          newValue = min;
        }
        if (max !== undefined && newValue > max) {
          newValue = max;
        }

        onValueChange(newValue);
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty value or minus sign for typing flexibility
    if (value === "" || value === "-") {
      setLocalValue(value);
      return;
    }

    // Only allow numbers and decimal point
    if (/^-?\d*\.?\d*$/.test(value)) {
      const numValue = Number.parseFloat(value);
      if (!Number.isNaN(numValue)) {
        // If the value is a valid number, check against min/max
        if ((min === undefined || numValue >= min) && (max === undefined || numValue <= max)) {
          setLocalValue(value);
        }
      } else {
        setLocalValue(value); // Allow incomplete decimal numbers like "1."
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
  };

  const handleButtonMouseDown = (e: React.MouseEvent) => {
    // Prevent default to avoid losing focus
    e.preventDefault();
  };

  return (
    <div ref={containerRef} className={cn("group relative inline-block w-full", className)} onBlur={handleBlur} tabIndex={-1}>
      <div className="relative">
        <Input
          {...props}
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="-?\d*\.?\d*"
          value={localValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          className="pr-9"
        />
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
          <Button variant="ghost" size="icon" className="h-5 w-5 p-0 hover:bg-accent" onClick={handleRandomize} onMouseDown={handleButtonMouseDown}>
            <Dice6 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
