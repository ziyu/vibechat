import type { SocialPerson } from "@vibechat/api-contracts";

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export interface FriendRequestRecord {
  id: string;
  senderId: string;
  recipientId: string;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialSnapshotRecords {
  contacts: SocialPerson[];
  incoming: Array<{ request: FriendRequestRecord; person: SocialPerson }>;
  outgoing: Array<{ request: FriendRequestRecord; person: SocialPerson }>;
  blockedUserIds: string[];
}
