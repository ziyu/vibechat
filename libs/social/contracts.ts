import type { SocialPerson } from "@vibechat/api-contracts";
import type { FriendRequestRecord, SocialSnapshotRecords } from "./types";

export interface SocialRepository {
  findProfile(userId: string): Promise<SocialPerson | null>;
  searchProfiles(actorUserId: string, query: string, limit: number): Promise<SocialPerson[]>;
  getFriendRequest(id: string): Promise<FriendRequestRecord | null>;
  getDirectedFriendRequest(
    senderId: string,
    recipientId: string,
  ): Promise<FriendRequestRecord | null>;
  upsertFriendRequest(record: FriendRequestRecord): Promise<FriendRequestRecord>;
  isContact(userId: string, contactUserId: string): Promise<boolean>;
  hasBlockBetween(firstUserId: string, secondUserId: string): Promise<boolean>;
  getSnapshot(userId: string): Promise<SocialSnapshotRecords>;
  updateContactRemark(
    userId: string,
    contactUserId: string,
    remark: string | null,
  ): Promise<boolean>;
  acceptFriendRequest(request: FriendRequestRecord, acceptedAt: Date): Promise<void>;
  rejectFriendRequest(requestId: string, recipientId: string, rejectedAt: Date): Promise<boolean>;
  blockUser(blockerId: string, blockedUserId: string, createdAt: Date): Promise<void>;
  unblockUser(blockerId: string, blockedUserId: string): Promise<void>;
}
