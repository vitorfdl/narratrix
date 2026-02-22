import { LuTrash } from "react-icons/lu";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DragArray } from "@/components/ui/drag-array";
import { CommandTagInput } from "@/components/ui/input-tag";
import { RandomButton } from "@/components/ui/random-button";
import { StepButton } from "@/components/ui/step-button";
import type { ConfigField, DragArrayField, NumericField, RandomNumberField, SectionField, StringArrayField } from "@/schema/template-chat-settings-types";

interface ConfigItemProps {
  field: ConfigField;
  value: any;
  onChange: (value: any) => void;
  onRemove?: () => void;
  isNested?: boolean;
  isStrikethrough?: boolean;
}

export const ConfigItem = ({ field, value, onChange, onRemove, isNested = false, isStrikethrough = false }: ConfigItemProps) => {
  const renderField = () => {
    switch (field.type) {
      case "stepbutton":
      case "stepbutton_slider": {
        const numericField = field as NumericField;
        const numericValue = typeof value === "number" ? value : (numericField.default ?? 0);
        return <StepButton value={numericValue} min={numericField.min} max={numericField.max} step={numericField.step} showSlider={field.type === "stepbutton_slider"} onValueChange={onChange} />;
      }
      case "random_number": {
        const numericField = field as RandomNumberField;
        const numericValue = typeof value === "number" ? value : (numericField.default ?? 0);
        return <RandomButton value={numericValue} min={numericField.min} max={numericField.max} onValueChange={onChange} />;
      }
      case "string_array": {
        const arrayField = field as StringArrayField;
        const arrayValue = Array.isArray(value) ? value : (arrayField.default ?? []);
        return <CommandTagInput value={arrayValue} onChange={onChange} placeholder="Enter value..." />;
      }
      case "drag_array": {
        const dragField = field as DragArrayField;
        const arrayValue = Array.isArray(value) ? value : (dragField.default ?? []);
        return <DragArray items={arrayValue} onChange={onChange} className="max-w-md" />;
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
                    [nestedField.name]: newValue,
                  });
                }}
                isNested={true}
                isStrikethrough={isStrikethrough}
              />
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const cardClasses = isNested ? "p-1 space-y-1 bg-foreground/5 rounded-sm" : "p-2 space-y-1 border-none bg-foreground/5";
  const titleClasses = `font-medium text-xs ${isStrikethrough ? "line-through text-muted-foreground" : ""}`;

  return (
    <Card className={cardClasses}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h4 className={titleClasses}>{field.title}</h4>
          <HelpTooltip>{field.description}</HelpTooltip>
        </div>
        {!isNested && onRemove && (
          <Button variant="ghost" className="w-6 h-6" size="icon" onClick={onRemove}>
            <LuTrash className="h-4 w-4" />
          </Button>
        )}
      </div>
      {renderField()}
    </Card>
  );
};
