import { SCHEMA_TYPES, STRING_FORMATS } from "../constants"
import type { PropertyFieldConfig } from "../types"

export const PROPERTY_FIELD_CONFIGS: PropertyFieldConfig[] = [
  {
    id: 'name',
    label: 'Property Name',
    type: 'text',
    placeholder: 'Property name',
    getValue: (prop) => prop.name,
    setValue: (prop, value) => ({ name: value })
  },
  {
    id: 'type',
    label: 'Type',
    type: 'select',
    options: SCHEMA_TYPES.map(type => ({ value: type.value, label: type.label })),
    getValue: (prop) => prop.type,
    setValue: (prop, value) => ({ type: value })
  },
  {
    id: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Property description',
    rows: 3,
    getValue: (prop) => prop.description || '',
    setValue: (prop, value) => ({ description: value })
  },
  {
    id: 'required',
    label: 'Required',
    type: 'switch',
    getValue: (prop) => prop.required || false,
    setValue: (prop, value) => ({ required: value })
  },
  {
    id: 'format',
    label: 'Format',
    type: 'select',
    condition: (prop) => prop.type === 'string',
    options: [
      { value: 'none', label: 'None' },
      ...STRING_FORMATS.map(format => ({ value: format, label: format }))
    ],
    getValue: (prop) => prop.format || 'none',
    setValue: (prop, value) => ({ format: value === 'none' ? undefined : value })
  },
  {
    id: 'length',
    label: 'Length Constraints',
    type: 'number-pair',
    condition: (prop) => prop.type === 'string',
    getValue: (prop) => ({ min: prop.minLength || '', max: prop.maxLength || '' }),
    setValue: (prop, value) => ({
      minLength: value.min ? Number.parseInt(value.min) : undefined,
      maxLength: value.max ? Number.parseInt(value.max) : undefined
    })
  },
  {
    id: 'pattern',
    label: 'Pattern (Regex)',
    type: 'text',
    placeholder: '^[a-zA-Z0-9]+$',
    condition: (prop) => prop.type === 'string',
    getValue: (prop) => prop.pattern || '',
    setValue: (prop, value) => ({ pattern: value || undefined })
  },
  {
    id: 'enum',
    label: 'Enum Values',
    type: 'tag',
    placeholder: 'Add enum values...',
    condition: (prop) => prop.type === 'string',
    getValue: (prop) => prop.enum || [],
    setValue: (prop, value) => ({ enum: value.length > 0 ? value : undefined })
  },
  {
    id: 'range',
    label: 'Range Constraints',
    type: 'number-pair',
    condition: (prop) => prop.type === 'number' || prop.type === 'integer',
    getValue: (prop) => ({ min: prop.minimum || '', max: prop.maximum || '' }),
    setValue: (prop, value) => ({
      minimum: value.min ? Number.parseFloat(value.min) : undefined,
      maximum: value.max ? Number.parseFloat(value.max) : undefined
    })
  },
  {
    id: 'default',
    label: 'Default Value',
    type: 'text',
    placeholder: 'Default value',
    getValue: (prop) => prop.default || '',
    setValue: (prop, value) => {
      let processedValue: any = value
      if (prop.type === 'number' || prop.type === 'integer') {
        processedValue = value ? Number.parseFloat(value) : undefined
      } else if (prop.type === 'boolean') {
        processedValue = value === 'true'
      }
      return { default: processedValue }
    }
  }
] 