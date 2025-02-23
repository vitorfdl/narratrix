import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { StepButton } from "@/components/ui/step-button";
import { RandomButton } from "@/components/ui/random-button";
import { StringArray } from "@/components/ui/string-array";
import { DragArray } from "@/components/ui/drag-array";
import { Plus, Trash } from "lucide-react";
import { configFields } from "../manifests/configFields";
import type { ConfigField, DragArrayField, NumericField, RandomNumberField, SectionField, StringArrayField } from "@/types/configFields";

interface ConfigItemProps {
  field: ConfigField;
  value: any;
  onChange: (value: any) => void;
  onRemove?: () => void;
  isNested?: boolean;
}

const ConfigItem = ({ field, value, onChange, onRemove, isNested = false }: ConfigItemProps) => {
  const renderField = () => {
    switch (field.type) {
      case 'stepbutton':
      case 'stepbutton_slider': {
        const numericField = field as NumericField;
        const numericValue = typeof value === 'number' ? value : numericField.default ?? 0;
        return (
          <StepButton
            value={numericValue}
            min={numericField.min}
            max={numericField.max}
            step={numericField.step}
            showSlider={field.type === 'stepbutton_slider'}
            onValueChange={onChange}
          />
        );
      }
      case 'random_number': {
        const numericField = field as RandomNumberField;
        const numericValue = typeof value === 'number' ? value : numericField.default ?? 0;
        return (
          <RandomButton
            value={numericValue}
            min={numericField.min}
            max={numericField.max}
            onValueChange={onChange}
          />
        );
      }
      case 'string_array': {
        const arrayField = field as StringArrayField;
        const arrayValue = Array.isArray(value) ? value : arrayField.default ?? [];
        return (
          <StringArray
            values={arrayValue}
            onChange={onChange}
            placeholder="Enter value..."
          />
        );
      }
      case 'drag_array': {
        const dragField = field as DragArrayField;
        const arrayValue = Array.isArray(value) ? value : dragField.default ?? [];
        return (
          <DragArray
            items={arrayValue}
            onChange={onChange}
            className="max-w-md"
          />
        );
      }
      case "section": {
        const sectionField = field as SectionField;
        return (
          <div className="space-y-2">
            {sectionField.fields.map((nestedField) => (
              <ConfigItem
                key={nestedField.name}
                field={nestedField}
                value={value?.[nestedField.name]}
                onChange={(newValue) => {
                  onChange({
                    ...value,
                    [nestedField.name]: newValue
                  });
                }}
                isNested={true}
              />
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const cardClasses = isNested 
    ? "p-2 space-y-1 bg-foreground/5 rounded-sm" 
    : "p-2 space-y-1 bg-foreground/5";

  return (
    <Card className={cardClasses}>
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-medium text-xs">{field.title}</h4>
          {/* <p className="text-xs text-muted-foreground">{field.description}</p> */}
        </div>
        {!isNested && onRemove && (
          <Button variant="ghost" className="w-6 h-6" size="icon" onClick={onRemove}>
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
      {renderField()}
    </Card>
  );
};

const WidgetConfig = () => {
  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [, setSelectedField] = useState<string>("");

  const availableFields = useMemo(() => {
    return configFields
      .filter(field => !activeFields.includes(field.name))
      .map(field => ({
        label: field.title,
        value: field.name
      }));
  }, [activeFields]);

  const handleAddField = (fieldName: string) => {
    const field = configFields.find(f => f.name === fieldName);
    if (!field) return;

    setActiveFields(prev => [...prev, fieldName]);
    setSelectedField("");
    
    if (field.type === 'section') {
      // Initialize section with default values for all nested fields
      const sectionField = field as SectionField;
      const sectionDefaults = sectionField.fields.reduce((acc, nestedField) => {
        if ('default' in nestedField) {
          acc[nestedField.name] = nestedField.default;
        }
        return acc;
      }, {} as Record<string, any>);
      
      setValues(prev => ({
        ...prev,
        [fieldName]: sectionDefaults
      }));
    } else if ('default' in field) {
      const defaultValue = field.default;
      setValues(prev => ({
        ...prev,
        [fieldName]: defaultValue
      }));
    }
  };

  const handleRemoveField = (fieldName: string) => {
    setActiveFields(prev => prev.filter(f => f !== fieldName));
    setValues(prev => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleValueChange = (fieldName: string, newValue: any) => {
    setValues(prev => ({
      ...prev,
      [fieldName]: newValue
    }));
  };

  return (
    <div className="space-y-1 p-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Inference Settings</h3>

        <Combobox
          items={availableFields}
          onChange={(value) => {
            setSelectedField(value);
            handleAddField(value);
          }}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Field
            </Button>
          }
          placeholder="Select field to add..."
        />
      </div>

      <div className="space-y-2">
        {activeFields.map(fieldName => {
          const field = configFields.find(f => f.name === fieldName);
          if (!field) return null;

          return (
            <ConfigItem
              key={fieldName}
              field={field}
              value={values[fieldName]}
              onChange={(newValue) => handleValueChange(fieldName, newValue)}
              onRemove={() => handleRemoveField(fieldName)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default WidgetConfig;

