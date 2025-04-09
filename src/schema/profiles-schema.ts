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
  fontSize: z.enum(["small", "medium", "large"]).default("medium"),
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

const ProfileSchema = z.object({
  id: uuidUtils.withDefault(),
  name: z.string(),
  avatar_path: z.string().optional(),
  password: z.string().min(3).optional(),
  settings: AppSettingsSchema.default({}),
  quick_buttons: z.array(z.string()).default([]),
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
type Profile = z.infer<typeof ProfileSchema>;
type AppSettings = z.infer<typeof AppSettingsSchema>;

type ProfileResponse = Omit<Profile, "password"> & { hasPassword: boolean };

type UpdatePasswordParams = z.infer<typeof UpdatePasswordSchema>;
type NewProfileParams = Omit<Profile, "settings" | "id" | "created_at" | "updated_at"> & {
  settings?: Profile["settings"];
};
type LoginPasswordParams = z.infer<typeof LoginPasswordSchema>;
type ProfileListItem = Omit<ProfileResponse, "settings">;

export {
  AppSettingsSchema,
  LoginPasswordSchema,
  ProfileSchema,
  UpdatePasswordSchema,
  updateProfileSchema,
  type AppSettings,
  type LoginPasswordParams,
  type NewProfileParams,
  type Profile,
  type ProfileListItem,
  type ProfileResponse,
  type UpdatePasswordParams,
};
