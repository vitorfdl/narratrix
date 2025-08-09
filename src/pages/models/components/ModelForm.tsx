import { encryptApiKey } from "@/commands/security";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useModelManifests, useModelManifestsActions, useModelManifestsLoading } from "@/hooks/manifestStore";
import { useModelsActions } from "@/hooks/modelsStore";
import { useInference } from "@/hooks/useInference";
import { ModelSpecsSchema } from "@/schema/inference-engine-schema";
import { Manifest } from "@/schema/model-manifest-schema";
import { Model, ModelType } from "@/schema/models-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { ModelInputFields } from "./ModelInputFields";

// Define model types
// const MODEL_TYPES: ModelType[] = ["llm", "audio", "image", "database"];
const MODEL_TYPES: ModelType[] = ["llm"];

interface ModelFormProps {
  onSuccess: () => void;
  model?: Model; // Optional model for edit mode
  mode: "add" | "edit" | "duplicate";
}

export function ModelForm({ onSuccess, model, mode = "add" }: ModelFormProps) {
  const currentProfile = useCurrentProfile();
  const profileId = currentProfile!.id;
  const { fetchManifests } = useModelManifestsActions();
  const manifests = useModelManifests();
  const isLoading = useModelManifestsLoading();
  const { createModel, updateModel } = useModelsActions();
  const [selectedType, setSelectedType] = useState<ModelType | null>(model?.type || "llm");
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [formSchema, setFormSchema] = useState<z.ZodObject<any>>();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<{ state: "success" | "error" | "pending"; message: string; errorDetails?: any } | null>(null);
  const [testRequestId, setTestRequestId] = useState<string | null>(null);

  const { runInference, cancelRequest, requests } = useInference({
    // Global callbacks to handle inference responses
    onComplete: (response, requestId) => {
      // Only process if it's our test request
      if (requestId === testRequestId) {
        const result = response.result?.text || response.result?.full_response;
        // Only process once and immediately clear the request ID
        if (result) {
          setTestResult({
            state: "success",
            message: "Connection successful. The model is ready to use.",
          });
        } else {
          setTestResult({
            state: "success",
            message:
              "The API responded, but did not return any text. This may indicate a configuration issue, or that the model expects a different prompt format (e.g., text completion instead of chat) and is good to go.",
          });
        }
        setTestRequestId(null);
      }
    },
    onError: (error, requestId) => {
      toast.error(`Connection failed: ${error.message}`);
      // Only process if it's our test request
      if (requestId === testRequestId) {
        setTestResult({
          state: "error",
          message: error.message,
          errorDetails: error, // Store the full error object
        });
        setTestRequestId(null);
      }
    },
  });

  // Get status for the current test request
  const testRequestStatus = testRequestId && requests[testRequestId] ? requests[testRequestId].status : null;

  // Fetch manifests on component mount
  useEffect(() => {
    fetchManifests();
  }, [fetchManifests]);

  // Set selected manifest when manifests are loaded or when editing an existing model
  useEffect(() => {
    if (manifests.length > 0 && model) {
      const manifest = manifests.find((m) => m.id === model.manifest_id);
      if (manifest) {
        setSelectedManifest(manifest);
      }
    }
  }, [manifests, model]);

  // Filter manifests by selected type
  const filteredManifests = selectedType ? manifests.filter((manifest) => manifest.type === selectedType) : [];

  // Generate dynamic form schema based on selected manifest
  useEffect(() => {
    if (!selectedManifest) {
      // Basic schema without dynamic fields
      setFormSchema(
        z.object({
          name: z.string().min(2, {
            message: "Name must be at least 2 characters.",
          }),
          type: z.enum(MODEL_TYPES as [string, ...string[]]),
          manifest_id: z.string(),
        }),
      );
      return;
    }

    // Create dynamic schema object based on manifest fields
    const schemaObj: Record<string, z.ZodTypeAny> = {
      name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
      }),
      type: z.enum(MODEL_TYPES as [string, ...string[]]),
      manifest_id: z.string(),
    };
    // Add dynamic fields from manifest
    for (const field of selectedManifest.fields) {
      // Create appropriate Zod validators based on field type
      switch (field.field_type) {
        case "string":
          schemaObj[field.key] = field.required ? z.string().min(1, { message: "This field is required." }) : z.string().optional();
          break;
        case "secret":
          if (mode === "edit") {
            // In edit mode, always optional
            schemaObj[field.key] = z.string().optional();
          } else {
            // In add/duplicate, follow manifest's required property
            schemaObj[field.key] = field.required ? z.string().min(1, { message: "This field is required." }) : z.string().optional();
          }
          break;
        case "hidden":
          schemaObj[field.key] = z.any();
          break;
        case "number":
          schemaObj[field.key] = field.required ? z.number({ required_error: "This field is required." }) : z.number().optional();
          break;
        case "boolean":
          schemaObj[field.key] = field.required ? z.boolean() : z.boolean().optional();
          break;
        case "url":
          schemaObj[field.key] = field.required
            ? z
                .string()
                .min(1, { message: "This field is required." })
                .refine(
                  (val) => {
                    try {
                      new URL(val.startsWith("http") ? val : `https://${val}`);
                      return true;
                    } catch (_e) {
                      return false;
                    }
                  },
                  { message: "Please enter a valid URL." },
                )
            : z
                .string()
                .refine(
                  (val) => {
                    if (!val) {
                      return true;
                    }
                    try {
                      new URL(val.startsWith("http") ? val : `https://${val}`);
                      return true;
                    } catch (_e) {
                      return false;
                    }
                  },
                  { message: "Please enter a valid URL." },
                )
                .optional();
          break;
        default:
          schemaObj[field.key] = field.required ? z.string().min(1, { message: "This field is required." }) : z.string().optional();
      }
    }

    setFormSchema(z.object(schemaObj));
  }, [selectedManifest, mode]);

  // Initialize form with default values or existing model data
  const getInitialFormValues = () => {
    const initialValues: Record<string, any> = {
      name: model?.name || "",
      type: model?.type || selectedType || undefined,
      manifest_id: model?.manifest_id || selectedManifest?.id || "",
    };

    // Add config values for edit mode
    if (model?.config && selectedManifest) {
      const config = typeof model.config === "string" ? JSON.parse(model.config) : model.config;
      for (const field of selectedManifest.fields) {
        if (config[field.key] !== undefined) {
          initialValues[field.key] = config[field.key];
        }
      }
    }

    return initialValues;
  };

  // Reset form when schema changes
  const form = useForm<any>({
    resolver: formSchema ? zodResolver(formSchema) : undefined,
    defaultValues: getInitialFormValues(),
  });

  // Reset test result when form values change
  useEffect(() => {
    const subscription = form.watch(() => {
      if (testResult) {
        setTestResult(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, testResult]);

  // Update form values when manifest changes or when switching between add/edit mode
  useEffect(() => {
    // Set type first, regardless of mode
    if (selectedType) {
      form.setValue("type", selectedType);
    }

    if (selectedManifest) {
      form.setValue("manifest_id", selectedManifest.id);

      if (model && mode === "edit") {
        // --- Edit Mode Logic ---
        form.setValue("name", model.name);
        // Type and manifest_id already set above

        // Pre-populate config fields from existing model data
        const config = typeof model.config === "string" ? JSON.parse(model.config) : model.config || {};
        const existingKeys = new Set(Object.keys(config));

        for (const field of selectedManifest.fields) {
          const fieldValue = form.getValues()[field.key];
          if (mode === "edit" && field.field_type === "secret" && (!fieldValue || fieldValue === "")) {
            continue; // Don't include this field in the configFields payload
          }
          if (config[field.key] !== undefined) {
            form.setValue(field.key, config[field.key]);
          } else if (field.default !== undefined) {
            // Apply default if not present in saved config (e.g., new field added to manifest)
            form.setValue(field.key, field.default);
          } else {
            // Ensure field is registered but has no value if not in config and no default
            form.setValue(field.key, undefined); // Or appropriate empty value based on type if needed
          }
          existingKeys.delete(field.key);
        }
      } else {
        // --- Add or Duplicate Mode Logic ---

        // Set name: empty for 'add', copy indicator for 'duplicate'
        if (mode === "duplicate" && model) {
          form.setValue("name", `${model.name} (Copy)`);
        } else if (mode === "add") {
          if (!form.getValues("name")) {
            form.setValue("name", "");
          }
        } else if (model) {
          // If model exists but not edit/duplicate (e.g. initial render before mode fully settles?)
          // Use model name as a base, potentially clear later if needed by specific mode logic
          form.setValue("name", model.name);
        }

        // Reset fields to manifest defaults for 'add' or 'duplicate'
        for (const field of selectedManifest.fields) {
          form.setValue(field.key, field.default);
        }

        // ? Optional: Clear fields that existed in a previous manifest but not in the current one
        // This requires tracking previous fields or comparing current form keys against new manifest keys.
        // For now, relying on conditional rendering of fields might be sufficient.
      }
    } else {
      form.setValue("manifest_id", "");
      const currentFields = form.getValues();
      Object.keys(currentFields).forEach((key) => {
        if (key !== "name" && key !== "type" && key !== "manifest_id") {
          // This is a basic heuristic; might need refinement if non-manifest fields exist
          form.setValue(key, undefined);
        }
      });
    }

    // Reset test result whenever the core config changes
    setTestResult(null);
  }, [selectedManifest, selectedType, model, mode, form]); // form is included as setValue is used

  // Handle type selection
  const handleTypeChange = (value: string) => {
    const type = value as ModelType;
    setSelectedType(type);
    if (!model) {
      // Only reset manifest when adding a new model
      setSelectedManifest(null);
    }
    form.setValue("type", type);
  };

  // Handle manifest selection
  const handleManifestChange = (value: string) => {
    const manifest = manifests.find((m) => m.id === value) || null;
    setSelectedManifest(manifest);
    // Reset form fields that depend on the manifest
    if (manifest) {
      form.setValue("manifest_id", manifest.id);
    }
  };

  // Toggle visibility for secret fields
  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Format URL with http/https prefix if missing
  const formatUrl = (url: string) => {
    if (!url) {
      return url;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  // Function to test model connection
  const testConnection = async () => {
    if (!selectedManifest || !selectedType || !profileId) {
      return;
    }

    // Cancel any existing test request
    if (testRequestId && requests[testRequestId]) {
      await cancelRequest(testRequestId);
      setTestRequestId(null);
    }

    // Reset test result and show connecting state
    setTestResult({
      state: "pending",
      message: "Connecting...",
    });

    try {
      // Extract config fields from form values
      const configFields: Record<string, any> = {};

      for (const field of selectedManifest.fields) {
        const fieldValue = form.getValues()[field.key];

        // Skip empty secret fields in edit mode to avoid overwriting with empty string
        if (mode === "edit" && field.field_type === "secret" && (!fieldValue || fieldValue === "")) {
          configFields[field.key] = model?.config[field.key];
        }

        // Include other fields if they have a value
        if (fieldValue !== undefined) {
          // Format URL fields with proper prefix
          if (field.field_type === "url" && fieldValue) {
            configFields[field.key] = formatUrl(String(fieldValue).trim());
          } else if (field.field_type === "secret" && fieldValue) {
            configFields[field.key] = await encryptApiKey(fieldValue);
          } else {
            configFields[field.key] = fieldValue;
          }
        }
      }

      // Create temporary model specs for testing
      const modelSpecs = ModelSpecsSchema.parse({
        id: model?.id || `temp-test-model-${Date.now()}`,
        model_type: selectedType,
        config: configFields,
        max_concurrent_requests: 1,
        engine: selectedManifest.engine,
      });

      // Simple test message with unique timestamp to verify connection
      const requestId = await runInference({
        messages: [{ role: "user", text: `Test connection - ${Date.now()}` }],
        modelSpecs,
        systemPrompt: "You are a helpful assistant. Reply with 'Connection successful' to confirm the connection works.",
        parameters: {},
        stream: false,
      });

      // Store the request ID for tracking
      if (requestId) {
        setTestRequestId(requestId);
      } else {
        console.error("Failed to get request ID for test");
        setTestResult({
          state: "error",
          message: "Failed to create test request",
        });
      }
    } catch (error) {
      console.error("Failed to test connection:", error);
      setTestResult({
        state: "error",
        message: `Error setting up test: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  async function onSubmit(values: any) {
    if (!selectedManifest || !selectedType || !profileId) {
      return;
    }

    try {
      // Extract config fields from form values
      const configFields: Record<string, any> = {};

      for (const field of selectedManifest.fields) {
        const fieldValue = values[field.key];

        // Skip empty secret fields in edit mode to avoid overwriting with empty string
        if (mode === "edit" && field.field_type === "secret" && (!fieldValue || fieldValue === "")) {
          configFields[field.key] = model?.config[field.key];
        }

        // Include other fields if they have a value
        if (fieldValue !== undefined) {
          // Format URL fields with proper prefix
          if (field.field_type === "url" && fieldValue) {
            configFields[field.key] = formatUrl(String(fieldValue).trim());
          } else {
            configFields[field.key] = fieldValue;
          }
        }
      }

      console.log(configFields);

      if (mode === "edit" && model) {
        // Update existing model
        await updateModel(model.id, {
          name: values.name,
          type: selectedType,
          config: configFields,
          manifest_id: selectedManifest.id,
        });
      } else {
        // Create new model
        await createModel({
          profile_id: profileId,
          name: values.name,
          type: selectedType,
          config: configFields,
          manifest_id: selectedManifest.id,
        });
      }

      onSuccess();
    } catch (error) {
      console.error(`Failed to ${mode} model:`, error);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading manifests...</span>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoFocus={true} placeholder="Model name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="flex-1 basis-1/3">
                <FormLabel>Type</FormLabel>
                <Select
                  onValueChange={handleTypeChange}
                  value={field.value}
                  disabled={mode === "edit"} // Disable type selection in edit mode
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MODEL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedType && (
            <FormField
              control={form.control}
              name="manifest_id"
              render={({ field }) => (
                <FormItem className="flex-1 basis-2/3">
                  <FormLabel>Integration</FormLabel>
                  <Select
                    onValueChange={handleManifestChange}
                    value={field.value}
                    disabled={mode === "edit"} // Disable manifest selection in edit mode
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an integration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredManifests.length > 0 ? (
                        filteredManifests.map((manifest) => (
                          <SelectItem key={manifest.id} value={manifest.id}>
                            {manifest.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No integrations available for this type
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Dynamic fields based on selected manifest */}
        {selectedManifest?.fields
          .filter((field) => field.field_type !== "hidden")
          .map((field) => (
            <ModelInputFields
              isEditMode={mode === "edit" || mode === "duplicate"}
              key={field.key}
              field={field}
              form={form}
              showSecrets={showSecrets}
              toggleSecretVisibility={toggleSecretVisibility}
            />
          ))}
        <div className="flex gap-2 w-full">
          <Button
            type="button"
            variant={testResult?.state === "success" ? "default" : testResult?.state === "error" ? "destructive" : "outline"}
            disabled={!selectedManifest || !selectedType}
            onClick={() => {
              if (testRequestStatus === "queued" || testRequestStatus === "streaming") {
                // Cancel the test if it's in progress
                if (testRequestId) {
                  cancelRequest(testRequestId);
                  setTestRequestId(null);
                }
              } else {
                // Otherwise start a new test
                testConnection();
              }
            }}
            className={testResult?.state === "success" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            {testRequestStatus === "queued" || testRequestStatus === "streaming" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Cancel Verification</span>
              </>
            ) : testResult?.state === "success" ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                <span>Successfully Verified</span>
              </>
            ) : testResult?.state === "error" ? (
              <>
                <AlertCircle className="mr-2 h-4 w-4" />
                <span>Retry Verification</span>
              </>
            ) : (
              <>
                <span>Verify Connection</span>
              </>
            )}
          </Button>
          <Button type="submit" className="flex-1" disabled={!selectedManifest || !selectedType}>
            {mode === "edit" ? "Update" : mode === "duplicate" ? "Duplicate" : "Add"} Model
          </Button>
        </div>
      </form>

      {testResult && testResult.state === "error" && (
        <div className="mt-2">
          <Badge variant="destructive" className="flex flex-col items-start gap-1 p-2">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>Error verifying connection</span>
            </div>
            {testResult.errorDetails && <div className="text-xs mt-1 space-y-1">{testResult.errorDetails.details && <div>{testResult.errorDetails.details}</div>}</div>}
          </Badge>
        </div>
      )}
    </Form>
  );
}
