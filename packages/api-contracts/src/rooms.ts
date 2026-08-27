import { z } from "zod";

const spaceTemplateIdSchema = z.string().min(1).max(128);
const spaceTemplateVersionIdSchema = z.string().min(1).max(255);

export const createRoomRequestSchema = z.object({
  startMode: z.enum(["blank", "template"]).optional(),
  /** Compatibility alias for spaceTemplateId. */
  spaceId: spaceTemplateIdSchema.optional(),
  /** Compatibility alias for spaceTemplateVersionId. */
  spaceVersionId: spaceTemplateVersionIdSchema.optional(),
  spaceTemplateId: spaceTemplateIdSchema.optional(),
  spaceTemplateVersionId: spaceTemplateVersionIdSchema.optional(),
  participantUserIds: z.array(z.string().min(1)).max(49)
    .refine((ids) => new Set(ids).size === ids.length, "Participants must be unique"),
  instanceConfig: z.record(z.string(), z.unknown()).default({}),
  clientRequestId: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80),
}).superRefine((value, context) => {
  if (value.spaceId && value.spaceTemplateId && value.spaceId !== value.spaceTemplateId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["spaceTemplateId"],
      message: "Template id aliases must match",
    });
  }
  if (
    value.spaceVersionId
    && value.spaceTemplateVersionId
    && value.spaceVersionId !== value.spaceTemplateVersionId
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["spaceTemplateVersionId"],
      message: "Template version aliases must match",
    });
  }

  const templateId = value.spaceTemplateId ?? value.spaceId;
  const templateVersionId = value.spaceTemplateVersionId ?? value.spaceVersionId;
  const startMode = value.startMode ?? (templateId ? "template" : "blank");
  if (startMode === "blank" && (templateId || templateVersionId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startMode"],
      message: "Blank Spaces cannot include a Template reference",
    });
  }
  if (startMode === "template" && !templateId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["spaceTemplateId"],
      message: "Template Spaces require a Template id",
    });
  }
  if (templateVersionId && !templateId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["spaceTemplateVersionId"],
      message: "Template versions require a Template id",
    });
  }
  if (value.spaceTemplateId && !templateVersionId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["spaceTemplateVersionId"],
      message: "Canonical Template references must pin a version",
    });
  }
}).transform((value) => {
  const spaceTemplateId = value.spaceTemplateId ?? value.spaceId ?? null;
  const spaceTemplateVersionId = value.spaceTemplateVersionId ?? value.spaceVersionId ?? null;
  const startMode = value.startMode ?? (spaceTemplateId ? "template" : "blank");
  return {
    startMode,
    spaceTemplateId: startMode === "template" ? spaceTemplateId : null,
    spaceTemplateVersionId: startMode === "template" ? spaceTemplateVersionId : null,
    participantUserIds: value.participantUserIds,
    instanceConfig: value.instanceConfig,
    clientRequestId: value.clientRequestId,
    name: value.name,
  };
});

export const roomBootstrapSchema = z.object({
  matrixRoomId: z.string().min(1),
  spaceInstanceId: z.string().min(1),
  projectId: z.string().min(1),
  defaultAgentId: z.string().min(1),
  startMode: z.enum(["blank", "template"]),
  spaceId: spaceTemplateIdSchema.nullable(),
  spaceVersionId: spaceTemplateVersionIdSchema.nullable(),
  spaceTemplateId: spaceTemplateIdSchema.nullable(),
  spaceTemplateVersionId: spaceTemplateVersionIdSchema.nullable(),
  status: z.literal("active"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const roomMetadataLookupRequestSchema = z.object({
  matrixRoomIds: z.array(z.string().min(1)).max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Room ids must be unique"),
});

export const roomMetadataLookupResponseSchema = z.object({
  rooms: z.array(roomBootstrapSchema),
});

export type CreateRoomRequest = z.input<typeof createRoomRequestSchema>;
export type NormalizedCreateRoomRequest = z.output<typeof createRoomRequestSchema>;
export type RoomBootstrap = z.infer<typeof roomBootstrapSchema>;
export type RoomMetadataLookupResponse = z.infer<typeof roomMetadataLookupResponseSchema>;
