import { useState, useEffect } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Plus, Minus } from 'lucide-react';

interface StringArrayProps {
  values?: string[];
  onChange?: (values: string[]) => void;
  className?: string;
  placeholder?: string;
}

export function StringArray({ 
  values = [''],
  placeholder = 'Enter text...',
  onChange,
  className = ''
}: StringArrayProps) {
  const [strings, setStrings] = useState<string[]>(values.length > 0 ? values : ['']);

  useEffect(() => {
    onChange?.(strings);
  }, [strings, onChange]);

  const addNewString = () => {
    setStrings([...strings, '']);
  };

  const removeString = (index: number) => {
    if (strings.length <= 1) return; // Prevent removing the last input
    const newStrings = strings.filter((_, i) => i !== index);
    setStrings(newStrings);
  };

  const updateString = (index: number, value: string) => {
    const newStrings = [...strings];
    newStrings[index] = value;
    setStrings(newStrings);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {strings.map((str, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={str}
            onChange={(e) => updateString(index, e.target.value)}
            className="flex-1"
            placeholder={placeholder}
          />
          {strings.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => removeString(index)}
              className="h-7 w-7 hover:bg-destructive hover:text-destructive-foreground"
            >
              <Minus className="h-4 w-4" />
            </Button>
          )}
          {index === strings.length - 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={addNewString}
              className="h-7 w-7"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
