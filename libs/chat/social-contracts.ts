import { z } from "zod";

export const socialPersonSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  matrixUserId: z.string().nullable(),
});

export const socialFriendRequestSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["incoming", "outgoing"]),
  status: z.enum(["pending", "accepted", "rejected"]),
  person: socialPersonSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const socialSnapshotSchema = z.object({
  contacts: z.array(socialPersonSchema),
  incomingRequests: z.array(socialFriendRequestSchema),
  outgoingRequests: z.array(socialFriendRequestSchema),
  blockedUserIds: z.array(z.string()),
  blockedUsers: z.array(socialPersonSchema),
});

export const userSearchResponseSchema = z.object({
  users: z.array(socialPersonSchema),
});

export const sendFriendRequestSchema = z.object({
  recipientUserId: z.string().min(1),
});

export const blockUserSchema = z.object({
  userId: z.string().min(1),
});

export type SocialPerson = z.infer<typeof socialPersonSchema>;
export type SocialFriendRequest = z.infer<typeof socialFriendRequestSchema>;
export type SocialSnapshot = z.infer<typeof socialSnapshotSchema>;
