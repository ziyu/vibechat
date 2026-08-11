import { and, eq, inArray, like, ne, or } from "drizzle-orm";
import {
  block,
  contact,
  db,
  friendRequest,
  isD1Dialect,
  isSqliteDialect,
  matrixIdentity,
  runD1Batch,
  user,
  userProfile,
} from "@libs/database";
import type { SocialPerson } from "@libs/chat";
import type { SocialRepository } from "./contracts";
import type { FriendRequestRecord, SocialSnapshotRecords } from "./types";

const profileSelection = {
  id: userProfile.userId,
  username: userProfile.username,
  displayName: userProfile.displayName,
  avatarUrl: userProfile.avatarUrl,
  matrixUserId: matrixIdentity.matrixUserId,
};

export class DatabaseSocialRepository implements SocialRepository {
  async findProfile(userId: string) {
    const [profile] = await db
      .select(profileSelection)
      .from(userProfile)
      .leftJoin(matrixIdentity, eq(matrixIdentity.userId, userProfile.userId))
      .where(eq(userProfile.userId, userId))
      .limit(1);
    return (profile as SocialPerson | undefined) || null;
  }

  async searchProfiles(actorUserId: string, query: string, limit: number) {
    const normalized = query.trim().toLowerCase();
    const predicate = normalized.includes("@")
      ? eq(user.email, normalized)
      : like(userProfile.username, `%${normalized}%`);
    const profiles = await db
      .select(profileSelection)
      .from(userProfile)
      .innerJoin(user, eq(user.id, userProfile.userId))
      .leftJoin(matrixIdentity, eq(matrixIdentity.userId, userProfile.userId))
      .where(and(ne(userProfile.userId, actorUserId), predicate))
      .limit(limit * 2);

    const visible: SocialPerson[] = [];
    for (const profile of profiles) {
      if (await this.hasBlockBetween(actorUserId, profile.id)) continue;
      visible.push(profile as SocialPerson);
      if (visible.length === limit) break;
    }
    return visible;
  }

  async getFriendRequest(id: string) {
    const [request] = await db
      .select()
      .from(friendRequest)
      .where(eq(friendRequest.id, id))
      .limit(1);
    return (request as FriendRequestRecord | undefined) || null;
  }

  async getDirectedFriendRequest(senderId: string, recipientId: string) {
    const [request] = await db
      .select()
      .from(friendRequest)
      .where(and(
        eq(friendRequest.senderId, senderId),
        eq(friendRequest.recipientId, recipientId),
      ))
      .limit(1);
    return (request as FriendRequestRecord | undefined) || null;
  }

  async upsertFriendRequest(record: FriendRequestRecord) {
    await db.insert(friendRequest).values(record).onConflictDoUpdate({
      target: [friendRequest.senderId, friendRequest.recipientId],
      set: { status: "pending", updatedAt: record.updatedAt },
    });
    const stored = await this.getDirectedFriendRequest(record.senderId, record.recipientId);
    if (!stored) throw new Error("Friend request could not be persisted");
    return stored;
  }

  async isContact(userId: string, contactUserId: string) {
    const [stored] = await db
      .select({ userId: contact.userId })
      .from(contact)
      .where(and(eq(contact.userId, userId), eq(contact.contactUserId, contactUserId)))
      .limit(1);
    return !!stored;
  }

  async hasBlockBetween(firstUserId: string, secondUserId: string) {
    const [stored] = await db
      .select({ blockerId: block.blockerId })
      .from(block)
      .where(or(
        and(eq(block.blockerId, firstUserId), eq(block.blockedUserId, secondUserId)),
        and(eq(block.blockerId, secondUserId), eq(block.blockedUserId, firstUserId)),
      ))
      .limit(1);
    return !!stored;
  }

  async getSnapshot(userId: string) {
    const contactRows = await db
      .select({ contactUserId: contact.contactUserId })
      .from(contact)
      .where(eq(contact.userId, userId));
    const contacts = (await Promise.all(
      contactRows.map((row) => this.findProfile(row.contactUserId)),
    )).filter((person): person is SocialPerson => !!person);
    const requests = await db
      .select()
      .from(friendRequest)
      .where(or(eq(friendRequest.senderId, userId), eq(friendRequest.recipientId, userId)));
    const incoming: SocialSnapshotRecords["incoming"] = [];
    const outgoing: SocialSnapshotRecords["outgoing"] = [];
    for (const rawRequest of requests) {
      const request = rawRequest as FriendRequestRecord;
      const incomingRequest = request.recipientId === userId;
      const person = await this.findProfile(
        incomingRequest ? request.senderId : request.recipientId,
      );
      if (!person) continue;
      (incomingRequest ? incoming : outgoing).push({ request, person });
    }
    const blockedRows = await db
      .select({ userId: block.blockedUserId })
      .from(block)
      .where(eq(block.blockerId, userId));

    return {
      contacts,
      incoming,
      outgoing,
      blockedUserIds: blockedRows.map((row) => row.userId),
    };
  }

  async acceptFriendRequest(request: FriendRequestRecord, acceptedAt: Date) {
    const updateRequest = db.update(friendRequest).set({
      status: "accepted",
      updatedAt: acceptedAt,
    }).where(and(
      eq(friendRequest.id, request.id),
      eq(friendRequest.recipientId, request.recipientId),
      eq(friendRequest.status, "pending"),
    ));
    const firstContact = db.insert(contact).values({
      userId: request.senderId,
      contactUserId: request.recipientId,
      createdAt: acceptedAt,
    }).onConflictDoNothing();
    const secondContact = db.insert(contact).values({
      userId: request.recipientId,
      contactUserId: request.senderId,
      createdAt: acceptedAt,
    }).onConflictDoNothing();

    if (isD1Dialect()) {
      await runD1Batch([updateRequest, firstContact, secondContact] as const);
      return;
    }
    if (isSqliteDialect()) {
      (db as any).transaction((tx: any) => {
        tx.update(friendRequest).set({ status: "accepted", updatedAt: acceptedAt })
          .where(and(eq(friendRequest.id, request.id), eq(friendRequest.status, "pending")))
          .run();
        tx.insert(contact).values([
          { userId: request.senderId, contactUserId: request.recipientId, createdAt: acceptedAt },
          { userId: request.recipientId, contactUserId: request.senderId, createdAt: acceptedAt },
        ]).onConflictDoNothing().run();
      });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(friendRequest).set({ status: "accepted", updatedAt: acceptedAt })
        .where(and(eq(friendRequest.id, request.id), eq(friendRequest.status, "pending")));
      await tx.insert(contact).values([
        { userId: request.senderId, contactUserId: request.recipientId, createdAt: acceptedAt },
        { userId: request.recipientId, contactUserId: request.senderId, createdAt: acceptedAt },
      ]).onConflictDoNothing();
    });
  }

  async rejectFriendRequest(requestId: string, recipientId: string, rejectedAt: Date) {
    const updated = await db.update(friendRequest).set({
      status: "rejected",
      updatedAt: rejectedAt,
    }).where(and(
      eq(friendRequest.id, requestId),
      eq(friendRequest.recipientId, recipientId),
      eq(friendRequest.status, "pending"),
    )).returning({ id: friendRequest.id });
    return updated.length > 0;
  }

  async blockUser(blockerId: string, blockedUserId: string, createdAt: Date) {
    const insertBlock = db.insert(block).values({ blockerId, blockedUserId, createdAt })
      .onConflictDoNothing();
    const deleteContacts = db.delete(contact).where(or(
      and(eq(contact.userId, blockerId), eq(contact.contactUserId, blockedUserId)),
      and(eq(contact.userId, blockedUserId), eq(contact.contactUserId, blockerId)),
    ));
    const rejectRequests = db.update(friendRequest).set({
      status: "rejected",
      updatedAt: createdAt,
    }).where(and(
      or(
        and(eq(friendRequest.senderId, blockerId), eq(friendRequest.recipientId, blockedUserId)),
        and(eq(friendRequest.senderId, blockedUserId), eq(friendRequest.recipientId, blockerId)),
      ),
      eq(friendRequest.status, "pending"),
    ));

    if (isD1Dialect()) {
      await runD1Batch([insertBlock, deleteContacts, rejectRequests] as const);
      return;
    }
    if (isSqliteDialect()) {
      (db as any).transaction((tx: any) => {
        tx.insert(block).values({ blockerId, blockedUserId, createdAt }).onConflictDoNothing().run();
        tx.delete(contact).where(or(
          and(eq(contact.userId, blockerId), eq(contact.contactUserId, blockedUserId)),
          and(eq(contact.userId, blockedUserId), eq(contact.contactUserId, blockerId)),
        )).run();
        tx.update(friendRequest).set({ status: "rejected", updatedAt: createdAt }).where(and(
          or(
            and(eq(friendRequest.senderId, blockerId), eq(friendRequest.recipientId, blockedUserId)),
            and(eq(friendRequest.senderId, blockedUserId), eq(friendRequest.recipientId, blockerId)),
          ),
          eq(friendRequest.status, "pending"),
        )).run();
      });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.insert(block).values({ blockerId, blockedUserId, createdAt }).onConflictDoNothing();
      await tx.delete(contact).where(or(
        and(eq(contact.userId, blockerId), eq(contact.contactUserId, blockedUserId)),
        and(eq(contact.userId, blockedUserId), eq(contact.contactUserId, blockerId)),
      ));
      await tx.update(friendRequest).set({ status: "rejected", updatedAt: createdAt }).where(and(
        or(
          and(eq(friendRequest.senderId, blockerId), eq(friendRequest.recipientId, blockedUserId)),
          and(eq(friendRequest.senderId, blockedUserId), eq(friendRequest.recipientId, blockerId)),
        ),
        eq(friendRequest.status, "pending"),
      ));
    });
  }

  async unblockUser(blockerId: string, blockedUserId: string) {
    await db.delete(block).where(and(
      eq(block.blockerId, blockerId),
      eq(block.blockedUserId, blockedUserId),
    ));
  }
}
