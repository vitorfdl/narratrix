import { z } from "zod";
import { dateUtils, uuidUtils } from "./utils-schema.ts";

/**
 * Define the Each Settings schema
 */
const GeneralSettingsSchema = z.object({
  language: z.enum(["en", "es", "fr", "de"]).default("en"),
  autoSave: z.boolean().default(true),
});

const NotificationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  sound: z.boolean().default(true),
  desktop: z.boolean().default(true),
  chatNotifications: z.boolean().default(true),
  updateNotifications: z.boolean().default(true),
});

const ChatSettingsSchema = z.object({
  timestampFormat: z.enum(["12h", "24h"]).default("12h"),
  beepSound: z.enum(["none", "longbeep4", "beep1", "beep2", "longbeep3"]).default("longbeep4"),
  showAvatars: z.boolean().default(true),
  sendShortcut: z.enum(["Enter", "Ctrl+Enter", "Shift+Enter", "CMD+Enter"]).default("Ctrl+Enter"),
});

const CensorshipSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  customWords: z.array(z.string()).default([]),
  applyToSystemPrompts: z.boolean().default(true),
  applyToUserMessages: z.boolean().default(true),
  applyToAssistantMessages: z.boolean().default(true),
});

const AppearanceSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  fontSize: z.number().min(12).max(24).nullable().default(null),
  fontFamily: z.string().default("Inter"),
  accentColor: z.string().default("#7C3AED"),
});

const SystemSettingsSchema = z.object({
  expressionPackDirectory: z.string().default(""),
  debugMode: z.boolean().default(false),
  autoUpdate: z.boolean().default(true),
});

/**
 * Define the main Profile schema
 */
const AppSettingsSchema = z.object({
  general: GeneralSettingsSchema.default({}),
  notifications: NotificationSettingsSchema.default({}),
  chat: ChatSettingsSchema.default({}),
  censorship: CensorshipSettingsSchema.default({}),
  appearance: AppearanceSettingsSchema.default({}),
  system: SystemSettingsSchema.default({}),
});

// Define QuickAction schema for profile quick actions
const QuickActionSchema = z.object({
  id: z.string(),
  icon: z.string(), // IconName type, but use string for schema
  label: z.string(),
  userPrompt: z.string(),
  chatTemplateId: z.string().optional().nullable().default(null),
  systemPromptOverride: z.string(),
  streamOption: z.enum(["textarea", "userMessage", "participantMessage"]),
  participantMessageType: z.enum(["new", "swap"]).optional(),
});

const ProfileSchema = z.object({
  id: uuidUtils.withDefault(),
  name: z.string(),
  version: z.number().optional().default(0),
  avatar_path: z.string().optional().nullable().default(null),
  password: z.string().min(3).optional(),
  settings: AppSettingsSchema.default({}),
  quick_actions: z.array(QuickActionSchema).nullable().default([]),
  created_at: dateUtils.withDefaultNow(),
  updated_at: dateUtils.withDefaultNow(),
});

const updateProfileSchema = ProfileSchema.partial().omit({
  id: true,
  created_at: true,
  updated_at: true,
});

/**
 * Define API's request schemas
 */
const LoginPasswordSchema = z.object({
  id: uuidUtils.uuid(),
  password: ProfileSchema.shape.password,
});

const UpdatePasswordSchema = z.object({
  id: uuidUtils.uuid(),
  oldPassword: ProfileSchema.shape.password,
  password: ProfileSchema.shape.password,
});

/**
 * Types
 */
type QuickAction = z.infer<typeof QuickActionSchema>;
type Profile = z.infer<typeof ProfileSchema>;
type AppSettings = z.infer<typeof AppSettingsSchema>;

type ProfileResponse = Omit<Profile, "password"> & { hasPassword: boolean };

type UpdatePasswordParams = z.infer<typeof UpdatePasswordSchema>;
type NewProfileParams = Omit<Profile, "settings" | "id" | "created_at" | "updated_at"> & {
  settings?: Profile["settings"];
};
type LoginPasswordParams = z.infer<typeof LoginPasswordSchema>;
type ProfileListItem = Omit<ProfileResponse, "settings" | "quick_actions">;
type UpdateProfileParams = z.infer<typeof updateProfileSchema>;

export {
  AppSettingsSchema,
  LoginPasswordSchema,
  ProfileSchema,
  QuickActionSchema,
  UpdatePasswordSchema,
  updateProfileSchema,
  type AppSettings,
  type LoginPasswordParams,
  type NewProfileParams,
  type Profile,
  type ProfileListItem,
  type ProfileResponse,
  type QuickAction,
  type UpdatePasswordParams,
  type UpdateProfileParams,
};
