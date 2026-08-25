import { z } from "zod";

export const createRoomRequestSchema = z.object({
  spaceId: z.string().min(1).max(128),
  participantUserIds: z.array(z.string().min(1)).max(49)
    .refine((ids) => new Set(ids).size === ids.length, "Participants must be unique"),
  instanceConfig: z.record(z.string(), z.unknown()).default({}),
  clientRequestId: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80),
});

export const roomBootstrapSchema = z.object({
  matrixRoomId: z.string().min(1),
  spaceInstanceId: z.string().min(1),
  projectId: z.string().min(1),
  defaultAgentId: z.string().min(1),
  spaceId: z.string().min(1),
  spaceVersionId: z.string().min(1),
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

export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;
export type RoomBootstrap = z.infer<typeof roomBootstrapSchema>;
export type RoomMetadataLookupResponse = z.infer<typeof roomMetadataLookupResponseSchema>;
