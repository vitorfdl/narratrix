import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLorebookStoreActions } from "@/hooks/lorebookStore";
import { CreateLorebookParams, Lorebook, UpdateLorebookParams } from "@/schema/lorebook-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface LorebookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  initialLorebook?: Lorebook | null;
}

const categoryEnum = z.enum(["ruleset", "character", "world"]);
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: categoryEnum.nullable().default("ruleset"),
  tags: z.array(z.string()).default([]),
  max_tokens: z.number().int().min(1).max(10000).default(1000),
  max_depth: z.number().int().min(1).max(100).default(25),
});

export function LorebookFormDialog({ open, onOpenChange, profileId, initialLorebook }: LorebookFormDialogProps) {
  const { createLorebook, updateLorebook } = useLorebookStoreActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!initialLorebook;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "ruleset",
      tags: [],
      max_tokens: 1000,
      max_depth: 25,
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditing && initialLorebook) {
        form.reset({
          name: initialLorebook.name,
          description: initialLorebook.description || "",
          category: initialLorebook.category || "ruleset",
          tags: initialLorebook.tags || [],
          max_tokens: initialLorebook.max_tokens || 1000,
          max_depth: initialLorebook.max_depth || 25,
        });
      } else {
        form.reset({
          name: "",
          description: "",
          category: "ruleset",
          tags: [],
          max_tokens: 1000,
          max_depth: 25,
        });
      }
    }
  }, [open, isEditing, initialLorebook, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!profileId) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && initialLorebook) {
        const updateData: UpdateLorebookParams = {
          name: values.name,
          description: values.description || null,
          category: values.category,
          tags: values.tags,
          max_tokens: values.max_tokens,
          max_depth: values.max_depth,
          allow_recursion: initialLorebook.allow_recursion,
          max_recursion_depth: initialLorebook.max_recursion_depth,
          group_keys: initialLorebook.group_keys,
          extra: initialLorebook.extra,
        };
        await updateLorebook(initialLorebook.id, updateData);
      } else {
        const lorebookData: CreateLorebookParams = {
          profile_id: profileId,
          name: values.name,
          description: values.description || null,
          category: values.category,
          tags: values.tags,
          max_tokens: values.max_tokens,
          max_depth: values.max_depth,
          allow_recursion: false,
          max_recursion_depth: 25,
          group_keys: [],
          extra: {},
        };
        await createLorebook(lorebookData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error(`Failed to ${isEditing ? "update" : "create"} lorebook:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Lorebook" : "Create New Lorebook"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update the details for this lorebook." : "Create a new lorebook to organize your world-building content."}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Lorebook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "ruleset"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryEnum.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea className="input-fields hover:bo" placeholder="A brief description of this lorebook" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <CommandTagInput placeholder="Add tags..." value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="max_tokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Tokens</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={10000} {...field} onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 1000)} value={field.value} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_depth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Depth</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={100} {...field} onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 25)} value={field.value} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save Changes" : "Create Lorebook"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
