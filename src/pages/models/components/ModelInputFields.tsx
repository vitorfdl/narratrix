import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ManifestField } from "@/schema/model-manifest-schema";
import { Eye, EyeOff, Globe } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

interface ModelInputFieldsProps {
  field: ManifestField;
  form: UseFormReturn<any>;
  showSecrets: Record<string, boolean>;
  isEditMode: boolean;
  toggleSecretVisibility: (key: string) => void;
}

export function ModelInputFields({ field, form, showSecrets, toggleSecretVisibility, isEditMode }: ModelInputFieldsProps) {
  return (
    <FormField
      control={form.control}
      name={field.key}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>

          <FormControl>
            {field.field_type === "boolean" ? (
              <Checkbox checked={formField.value} onCheckedChange={formField.onChange} />
            ) : field.field_type === "secret" ? (
              <div className="relative">
                <Input
                  type={showSecrets[field.key] ? "text" : "password"}
                  placeholder={isEditMode ? "[Leave empty to keep existing value]" : field.placeholder}
                  defaultValue={isEditMode ? "" : (field.default as string)}
                  {...formField}
                  onChange={(e) => {
                    formField.onChange(e.target.value);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => toggleSecretVisibility(field.key)}
                >
                  {showSecrets[field.key] ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            ) : field.field_type === "url" ? (
              <div className="relative">
                <Input className="pl-8" placeholder="https://example.com" defaultValue={field.default as string} {...formField} />
                <Globe className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            ) : (
              <Input
                placeholder={field.placeholder}
                type={field.field_type === "number" ? "number" : "text"}
                hints={field.hints}
                defaultValue={field.default as string}
                {...formField}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
