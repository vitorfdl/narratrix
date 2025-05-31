import type { SchemaDefinition, SchemaProperty } from "./types"

export const generateId = (): string => Math.random().toString(36).substr(2, 9)

export const convertToProperties = (props: Record<string, any>, required: string[] = []): SchemaProperty[] => {
  return Object.entries(props).map(([name, prop]) => {
    const property: SchemaProperty = {
      id: generateId(),
      name,
      type: prop.type,
      description: prop.description,
      required: required.includes(name),
      format: prop.format,
      minimum: prop.minimum,
      maximum: prop.maximum,
      minLength: prop.minLength,
      maxLength: prop.maxLength,
      pattern: prop.pattern,
      default: prop.default,
      examples: prop.examples,
      enum: prop.enum,
    }

    if (prop.type === "object" && prop.properties) {
      property.properties = convertToProperties(prop.properties, prop.required || [])
    }

    if (prop.type === "array" && prop.items) {
      property.items = {
        id: generateId(),
        name: "item",
        type: prop.items.type,
        description: prop.items.description,
        format: prop.items.format,
        minimum: prop.items.minimum,
        maximum: prop.items.maximum,
        minLength: prop.items.minLength,
        maxLength: prop.items.maxLength,
        pattern: prop.items.pattern,
        default: prop.items.default,
        examples: prop.items.examples,
        enum: prop.items.enum,
      }
    }

    return property
  })
}

export const convertPropertyToSchema = (prop: SchemaProperty): any => {
  const schema: any = {
    type: prop.type,
    ...(prop.description && { description: prop.description }),
    ...(prop.format && { format: prop.format }),
    ...(prop.minimum !== undefined && { minimum: prop.minimum }),
    ...(prop.maximum !== undefined && { maximum: prop.maximum }),
    ...(prop.minLength !== undefined && { minLength: prop.minLength }),
    ...(prop.maxLength !== undefined && { maxLength: prop.maxLength }),
    ...(prop.pattern && { pattern: prop.pattern }),
    ...(prop.default !== undefined && { default: prop.default }),
    ...(prop.examples && { examples: prop.examples }),
    ...(prop.enum && { enum: prop.enum }),
  }

  if (prop.type === "object" && prop.properties) {
    schema.properties = {}
    schema.required = []

    for (const childProp of prop.properties) {
      schema.properties[childProp.name] = convertPropertyToSchema(childProp)
      if (childProp.required) {
        schema.required.push(childProp.name)
      }
    }

    if (schema.required.length === 0) {
      delete schema.required
    }
  }

  if (prop.type === "array" && prop.items) {
    schema.items = convertPropertyToSchema(prop.items)
  }

  return schema
}

export const generateSchemaFromProperties = (
  properties: SchemaProperty[],
  baseSchema: SchemaDefinition
): SchemaDefinition => {
  const schemaProperties: Record<string, any> = {}
  const required: string[] = []

  for (const prop of properties) {
    schemaProperties[prop.name] = convertPropertyToSchema(prop)
    if (prop.required) {
      required.push(prop.name)
    }
  }

  return {
    ...baseSchema,
    properties: schemaProperties,
    required: required.length > 0 ? required : undefined,
  }
} 