import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { Input } from "./input";

interface StringArrayProps {
  values?: string[];
  onChange?: (values: string[]) => void;
  className?: string;
  placeholder?: string;
}

export function StringArray({ values = [""], placeholder = "Enter text...", onChange, className = "" }: StringArrayProps) {
  const [strings, setStrings] = useState<string[]>(values.length > 0 ? values : [""]);
  const isInternalChange = useRef(false);
  const prevValuesRef = useRef<string[]>(values);

  // Sync internal state when props change externally
  useEffect(() => {
    // Skip if the change originated from within this component
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    // Check if values actually changed to avoid unnecessary updates
    const prevValues = prevValuesRef.current;
    const valuesChanged = prevValues.length !== values.length || values.some((val, idx) => val !== prevValues[idx]);

    if (valuesChanged) {
      setStrings(values.length > 0 ? values : [""]);
      prevValuesRef.current = [...values];
    }
  }, [values]);

  // Handlers for user interactions
  const handleChange = (newStrings: string[]) => {
    isInternalChange.current = true;
    setStrings(newStrings);
    prevValuesRef.current = newStrings;
    onChange?.(newStrings);
  };

  const addNewString = () => {
    handleChange([...strings, ""]);
  };

  const removeString = (index: number) => {
    if (strings.length <= 1) {
      return; // Prevent removing the last input
    }
    const newStrings = strings.filter((_, i) => i !== index);
    handleChange(newStrings);
  };

  const updateString = (index: number, value: string) => {
    const newStrings = [...strings];
    newStrings[index] = value;
    handleChange(newStrings);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {strings.map((str, index) => (
        <div key={index} className="flex gap-2">
          <Input value={str} onChange={(e) => updateString(index, e.target.value)} className="flex-1" placeholder={placeholder} />
          {strings.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => removeString(index)}
              className="h-5 w-5 hover:bg-destructive hover:text-destructive-foreground"
            >
              <Minus className="h-4 w-4" />
            </Button>
          )}
          {index === strings.length - 1 && (
            <Button variant="outline" size="icon" onClick={addNewString} className="h-7 w-7">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
