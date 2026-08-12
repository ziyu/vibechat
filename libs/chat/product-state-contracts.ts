import { z } from "zod";

export const productThemeSchema = z.enum(["light", "dark", "system"]);
export const productLocaleSchema = z.enum(["en", "zh-CN"]);

export const productPreferencesSchema = z.object({
  notificationsEnabled: z.boolean(),
  theme: productThemeSchema,
  locale: productLocaleSchema,
});

export const productRoomPreferenceSchema = z.object({
  matrixRoomId: z.string().min(1),
  pinned: z.boolean(),
  muted: z.boolean(),
});

export const productStateSnapshotSchema = z.object({
  preferences: productPreferencesSchema,
  roomPreferences: z.array(productRoomPreferenceSchema),
  favoriteSpaceIds: z.array(z.string().min(1)),
});

export const updateProductPreferencesSchema = productPreferencesSchema.partial()
  .refine((value) => Object.keys(value).length > 0, "At least one preference is required");

export const updateRoomPreferenceSchema = productRoomPreferenceSchema;

export const updateSpaceFavoriteSchema = z.object({ favorite: z.boolean() });

export const atmosphereSpaceSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  semanticVersion: z.string().min(1),
  integrity: z.string().min(1),
  name: z.string().min(1),
  author: z.string().min(1),
  summary: z.string(),
  category: z.enum(["daily", "focus", "play", "ritual"]),
  icon: z.string().min(1),
  accent: z.string().min(1),
  canvas: z.string().min(1),
  permissions: z.array(z.string()),
  networkDomains: z.array(z.string()),
  official: z.boolean(),
  favoriteCount: z.number().int().nonnegative(),
  source: z.literal("builtin"),
});

export const atmosphereSpaceDirectorySchema = z.object({
  spaces: z.array(atmosphereSpaceSchema),
});

export type ProductStateSnapshotResponse = z.infer<typeof productStateSnapshotSchema>;
export type AtmosphereSpaceResponse = z.infer<typeof atmosphereSpaceSchema>;
