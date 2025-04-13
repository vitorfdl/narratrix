import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepButton } from "@/components/ui/step-button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/hooks/ProfileContext";
import { useLorebookStoreActions } from "@/hooks/lorebookStore";
import { basicPromptSuggestionList } from "@/schema/chat-message-schema";
import { CreateLorebookEntryParams, LorebookEntry, UpdateLorebookEntryParams, createLorebookEntrySchema } from "@/schema/lorebook-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookDown, BookUp, Bot, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface LorebookEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lorebookId: string;
  entry: LorebookEntry | null;
  groupKeys: string[];
}

// Use the full creation schema, making fields optional where appropriate for editing
const formSchema = createLorebookEntrySchema.omit({ lorebook_id: true, vector_content: true, extra: true }).extend({
  // Ensure fields needed by the form but not strictly required by createLorebookEntrySchema have defaults
  comment: z.string().min(1, "Title is required"),
  content: z.string().default(""),
  enabled: z.boolean().default(true),
  group_key: z.string().nullable().default(null),
  insertion_type: z.enum(["lorebook_top", "lorebook_bottom", "user", "assistant"]).default("lorebook_top"),
  depth: z.number().int().min(1).max(100).default(1),
  trigger_chance: z.number().int().min(1).max(100).default(100),
  priority: z.number().int().default(100),
  constant: z.boolean().default(false),
  keywords: z.array(z.string()).default([]),
  case_sensitive: z.boolean().default(false),
  match_partial_words: z.boolean().default(true),
  min_chat_messages: z.number().int().min(1).max(50).default(1),
});

type FormValues = z.infer<typeof formSchema>;

export function LorebookEntryDialog({ open, onOpenChange, lorebookId, entry, groupKeys }: LorebookEntryDialogProps) {
  const { currentProfile } = useProfile();
  const { createLorebookEntry, updateLorebookEntry } = useLorebookStoreActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!entry;

  // Set up form with default values or existing entry data
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),

    // Default values are derived from the schema itself now
  });

  // Watch insertion_type to conditionally disable depth
  const insertionType = form.watch("insertion_type");
  const isDepthRelevant = insertionType === "user" || insertionType === "assistant";

  // Reset form when entry changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      form.reset(
        entry
          ? {
              // Editing: Use entry data
              comment: entry.comment,
              content: entry.content,
              enabled: entry.enabled,
              group_key: entry.group_key,
              insertion_type: entry.insertion_type,
              depth: entry.depth,
              trigger_chance: entry.trigger_chance,
              priority: entry.priority,
              constant: entry.constant,
              keywords: entry.keywords,
              case_sensitive: entry.case_sensitive,
              match_partial_words: entry.match_partial_words,
              min_chat_messages: entry.min_chat_messages,
            }
          : {
              // Creating: Use schema defaults (or specific defaults if needed)
              comment: "",
              content: "",
              enabled: true,
              group_key: null,
              insertion_type: "lorebook_top",
              depth: 1,
              trigger_chance: 100,
              priority: 100,
              constant: false,
              keywords: [],
              case_sensitive: false,
              match_partial_words: true,
              min_chat_messages: 1,
            },
      );
    }
  }, [entry, open, form]);

  const onSubmit = async (values: FormValues) => {
    if (!currentProfile) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && entry) {
        // Update existing entry
        // No need to spread values, they match UpdateLorebookEntryParams structure
        const updateData: UpdateLorebookEntryParams = values;
        await updateLorebookEntry(entry.id, updateData);
      } else {
        // Create new entry
        // Combine form values with required fields for creation
        const createData: CreateLorebookEntryParams = {
          ...values,
          lorebook_id: lorebookId,
          vector_content: null, // Handle vector content separately if needed
          extra: {}, // Add extra data if needed
        };
        await createLorebookEntry(createData);
      }

      // Close dialog (resetting happens in useEffect)
      onOpenChange(false);
    } catch (error) {
      console.error(`Failed to ${isEditing ? "update" : "create"} lorebook entry:`, error);
      // Optionally show an error message to the user
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle dialog close/reset
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    // Form reset is handled by the useEffect hook based on `open` state
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Entry" : "Create New Entry"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                {/* Combine Title and Keywords in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>Title (Comment)</FormLabel>
                          <HelpTooltip>
                            <p>A short description or title for this entry, used for organization.</p>
                          </HelpTooltip>
                        </div>
                        <FormControl>
                          <Input placeholder="Entry title or comment for organization" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="keywords"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>Keywords</FormLabel>
                          <HelpTooltip>
                            <p>Keywords that trigger this entry to be included. Press Enter or comma to add.</p>
                          </HelpTooltip>
                        </div>
                        <FormControl>
                          <CommandTagInput placeholder="Add keywords..." value={field.value || []} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Combine Insertion Type and Depth in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="insertion_type"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>Insertion Type</FormLabel>
                          <HelpTooltip>
                            <p>Where to insert this entry in the context. 'Lorebook Top/Bottom' refers to the order within the lorebook section.</p>
                          </HelpTooltip>
                        </div>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select insertion type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="lorebook_top">
                              <div className="flex items-center gap-2">
                                <BookUp className="h-4 w-4" />
                                <span>Lorebook Top</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="lorebook_bottom">
                              <div className="flex items-center gap-2">
                                <BookDown className="h-4 w-4" />
                                <span>Lorebook Bottom</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span>User Message</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="assistant">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4" />
                                <span>Assistant Message</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="depth"
                    render={({ field }) => (
                      <FormItem className={`${!isDepthRelevant ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-1">
                          <FormLabel>Insertion Depth</FormLabel>
                          <HelpTooltip>
                            <p>
                              How many messages back the entry should be inserted relative to the current message. Only applicable for 'User' or
                              'Assistant' insertion types. 1 means the last message.
                            </p>
                          </HelpTooltip>
                        </div>
                        <FormControl>
                          <StepButton
                            min={1}
                            max={100}
                            step={1}
                            value={field.value ?? 1}
                            onValueChange={(val) => field.onChange(val)}
                            showSlider={true}
                            ticks={10}
                            disabled={!isDepthRelevant}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <MarkdownTextArea
                          initialValue={field.value || ""}
                          onChange={field.onChange}
                          suggestions={basicPromptSuggestionList}
                          placeholder="Enter the content of this entry..."
                          className=" font-mono text-sm"
                          editable={true}
                        />
                      </FormControl>
                      <FormDescription>The actual text that will be inserted into the context.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Enabled</FormLabel>
                          <FormDescription>Activate entry.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="constant"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <FormLabel>Constant</FormLabel>
                            <HelpTooltip>
                              <p>If enabled, this entry is always included, ignoring keywords.</p>
                            </HelpTooltip>
                          </div>
                          <FormDescription>Always include.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="group_key"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <div className="flex items-center gap-1">
                          <FormLabel>Group</FormLabel>
                          <HelpTooltip>
                            <p>
                              Categorize this entry into a group. Entries in the same group might have specific interaction rules (depending on
                              implementation).
                            </p>
                          </HelpTooltip>
                        </div>
                        <FormControl>
                          <Input
                            placeholder="Assign group (optional)"
                            hints={groupKeys}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const value = e.target.value.trim();
                              field.onChange(value === "" ? null : value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>Type to create or select group.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>Priority</FormLabel>
                          <HelpTooltip>
                            <p>Determines the order of inclusion when multiple entries are triggered. Higher numbers are prioritized.</p>
                          </HelpTooltip>
                        </div>
                        <FormControl>
                          <Input
                            type="number"
                            min={-1000}
                            max={1000}
                            step={1}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number.parseInt(e.target.value, 10) || 0)}
                            value={field.value ?? 0}
                          />
                        </FormControl>
                        <FormDescription>Higher = more priority.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="trigger_chance"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>Trigger Chance (%)</FormLabel>
                          <HelpTooltip>
                            <p>The probability (1-100%) that this entry will be included if its keywords match.</p>
                          </HelpTooltip>
                        </div>
                        <FormControl>
                          <StepButton
                            min={1}
                            max={100}
                            step={1}
                            value={field.value ?? 100}
                            onValueChange={(val) => field.onChange(Math.floor(val))}
                            showSlider={true}
                            ticks={11}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="min_chat_messages"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>Min Chat Messages</FormLabel>
                          <HelpTooltip>
                            <p>The minimum number of chat messages required before this entry can be triggered.</p>
                          </HelpTooltip>
                        </div>
                        <FormControl>
                          <StepButton
                            min={1}
                            max={100}
                            step={1}
                            value={field.value ?? 1}
                            onValueChange={(val) => field.onChange(Math.floor(val))}
                            showSlider={true}
                            ticks={5}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <FormField
                    control={form.control}
                    name="case_sensitive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <FormLabel>Case Sensitive Keywords</FormLabel>
                            <HelpTooltip>
                              <p>If enabled, keyword matching will respect case sensitivity (e.g., "Apple" won't match "apple").</p>
                            </HelpTooltip>
                          </div>
                          <FormDescription>Match keyword case exactly.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="match_partial_words"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <FormLabel>Match Partial Words</FormLabel>
                            <HelpTooltip>
                              <p>
                                If enabled, keywords can match parts of words (e.g., "cat" could match "caterpillar"). If disabled, only whole word
                                matches occur.
                              </p>
                            </HelpTooltip>
                          </div>
                          <FormDescription>Allow keywords within larger words.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6 gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save Changes" : "Create Entry"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
