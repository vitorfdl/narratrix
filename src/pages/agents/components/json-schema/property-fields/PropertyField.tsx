import { Input } from "@/components/ui/input"
import { CommandTagInput } from "@/components/ui/input-tag"
import { Label } from "@/components/ui/label"
import { ResizableTextarea } from "@/components/ui/ResizableTextarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StepButton } from "@/components/ui/step-button"
import { Switch } from "@/components/ui/switch"
import { SCHEMA_TYPES } from "../constants"
import type { PropertyFieldProps } from "../types"

export const PropertyField = ({ config, property, onUpdate }: PropertyFieldProps): JSX.Element | null => {
  if (config.condition && !config.condition(property)) {
    return null
  }

  const value = config.getValue(property)

  const handleChange = (newValue: any): void => {
    const updates = config.setValue(property, newValue)
    onUpdate(updates)
  }

  const renderField = (): JSX.Element => {
    switch (config.type) {
      case 'text':
        return (
          <Input
            id={`prop-${config.id}`}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={config.placeholder}
          />
        )
      
      case 'number':
        return (
          <StepButton
            id={`prop-${config.id}`}
            value={value}
            onValueChange={handleChange}
            placeholder={config.placeholder}
          />
        )
      
      case 'textarea':
        return (
          <ResizableTextarea
            id={`prop-${config.id}`}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={config.placeholder}
            rows={config.rows}
          />
        )
      
      case 'select':
        return (
          <Select value={value} onValueChange={handleChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {config.id === 'type' ? (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const typeConfig = SCHEMA_TYPES.find(t => t.value === option.value)
                        const IconComponent = typeConfig?.icon
                        return IconComponent ? <IconComponent className="w-4 h-4" /> : null
                      })()}
                      {option.label}
                    </div>
                  ) : (
                    option.label
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case 'switch':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={`prop-${config.id}`}
              checked={value}
              onCheckedChange={handleChange}
            />
            <Label htmlFor={`prop-${config.id}`}>{config.label}</Label>
          </div>
        )
      
      case 'number-pair':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`prop-${config.id}-min`}>
                {config.id === 'length' ? 'Min Length' : 'Minimum'}
              </Label>
              <StepButton
                id={`prop-${config.id}-min`}
                value={value.min}
                min={-9999}
                max={9999}
                onValueChange={(e) => handleChange({ ...value, min: e })}
              />
            </div>
            <div>
              <Label htmlFor={`prop-${config.id}-max`}>
                {config.id === 'length' ? 'Max Length' : 'Maximum'}
              </Label>
              <StepButton
                id={`prop-${config.id}-max`}
                value={value.max}
                min={-9999}
                max={9999}
                onValueChange={(e) => handleChange({ ...value, max: e })}
              />
            </div>
          </div>
        )
      
      case 'tag':
        return (
          <CommandTagInput
            value={value}
            onChange={handleChange}
            placeholder={config.placeholder}
            maxTags={20}
          />
        )
      
      default:
        return <div>Unsupported field type</div>
    }
  }

  return (
    <div>
      {config.type !== 'switch' && (
        <Label htmlFor={`prop-${config.id}`}>{config.label}</Label>
      )}
      {renderField()}
    </div>
  )
} 