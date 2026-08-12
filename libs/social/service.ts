import type { SocialFriendRequest, SocialSnapshot } from "@vibechat/api-contracts";
import type { SocialRepository } from "./contracts";
import type { FriendRequestRecord } from "./types";

export type SocialServiceErrorCode =
  | "SOCIAL_USER_NOT_FOUND"
  | "SOCIAL_SELF_REQUEST_FORBIDDEN"
  | "SOCIAL_ALREADY_CONTACTS"
  | "SOCIAL_NOT_CONTACT"
  | "SOCIAL_BLOCKED"
  | "SOCIAL_REVERSE_REQUEST_PENDING"
  | "SOCIAL_REQUEST_NOT_FOUND"
  | "SOCIAL_REQUEST_NOT_PENDING";

export class SocialServiceError extends Error {
  readonly code: SocialServiceErrorCode;

  constructor(code: SocialServiceErrorCode) {
    super(code);
    this.name = "SocialServiceError";
    this.code = code;
  }
}

export class SocialService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly repository: SocialRepository, options: {
    now?: () => Date;
    createId?: () => string;
  } = {}) {
    this.now = options.now || (() => new Date());
    this.createId = options.createId || (() => globalThis.crypto.randomUUID());
  }

  searchUsers(actorUserId: string, query: string) {
    return this.repository.searchProfiles(actorUserId, query, 20);
  }

  async sendFriendRequest(senderId: string, recipientId: string) {
    if (senderId === recipientId) {
      throw new SocialServiceError("SOCIAL_SELF_REQUEST_FORBIDDEN");
    }
    if (!await this.repository.findProfile(recipientId)) {
      throw new SocialServiceError("SOCIAL_USER_NOT_FOUND");
    }
    if (await this.repository.hasBlockBetween(senderId, recipientId)) {
      throw new SocialServiceError("SOCIAL_BLOCKED");
    }
    if (await this.repository.isContact(senderId, recipientId)) {
      throw new SocialServiceError("SOCIAL_ALREADY_CONTACTS");
    }
    const reverse = await this.repository.getDirectedFriendRequest(recipientId, senderId);
    if (reverse?.status === "pending") {
      throw new SocialServiceError("SOCIAL_REVERSE_REQUEST_PENDING");
    }
    const now = this.now();
    return this.repository.upsertFriendRequest({
      id: this.createId(),
      senderId,
      recipientId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  async getSnapshot(userId: string): Promise<SocialSnapshot> {
    const records = await this.repository.getSnapshot(userId);
    const blockedUsers = (await Promise.all(
      records.blockedUserIds.map((blockedUserId) => this.repository.findProfile(blockedUserId)),
    )).filter((person): person is SocialSnapshot["contacts"][number] => !!person);
    const mapRequest = (
      item: { request: FriendRequestRecord; person: SocialSnapshot["contacts"][number] },
      direction: SocialFriendRequest["direction"],
    ): SocialFriendRequest => ({
      id: item.request.id,
      direction,
      status: item.request.status,
      person: item.person,
      createdAt: item.request.createdAt.toISOString(),
      updatedAt: item.request.updatedAt.toISOString(),
    });
    return {
      contacts: records.contacts,
      incomingRequests: records.incoming.map((item) => mapRequest(item, "incoming")),
      outgoingRequests: records.outgoing.map((item) => mapRequest(item, "outgoing")),
      blockedUserIds: records.blockedUserIds,
      blockedUsers,
    };
  }

  async acceptFriendRequest(recipientId: string, requestId: string) {
    const request = await this.requirePendingRecipientRequest(recipientId, requestId);
    if (await this.repository.hasBlockBetween(request.senderId, request.recipientId)) {
      throw new SocialServiceError("SOCIAL_BLOCKED");
    }
    await this.repository.acceptFriendRequest(request, this.now());
  }

  async rejectFriendRequest(recipientId: string, requestId: string) {
    await this.requirePendingRecipientRequest(recipientId, requestId);
    if (!await this.repository.rejectFriendRequest(requestId, recipientId, this.now())) {
      throw new SocialServiceError("SOCIAL_REQUEST_NOT_PENDING");
    }
  }

  async blockUser(blockerId: string, blockedUserId: string) {
    if (blockerId === blockedUserId) {
      throw new SocialServiceError("SOCIAL_SELF_REQUEST_FORBIDDEN");
    }
    if (!await this.repository.findProfile(blockedUserId)) {
      throw new SocialServiceError("SOCIAL_USER_NOT_FOUND");
    }
    await this.repository.blockUser(blockerId, blockedUserId, this.now());
  }

  unblockUser(blockerId: string, blockedUserId: string) {
    return this.repository.unblockUser(blockerId, blockedUserId);
  }

  async updateContactRemark(userId: string, contactUserId: string, remark: string | null) {
    if (!await this.repository.isContact(userId, contactUserId)) {
      throw new SocialServiceError("SOCIAL_NOT_CONTACT");
    }
    const normalized = remark?.trim() || null;
    if (!await this.repository.updateContactRemark(userId, contactUserId, normalized)) {
      throw new SocialServiceError("SOCIAL_NOT_CONTACT");
    }
  }

  async assertCanInvite(inviterUserId: string, participantUserIds: string[]) {
    for (const participantUserId of participantUserIds) {
      if (await this.repository.hasBlockBetween(inviterUserId, participantUserId)) {
        throw new SocialServiceError("SOCIAL_BLOCKED");
      }
      if (!await this.repository.isContact(inviterUserId, participantUserId)) {
        throw new SocialServiceError("SOCIAL_NOT_CONTACT");
      }
    }
  }

  private async requirePendingRecipientRequest(recipientId: string, requestId: string) {
    const request = await this.repository.getFriendRequest(requestId);
    if (!request || request.recipientId !== recipientId) {
      throw new SocialServiceError("SOCIAL_REQUEST_NOT_FOUND");
    }
    if (request.status !== "pending") {
      throw new SocialServiceError("SOCIAL_REQUEST_NOT_PENDING");
    }
    return request;
  }
}
