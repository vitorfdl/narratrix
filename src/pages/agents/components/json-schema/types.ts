export interface SchemaProperty {
  id: string;
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  properties?: SchemaProperty[];
  items?: SchemaProperty;
  enum?: string[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: any;
  examples?: any[];
}

export interface SchemaDefinition {
  $schema: string;
  type: string;
  title?: string;
  description?: string;
  properties: Record<string, any>;
  required?: string[];
}

export interface JsonSchemaCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSchema?: SchemaDefinition | null;
  onSave: (schema: SchemaDefinition) => void;
  onCancel: () => void;
}

export interface PropertyFieldConfig {
  id: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "switch" | "number-pair" | "tag";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  condition?: (property: SchemaProperty) => boolean;
  getValue: (property: SchemaProperty) => any;
  setValue: (property: SchemaProperty, value: any) => Partial<SchemaProperty>;
  rows?: number;
}

export interface PropertyFieldProps {
  config: PropertyFieldConfig;
  property: SchemaProperty;
  onUpdate: (updates: Partial<SchemaProperty>) => void;
}
