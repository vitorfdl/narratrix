import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { encryptApiKey } from "@/commands/security";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useModelManifests, useModelManifestsActions, useModelManifestsLoading } from "@/hooks/manifestStore";
import { useModelsActions } from "@/hooks/modelsStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useInference } from "@/hooks/useInference";
import { ModelSpecsSchema } from "@/schema/inference-engine-schema";
import type { Manifest } from "@/schema/model-manifest-schema";
import type { Model, ModelType } from "@/schema/models-schema";
import { ModelInputFields } from "./ModelInputFields";

const MODEL_TYPES: ModelType[] = ["llm"];

export interface ModelFormRef {
  submit: () => void;
}

interface ModelFormProps {
  onSuccess: () => void;
  model?: Model;
  mode: "add" | "edit" | "duplicate";
  hideSubmit?: boolean;
  inferenceData?: { max_concurrency: number; inference_template_id?: string | null };
  onManifestChange?: (manifest: Manifest | null) => void;
}

export const ModelForm = forwardRef<ModelFormRef, ModelFormProps>(({ onSuccess, model, mode = "add", hideSubmit, inferenceData, onManifestChange }, ref) => {
  const currentProfile = useCurrentProfile();
  const profileId = currentProfile!.id;
  const { fetchManifests } = useModelManifestsActions();
  const manifests = useModelManifests();
  const isLoading = useModelManifestsLoading();
  const { createModel, updateModel } = useModelsActions();
  const [selectedType, setSelectedType] = useState<ModelType | null>(model?.type || "llm");
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [formSchema, setFormSchema] = useState<z.ZodObject<z.ZodRawShape>>();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<{ state: "success" | "error" | "pending"; message: string; details?: string } | null>(null);
  const [testRequestId, setTestRequestId] = useState<string | null>(null);

  const normalizeError = useMemo(
    () =>
      (error: unknown): { message: string; details?: string } => {
        if (error instanceof Error) {
          const details = typeof error.cause === "string" ? error.cause : undefined;
          return { message: error.message || "Unknown error", details };
        }
        if (typeof error === "string") {
          return { message: error };
        }
        if (typeof error === "object" && error !== null) {
          const maybeMessage = "message" in error && typeof (error as Record<string, unknown>).message === "string" ? (error as Record<string, string>).message : "Unknown error";
          const rawDetails = "details" in error ? (error as Record<string, unknown>).details : undefined;
          let details: string | undefined;
          if (typeof rawDetails === "string") {
            details = rawDetails;
          } else if (rawDetails && typeof rawDetails === "object") {
            try {
              details = JSON.stringify(rawDetails, null, 2);
            } catch (_) {
              details = String(rawDetails);
            }
          } else if (Object.keys(error as Record<string, unknown>).length > 0) {
            try {
              details = JSON.stringify(error, null, 2);
            } catch (_) {
              details = String(error);
            }
          }
          return { message: maybeMessage, details };
        }
        return { message: "Unknown error" };
      },
    [],
  );

  const { runInference, cancelRequest, requests } = useInference({
    onComplete: (response, requestId) => {
      if (requestId === testRequestId) {
        const result = response.result?.text || response.result?.full_response;
        if (result) {
          setTestResult({ state: "success", message: "Connection successful. The model is ready to use." });
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
      const normalized = normalizeError(error);
      toast.error(`Connection failed: ${normalized.message}`);
      if (requestId === testRequestId) {
        setTestResult({ state: "error", message: normalized.message, details: normalized.details });
        setTestRequestId(null);
      }
    },
  });

  const testRequestStatus = testRequestId && requests[testRequestId] ? requests[testRequestId].status : null;

  useEffect(() => {
    fetchManifests();
  }, [fetchManifests]);

  useEffect(() => {
    if (manifests.length > 0 && model) {
      const manifest = manifests.find((m) => m.id === model.manifest_id);
      if (manifest) {
        setSelectedManifest(manifest);
        onManifestChange?.(manifest);
      }
    }
  }, [manifests, model, onManifestChange]);

  const filteredManifests = selectedType ? manifests.filter((manifest) => manifest.type === selectedType) : [];

  useEffect(() => {
    if (!selectedManifest) {
      setFormSchema(
        z.object({
          name: z.string().min(2, { message: "Name must be at least 2 characters." }),
          type: z.enum(MODEL_TYPES as [string, ...string[]]),
          manifest_id: z.string(),
        }),
      );
      return;
    }

    const schemaObj: Record<string, z.ZodTypeAny> = {
      name: z.string().min(2, { message: "Name must be at least 2 characters." }),
      type: z.enum(MODEL_TYPES as [string, ...string[]]),
      manifest_id: z.string(),
    };

    for (const field of selectedManifest.fields) {
      switch (field.field_type) {
        case "string":
          schemaObj[field.key] = field.required ? z.string().min(1, { message: "This field is required." }) : z.string().optional();
          break;
        case "secret":
          schemaObj[field.key] = mode === "edit" ? z.string().optional() : field.required ? z.string().min(1, { message: "This field is required." }) : z.string().optional();
          break;
        case "hidden":
          schemaObj[field.key] = z.any();
          break;
        case "number":
          schemaObj[field.key] = field.required ? z.number().min(1, { message: "This field is required." }) : z.number().optional();
          break;
        case "boolean":
          schemaObj[field.key] = field.required ? z.boolean() : z.boolean().optional();
          break;
        case "url": {
          const urlRefine = (val: string) => {
            try {
              new URL(val.startsWith("http") ? val : `https://${val}`);
              return true;
            } catch {
              return false;
            }
          };
          schemaObj[field.key] = field.required
            ? z.string().min(1, { message: "This field is required." }).refine(urlRefine, { message: "Please enter a valid URL." })
            : z
                .string()
                .refine((val) => !val || urlRefine(val), { message: "Please enter a valid URL." })
                .optional();
          break;
        }
        default:
          schemaObj[field.key] = field.required ? z.string().min(1, { message: "This field is required." }) : z.string().optional();
      }
    }

    setFormSchema(z.object(schemaObj));
  }, [selectedManifest, mode]);

  const getInitialFormValues = () => {
    const initialValues: Record<string, unknown> = {
      name: model?.name || "",
      type: model?.type || selectedType || undefined,
      manifest_id: model?.manifest_id || selectedManifest?.id || "",
    };

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

  const form = useForm<Record<string, unknown>>({
    resolver: formSchema ? zodResolver(formSchema) : undefined,
    defaultValues: getInitialFormValues(),
  });

  useEffect(() => {
    const subscription = form.watch(() => {
      if (testResult) {
        setTestResult(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, testResult]);

  useEffect(() => {
    if (selectedType) {
      form.setValue("type", selectedType);
    }

    if (selectedManifest) {
      form.setValue("manifest_id", selectedManifest.id);

      if (model && mode === "edit") {
        form.setValue("name", model.name);
        const config = typeof model.config === "string" ? JSON.parse(model.config) : model.config || {};

        for (const field of selectedManifest.fields) {
          const fieldValue = form.getValues()[field.key];
          if (mode === "edit" && field.field_type === "secret" && (!fieldValue || fieldValue === "")) {
            continue;
          }
          if (config[field.key] !== undefined) {
            form.setValue(field.key, config[field.key]);
          } else if (field.default !== undefined) {
            form.setValue(field.key, field.default);
          } else {
            form.setValue(field.key, undefined);
          }
        }
      } else {
        if (mode === "duplicate" && model) {
          form.setValue("name", `${model.name} (Copy)`);
        } else if (mode === "add") {
          if (!form.getValues("name")) {
            form.setValue("name", "");
          }
        } else if (model) {
          form.setValue("name", model.name);
        }

        for (const field of selectedManifest.fields) {
          form.setValue(field.key, field.default);
        }
      }
    } else {
      form.setValue("manifest_id", "");
      const currentFields = form.getValues();
      for (const key of Object.keys(currentFields)) {
        if (key !== "name" && key !== "type" && key !== "manifest_id") {
          form.setValue(key, undefined);
        }
      }
    }

    setTestResult(null);
  }, [selectedManifest, selectedType, model, mode, form]);

  const handleTypeChange = (value: string) => {
    const type = value as ModelType;
    setSelectedType(type);
    if (!model) {
      setSelectedManifest(null);
    }
    form.setValue("type", type);
  };

  const handleManifestChange = (value: string) => {
    const manifest = manifests.find((m) => m.id === value) || null;
    setSelectedManifest(manifest);
    onManifestChange?.(manifest);
    if (manifest) {
      form.setValue("manifest_id", manifest.id);
    }
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatUrl = (url: string) => {
    if (!url) {
      return url;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  const testConnection = async () => {
    if (!selectedManifest || !selectedType || !profileId) {
      return;
    }

    if (testRequestId && requests[testRequestId]) {
      await cancelRequest(testRequestId);
      setTestRequestId(null);
    }

    setTestResult({ state: "pending", message: "Connecting..." });

    try {
      const configFields: Record<string, unknown> = {};
      for (const field of selectedManifest.fields) {
        const fieldValue = form.getValues()[field.key];
        if (mode === "edit" && field.field_type === "secret" && (!fieldValue || fieldValue === "")) {
          configFields[field.key] = model?.config[field.key];
        }
        if (fieldValue !== undefined) {
          if (field.field_type === "url" && fieldValue) {
            configFields[field.key] = formatUrl(String(fieldValue).trim());
          } else if (field.field_type === "secret" && fieldValue) {
            configFields[field.key] = await encryptApiKey(fieldValue as string);
          } else {
            configFields[field.key] = fieldValue;
          }
        }
      }

      const modelSpecs = ModelSpecsSchema.parse({
        id: model?.id || `temp-test-model-${Date.now()}`,
        model_type: selectedType,
        config: configFields,
        max_concurrent_requests: 1,
        engine: selectedManifest.engine,
      });

      const requestId = await runInference({
        messages: [{ role: "user", text: `Test connection - ${Date.now()}` }],
        modelSpecs,
        systemPrompt: "You are a helpful assistant. Reply with 'Connection successful' to confirm the connection works.",
        parameters: {},
        stream: false,
      });

      if (requestId) {
        setTestRequestId(requestId);
      } else {
        console.error("Failed to get request ID for test");
        setTestResult({ state: "error", message: "Failed to create test request" });
      }
    } catch (error) {
      console.error("Failed to test connection:", error);
      setTestResult({ state: "error", message: `Error setting up test: ${error instanceof Error ? error.message : String(error)}` });
    }
  };

  async function onSubmit(values: Record<string, unknown>) {
    if (!selectedManifest || !selectedType || !profileId) {
      return;
    }

    try {
      const configFields: Record<string, unknown> = {};
      for (const field of selectedManifest.fields) {
        const fieldValue = values[field.key];
        if (mode === "edit" && field.field_type === "secret" && (!fieldValue || fieldValue === "")) {
          configFields[field.key] = model?.config[field.key];
        }
        if (fieldValue !== undefined) {
          if (field.field_type === "url" && fieldValue) {
            configFields[field.key] = formatUrl(String(fieldValue).trim());
          } else if (field.field_type === "secret" && fieldValue) {
            // Only encrypt in edit mode — createModel service handles encryption for new models
            configFields[field.key] = mode === "edit" ? await encryptApiKey(fieldValue as string) : fieldValue;
          } else {
            configFields[field.key] = fieldValue;
          }
        }
      }

      if (mode === "edit" && model) {
        await updateModel(model.id, {
          name: values.name as string,
          type: selectedType,
          config: configFields as Record<string, any>,
          manifest_id: selectedManifest.id,
          ...inferenceData,
        });
      } else {
        await createModel({
          profile_id: profileId,
          name: values.name as string,
          type: selectedType,
          config: configFields as Record<string, any>,
          manifest_id: selectedManifest.id,
          max_concurrency: inferenceData?.max_concurrency ?? 1,
          inference_template_id: inferenceData?.inference_template_id ?? undefined,
        });
      }

      onSuccess();
    } catch (error) {
      console.error(`Failed to ${mode} model:`, error);
    }
  }

  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(onSubmit)(),
  }));

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
                <Input autoFocus={true} placeholder="Model name" {...field} value={(field.value as string) ?? ""} />
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
                <Select onValueChange={handleTypeChange} value={field.value as string} disabled={mode === "edit"}>
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
                  <Select onValueChange={handleManifestChange} value={field.value as string} disabled={mode === "edit"}>
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

        <Button
          type="button"
          variant={testResult?.state === "success" ? "default" : testResult?.state === "error" ? "destructive" : "outline"}
          disabled={!selectedManifest || !selectedType}
          onClick={() => {
            if (testRequestStatus === "queued" || testRequestStatus === "streaming") {
              if (testRequestId) {
                cancelRequest(testRequestId);
                setTestRequestId(null);
              }
            } else {
              testConnection();
            }
          }}
          className={`w-full ${testResult?.state === "success" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
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
            <span>Verify Connection</span>
          )}
        </Button>

        {!hideSubmit && (
          <Button type="submit" className="w-full" disabled={!selectedManifest || !selectedType}>
            {mode === "edit" ? "Update" : mode === "duplicate" ? "Duplicate" : "Add"} Model
          </Button>
        )}
      </form>

      {testResult && testResult.state === "error" && (
        <div className="mt-2">
          <Badge variant="destructive" className="flex flex-col items-start gap-1 p-2">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>Error verifying connection</span>
            </div>
            <div className="text-xs mt-1 space-y-1">
              <div>{testResult.message}</div>
              {testResult.details && <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-tight opacity-80">{testResult.details}</pre>}
            </div>
          </Badge>
        </div>
      )}
    </Form>
  );
});

ModelForm.displayName = "ModelForm";
