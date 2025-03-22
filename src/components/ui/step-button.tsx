import { cn } from "@/lib/utilsLib";
import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Slider } from "./slider";

interface StepButtonProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onValueChange: (value: number) => void;
  className?: string;
  showSlider?: boolean;
  ticks?: number; // Number of ticks (undefined means no ticks)
}

export function StepButton({ value, step = 1, min = 0, max = 100, onValueChange, className, showSlider = false, ticks, ...props }: StepButtonProps) {
  const [, setIsFocused] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(value.toString());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleIncrement = () => {
    const newValue = value + step;
    if (max !== undefined && newValue > max) {
      return;
    }
    onValueChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = value - step;
    if (min !== undefined && newValue < min) {
      return;
    }
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

  // Generate tick marks positions and calculate step if ticks are enabled
  const { tickPositions, effectiveStep } = React.useMemo(() => {
    if (!showSlider || !ticks) {
      return { tickPositions: [], effectiveStep: step };
    }

    const positions: number[] = [];
    // Calculate step size based on ticks
    const tickStep = (max - min) / (ticks - 1);

    for (let i = 0; i < ticks; i++) {
      positions.push(min + tickStep * i);
    }

    return {
      tickPositions: positions,
      effectiveStep: tickStep, // When ticks are enabled, step size matches tick intervals
    };
  }, [min, max, ticks, showSlider, step]);

  return (
    <div ref={containerRef} className={cn("group relative", className)} onBlur={handleBlur} tabIndex={-1}>
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
          className="pr-16"
        />
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex flex-row gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 p-0 hover:bg-accent"
            onClick={handleIncrement}
            onMouseDown={handleButtonMouseDown}
            disabled={max !== undefined && value >= max}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 p-0 hover:bg-accent"
            onClick={handleDecrement}
            onMouseDown={handleButtonMouseDown}
            disabled={min !== undefined && value <= min}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {showSlider && (
        <div className="mt-0 px-1">
          <div className="relative">
            <Slider value={[value]} min={min} max={max} step={effectiveStep} onValueChange={(vals) => onValueChange(vals[0])} className="pt-4 pb-2" />
            {tickPositions.length > 0 && (
              <div className="absolute left-0 right-0 bottom-1 flex justify-between pointer-events-none">
                {tickPositions.map((_, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div className="h-1.5 w-0.5 bg-muted-foreground/50" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
