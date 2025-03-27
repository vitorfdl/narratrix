/**
 * Base interface for common field properties
 */
export interface BaseField {
  name: string;
  type: string;
  title: string;
  description: string;
}

/**
 * Interface for numeric input fields with spinbox or slider
 */
export interface NumericField extends BaseField {
  type: "stepbutton" | "stepbutton_slider";
  min: number;
  max?: number;
  step: number;
  default?: number;
}

/**
 * Interface for string array fields
 */
export interface StringArrayField extends BaseField {
  type: "string_array";
  default: string[];
}

/**
 * Interface for draggable array fields
 */
export interface DragArrayField extends BaseField {
  type: "drag_array";
  default: string[];
  options: string[];
  readOnly: boolean;
}

/**
 * Interface for section fields that contain nested fields
 */
export interface SectionField extends BaseField {
  type: "section";
  fields: ConfigField[];
}

/**
 * Interface for random number fields
 */
export interface RandomNumberField extends BaseField {
  type: "random_number";
  min: number;
  max: number;
  default: number;
}

/**
 * Union type for all possible field types
 */
export type ConfigField = NumericField | StringArrayField | DragArrayField | SectionField | RandomNumberField;

/**
 * Type for the entire configuration fields array
 */
export type ConfigFields = ConfigField[];

/**
 * Type for sampling order options
 */
export type SamplingMethod = "dry" | "xtc" | "min_p" | "top_p" | "top_k" | "temperature";
