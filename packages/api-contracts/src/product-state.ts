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

export const updateSpaceFavoriteResponseSchema = z.object({
  spaceId: z.string().min(1),
  favorite: z.boolean(),
});

export const atmosphereSpaceSchema = z.object({
  schemaVersion: z.literal("vibechat.space-template-market-entry/v1"),
  id: z.string().min(1),
  versionId: z.string().min(1),
  semanticVersion: z.string().min(1),
  integrity: z.string().min(1),
  sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  manifestHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  artifact: z.object({
    schemaVersion: z.literal("vibechat.space-template-artifact/v1"),
    id: z.string().regex(/^tpla-[a-f0-9]{64}$/),
    format: z.literal("agentos-app-v1"),
    sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  }),
  projectFormat: z.literal("agentos-app-v1"),
  compatibility: z.object({
    spaceAppSdk: z.literal("v1"),
    runtime: z.literal("agentos-apps-0.2"),
  }),
  provenance: z.object({
    origin: z.enum(["repository", "app"]),
    publisherId: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    sourceRevision: z.string().min(1).optional(),
    sourceSpaceRevisionId: z.string().min(1).optional(),
    buildId: z.string().min(1).optional(),
  }),
  publisher: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    verification: z.enum(["official", "verified", "unverified"]),
  }),
  name: z.string().min(1),
  author: z.string().min(1),
  summary: z.string(),
  category: z.enum(["daily", "focus", "play", "ritual"]),
  icon: z.string().min(1),
  accent: z.string().min(1),
  canvas: z.string().min(1),
  permissions: z.array(z.string()),
  networkDomains: z.array(z.string()),
  favoriteCount: z.number().int().nonnegative(),
});

export const atmosphereSpaceDirectorySchema = z.object({
  spaces: z.array(atmosphereSpaceSchema),
});

export type ProductStateSnapshotResponse = z.infer<typeof productStateSnapshotSchema>;
export type AtmosphereSpaceResponse = z.infer<typeof atmosphereSpaceSchema>;
