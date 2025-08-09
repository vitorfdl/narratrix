import { Braces, ChevronDown, ChevronRight, Copy, Grip, Plus, Save, Trash2, Type, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
// Import from separated modules
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SCHEMA_TYPES } from "./constants";
import { PROPERTY_FIELD_CONFIGS } from "./property-fields/field-configs";
import { PropertyField } from "./property-fields/PropertyField";
import { convertToProperties, generateId, generateSchemaFromProperties } from "./schema-utils";
import type { JsonSchemaCreatorProps, SchemaDefinition, SchemaProperty } from "./types";

const defaultSchema: SchemaDefinition = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  title: "New Tool",
  description: "Use this tool with the following parameters...",
  properties: {},
  required: [],
};
export default function JsonSchemaCreator({ open, onOpenChange, initialSchema, onSave, onCancel }: JsonSchemaCreatorProps): JSX.Element {
  const [schema, setSchema] = useState<SchemaDefinition>(defaultSchema);

  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<SchemaProperty | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const draggedItem = useRef<SchemaProperty | null>(null);

  // Initialize schema from props
  useEffect(() => {
    if (initialSchema) {
      setSchema(initialSchema);
      setProperties(convertToProperties(initialSchema.properties, initialSchema.required));
    } else {
      // Reset to default state for new schema
      setSchema(defaultSchema);
      setProperties([]);
      setSelectedProperty(null);
      setExpandedNodes(new Set());
    }
  }, [initialSchema, open]);

  const addProperty = useCallback((parentId?: string, type = "string"): void => {
    const newProperty: SchemaProperty = {
      id: generateId(),
      name: "new property",
      type,
      description: "",
      required: false,
      ...(type === "object" && { properties: [] }),
      ...(type === "array" && { items: { id: generateId(), name: "item", type: "string" } }),
    };

    if (parentId) {
      setProperties((prev) =>
        prev.map((prop) =>
          updateNestedProperty(prop, parentId, (parent) => ({
            ...parent,
            properties: [...(parent.properties || []), newProperty],
          })),
        ),
      );
      setExpandedNodes((prev) => new Set([...prev, parentId]));
    } else {
      setProperties((prev) => [...prev, newProperty]);
    }

    setSelectedProperty(newProperty);
  }, []);

  const updateNestedProperty = (property: SchemaProperty, targetId: string, updater: (prop: SchemaProperty) => SchemaProperty): SchemaProperty => {
    if (property.id === targetId) {
      return updater(property);
    }

    if (property.properties) {
      return {
        ...property,
        properties: property.properties.map((p) => updateNestedProperty(p, targetId, updater)),
      };
    }

    if (property.items) {
      const updatedItems = updateNestedProperty(property.items, targetId, updater);
      if (updatedItems !== property.items) {
        return {
          ...property,
          items: updatedItems,
        };
      }
    }

    return property;
  };

  const updateProperty = useCallback(
    (id: string, updates: Partial<SchemaProperty>): void => {
      setProperties((prev) => prev.map((prop) => updateNestedProperty(prop, id, (p) => ({ ...p, ...updates }))));

      if (selectedProperty?.id === id) {
        setSelectedProperty((prev) => (prev ? { ...prev, ...updates } : null));
      }
    },
    [selectedProperty],
  );

  const deleteProperty = useCallback(
    (id: string): void => {
      const deleteFromArray = (props: SchemaProperty[]): SchemaProperty[] =>
        props
          .filter((p) => p.id !== id)
          .map((p) => {
            const updatedItems = p.items ? deleteFromItems(p.items) : undefined;
            return {
              ...p,
              properties: p.properties ? deleteFromArray(p.properties) : undefined,
              items: updatedItems,
            };
          });

      const deleteFromItems = (item: SchemaProperty): SchemaProperty | undefined => {
        if (item.id === id) {
          return undefined;
        }
        return {
          ...item,
          properties: item.properties ? deleteFromArray(item.properties) : undefined,
        };
      };

      setProperties((prev) => deleteFromArray(prev));
      if (selectedProperty?.id === id) {
        setSelectedProperty(null);
      }
    },
    [selectedProperty],
  );

  const toggleExpanded = (id: string): void => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const generateSchema = useCallback((): SchemaDefinition => {
    return generateSchemaFromProperties(properties, schema);
  }, [properties, schema]);

  const handleSave = (): void => {
    const finalSchema = generateSchema();
    onSave(finalSchema);
    onOpenChange(false);
  };

  const handleCancel = (): void => {
    onCancel();
    onOpenChange(false);
  };

  const copySchema = (): void => {
    navigator.clipboard.writeText(JSON.stringify(generateSchema(), null, 2));
  };

  const renderProperty = (property: SchemaProperty, level = 0, _parentId?: string, isArrayItem = false): JSX.Element => {
    const isExpanded = expandedNodes.has(property.id);
    const hasChildren = (property.type === "object" && property.properties?.length) || (property.type === "array" && property.items);
    const isSelected = selectedProperty?.id === property.id;

    return (
      <div key={property.id} className="select-none">
        <div
          className={`flex items-center gap-1 p-1 rounded-md cursor-pointer hover:bg-accent/50 transition-colors ${isSelected ? "bg-primary/10 border border-primary/20" : ""}`}
          style={{ marginLeft: `${level * 2}px` }}
          onClick={() => setSelectedProperty(property)}
          draggable
          onDragStart={() => {
            draggedItem.current = property;
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <Grip className="w-3 h-3 text-muted-foreground" />

          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="w-3 h-3 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(property.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          )}

          <div className="flex items-center gap-2 flex-1">
            {SCHEMA_TYPES.find((t) => t.value === property.type)?.icon && (
              <div className="w-3 h-3">
                {(() => {
                  const IconComponent = SCHEMA_TYPES.find((t) => t.value === property.type)?.icon;
                  return IconComponent ? <IconComponent className="w-3 h-3" /> : null;
                })()}
              </div>
            )}

            <span className="font-medium text-xs">{property.name}</span>
            <Badge variant="secondary" className="text-xxs">
              {property.type}
            </Badge>

            {property.required && (
              <span
                title="Required"
                className="ml-1 text-destructive font-bold text-base leading-none select-none"
                aria-label="Required"
                style={{
                  display: "inline-block",
                  verticalAlign: "middle",
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                *
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {property.type === "object" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-5 h-5 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  addProperty(property.id);
                }}
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}

            {!isArrayItem && (
              <Button
                variant="ghost"
                size="sm"
                className="w-5 h-5 p-0 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProperty(property.id);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-4">
            {property.type === "object" && property.properties?.map((prop) => renderProperty(prop, level + 1, property.id, false))}
            {property.type === "array" && property.items && renderProperty(property.items, level + 1, property.id, true)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="window" className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>{initialSchema ? "Edit JSON Schema" : "Create JSON Schema"}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 p-0">
            {/* Schema Tree */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Schema Structure</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {properties.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Braces className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-sm">No properties yet</p>
                        <p className="text-xs">Click the + buttons above to add properties</p>
                      </div>
                    ) : (
                      properties.map((prop) => renderProperty(prop))
                    )}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 gap-2">
                  {SCHEMA_TYPES.map((type) => (
                    <Button key={type.value} variant="outline" size="sm" onClick={() => addProperty(undefined, type.value)} className="justify-start">
                      <type.icon className="w-4 h-4 mr-2" />
                      {type.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Property Editor */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Property Editor</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedProperty ? (
                  <ScrollArea className="max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                    <div className="space-y-4">
                      {PROPERTY_FIELD_CONFIGS.map((config) => (
                        <PropertyField key={config.id} config={config} property={selectedProperty} onUpdate={(updates) => updateProperty(selectedProperty.id, updates)} />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Type className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Select a property to edit</p>
                    <p className="text-xs">Click on any property in the schema structure</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schema Preview & Settings */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Tool Settings</CardTitle>
                  <Button variant="outline" size="sm" onClick={copySchema}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="settings" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="schema">Preview</TabsTrigger>
                  </TabsList>

                  <TabsContent value="settings" className="mt-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="schema-title">Tool Name</Label>
                        <Input id="schema-title" value={schema.title || ""} onChange={(e) => setSchema((prev) => ({ ...prev, title: e.target.value }))} placeholder="My Tool" />
                      </div>

                      <div>
                        <Label htmlFor="schema-description">Tool Description</Label>
                        <ResizableTextarea
                          id="schema-description"
                          value={schema.description || ""}
                          onChange={(e) => setSchema((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="A tool description"
                          rows={3}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="schema" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <MarkdownTextArea initialValue={`\`\`\`json\n${JSON.stringify(generateSchema(), null, 2)}\n\`\`\``} editable={false} className="text-xxs rounded-md overflow-auto" />
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Schema
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
