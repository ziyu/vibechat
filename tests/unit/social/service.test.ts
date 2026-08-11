import { describe, expect, it } from "vitest";
import type { SocialPerson } from "@libs/chat";
import type { SocialRepository } from "@libs/social/contracts";
import { SocialService, SocialServiceError } from "@libs/social/service";
import type { FriendRequestRecord, SocialSnapshotRecords } from "@libs/social/types";

class MemorySocialRepository implements SocialRepository {
  profiles = new Map<string, SocialPerson>();
  requests = new Map<string, FriendRequestRecord>();
  contacts = new Set<string>();
  blocks = new Set<string>();

  constructor() {
    for (const id of ["alice", "bob", "carol"]) {
      this.profiles.set(id, {
        id,
        username: id,
        displayName: id[0].toUpperCase() + id.slice(1),
        avatarUrl: null,
        matrixUserId: `@vibe_${id}:localhost`,
      });
    }
  }

  findProfile(userId: string) { return Promise.resolve(this.profiles.get(userId) || null); }
  searchProfiles(actorUserId: string, query: string) {
    return Promise.resolve([...this.profiles.values()].filter((profile) =>
      profile.id !== actorUserId && profile.username.includes(query.toLowerCase()),
    ));
  }
  getFriendRequest(id: string) { return Promise.resolve(this.requests.get(id) || null); }
  getDirectedFriendRequest(senderId: string, recipientId: string) {
    return Promise.resolve([...this.requests.values()].find((request) =>
      request.senderId === senderId && request.recipientId === recipientId,
    ) || null);
  }
  async upsertFriendRequest(record: FriendRequestRecord) {
    const existing = await this.getDirectedFriendRequest(record.senderId, record.recipientId);
    const stored = existing ? { ...existing, status: "pending" as const, updatedAt: record.updatedAt } : record;
    this.requests.set(stored.id, stored);
    return stored;
  }
  isContact(userId: string, contactUserId: string) {
    return Promise.resolve(this.contacts.has(`${userId}:${contactUserId}`));
  }
  hasBlockBetween(firstUserId: string, secondUserId: string) {
    return Promise.resolve(
      this.blocks.has(`${firstUserId}:${secondUserId}`)
      || this.blocks.has(`${secondUserId}:${firstUserId}`),
    );
  }
  async getSnapshot(userId: string): Promise<SocialSnapshotRecords> {
    const contacts = [...this.contacts]
      .filter((key) => key.startsWith(`${userId}:`))
      .map((key) => this.profiles.get(key.split(':')[1])!);
    const incoming = [];
    const outgoing = [];
    for (const request of this.requests.values()) {
      if (request.recipientId === userId) {
        incoming.push({ request, person: this.profiles.get(request.senderId)! });
      }
      if (request.senderId === userId) {
        outgoing.push({ request, person: this.profiles.get(request.recipientId)! });
      }
    }
    return {
      contacts,
      incoming,
      outgoing,
      blockedUserIds: [...this.blocks]
        .filter((key) => key.startsWith(`${userId}:`))
        .map((key) => key.split(':')[1]),
    };
  }
  async acceptFriendRequest(request: FriendRequestRecord, acceptedAt: Date) {
    this.requests.set(request.id, { ...request, status: "accepted", updatedAt: acceptedAt });
    this.contacts.add(`${request.senderId}:${request.recipientId}`);
    this.contacts.add(`${request.recipientId}:${request.senderId}`);
  }
  async rejectFriendRequest(requestId: string, recipientId: string, rejectedAt: Date) {
    const request = this.requests.get(requestId);
    if (!request || request.recipientId !== recipientId || request.status !== "pending") return false;
    this.requests.set(requestId, { ...request, status: "rejected", updatedAt: rejectedAt });
    return true;
  }
  async blockUser(blockerId: string, blockedUserId: string, createdAt: Date) {
    this.blocks.add(`${blockerId}:${blockedUserId}`);
    this.contacts.delete(`${blockerId}:${blockedUserId}`);
    this.contacts.delete(`${blockedUserId}:${blockerId}`);
    for (const [id, request] of this.requests) {
      if (
        request.status === "pending"
        && new Set([request.senderId, request.recipientId]).has(blockerId)
        && new Set([request.senderId, request.recipientId]).has(blockedUserId)
      ) {
        this.requests.set(id, { ...request, status: "rejected", updatedAt: createdAt });
      }
    }
  }
  async unblockUser(blockerId: string, blockedUserId: string) {
    this.blocks.delete(`${blockerId}:${blockedUserId}`);
  }
}

function createService() {
  const repository = new MemorySocialRepository();
  const now = new Date("2026-08-12T00:00:00.000Z");
  const service = new SocialService(repository, {
    now: () => now,
    createId: () => "request-1",
  });
  return { repository, service };
}

describe("SocialService", () => {
  it("creates one idempotent pending request and projects both inboxes", async () => {
    const { repository, service } = createService();

    const first = await service.sendFriendRequest("alice", "bob");
    const repeated = await service.sendFriendRequest("alice", "bob");

    expect(repeated.id).toBe(first.id);
    expect(repository.requests).toHaveLength(1);
    await expect(service.getSnapshot("alice")).resolves.toMatchObject({
      outgoingRequests: [{ id: first.id, direction: "outgoing", status: "pending" }],
    });
    await expect(service.getSnapshot("bob")).resolves.toMatchObject({
      incomingRequests: [{ id: first.id, direction: "incoming", status: "pending" }],
    });
  });

  it("accepts a request into a symmetric contact relationship", async () => {
    const { repository, service } = createService();
    const request = await service.sendFriendRequest("alice", "bob");

    await service.acceptFriendRequest("bob", request.id);

    expect(await repository.isContact("alice", "bob")).toBe(true);
    expect(await repository.isContact("bob", "alice")).toBe(true);
    await expect(service.getSnapshot("alice")).resolves.toMatchObject({
      contacts: [{ id: "bob" }],
    });
  });

  it("rejects self, reverse-pending, blocked, and non-contact invite flows", async () => {
    const { repository, service } = createService();

    await expect(service.sendFriendRequest("alice", "alice"))
      .rejects.toMatchObject({ code: "SOCIAL_SELF_REQUEST_FORBIDDEN" });
    await service.sendFriendRequest("alice", "bob");
    await expect(service.sendFriendRequest("bob", "alice"))
      .rejects.toMatchObject({ code: "SOCIAL_REVERSE_REQUEST_PENDING" });
    await service.blockUser("bob", "alice");
    await expect(service.sendFriendRequest("alice", "bob"))
      .rejects.toMatchObject({ code: "SOCIAL_BLOCKED" });
    await expect(service.assertCanInvite("alice", ["carol"]))
      .rejects.toMatchObject({ code: "SOCIAL_NOT_CONTACT" });
    expect(repository.contacts.size).toBe(0);
  });

  it("block removes contacts and terminates pending requests", async () => {
    const { repository, service } = createService();
    const request = await service.sendFriendRequest("alice", "bob");
    await service.acceptFriendRequest("bob", request.id);

    await service.blockUser("bob", "alice");

    expect(await repository.isContact("alice", "bob")).toBe(false);
    expect(await repository.isContact("bob", "alice")).toBe(false);
    expect(await repository.hasBlockBetween("alice", "bob")).toBe(true);
  });
});
