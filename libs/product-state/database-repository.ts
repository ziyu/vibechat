import { and, count, eq } from "drizzle-orm";
import {
  db,
  roomUserPreference,
  spaceFavorite,
  userPreference,
} from "@libs/database";
import type { ProductStateRepository } from "./contracts";
import type {
  ProductRoomPreference,
  ProductUserPreferences,
} from "./types";

const defaultPreferences: ProductUserPreferences = {
  notificationsEnabled: true,
  theme: "system",
  locale: "en",
};

export class DatabaseProductStateRepository implements ProductStateRepository {
  async getSpaceFavoriteCounts() {
    const rows = await db.select({
      spaceId: spaceFavorite.spaceId,
      favoriteCount: count(),
    }).from(spaceFavorite).groupBy(spaceFavorite.spaceId);
    return Object.fromEntries(rows.map((row) => [row.spaceId, row.favoriteCount]));
  }

  async getSnapshot(userId: string) {
    const [preferencesRow] = await db.select().from(userPreference)
      .where(eq(userPreference.userId, userId)).limit(1);
    const roomRows = await db.select().from(roomUserPreference)
      .where(eq(roomUserPreference.userId, userId));
    const favoriteRows = await db.select().from(spaceFavorite)
      .where(eq(spaceFavorite.userId, userId));

    return {
      preferences: preferencesRow ? this.toPreferences(preferencesRow) : defaultPreferences,
      roomPreferences: roomRows.map((row) => ({
        matrixRoomId: row.matrixRoomId,
        pinned: row.pinned,
        muted: row.muted,
      })),
      favoriteSpaceIds: favoriteRows.map((row) => row.spaceId),
    };
  }

  async upsertPreferences(
    userId: string,
    preferences: ProductUserPreferences,
    updatedAt: Date,
  ) {
    const [stored] = await db.insert(userPreference).values({
      userId,
      ...preferences,
      updatedAt,
    }).onConflictDoUpdate({
      target: userPreference.userId,
      set: { ...preferences, updatedAt },
    }).returning();
    return this.toPreferences(stored);
  }

  async upsertRoomPreference(
    userId: string,
    preference: ProductRoomPreference,
    updatedAt: Date,
  ) {
    const [stored] = await db.insert(roomUserPreference).values({
      userId,
      ...preference,
      updatedAt,
    }).onConflictDoUpdate({
      target: [roomUserPreference.userId, roomUserPreference.matrixRoomId],
      set: { pinned: preference.pinned, muted: preference.muted, updatedAt },
    }).returning();
    return {
      matrixRoomId: stored.matrixRoomId,
      pinned: stored.pinned,
      muted: stored.muted,
    };
  }

  async setSpaceFavorite(
    userId: string,
    spaceId: string,
    favorite: boolean,
    createdAt: Date,
  ) {
    if (favorite) {
      await db.insert(spaceFavorite).values({ userId, spaceId, createdAt })
        .onConflictDoNothing();
      return;
    }
    await db.delete(spaceFavorite).where(and(
      eq(spaceFavorite.userId, userId),
      eq(spaceFavorite.spaceId, spaceId),
    ));
  }

  private toPreferences(stored: typeof userPreference.$inferSelect): ProductUserPreferences {
    return {
      notificationsEnabled: stored.notificationsEnabled,
      theme: stored.theme as ProductUserPreferences["theme"],
      locale: stored.locale as ProductUserPreferences["locale"],
    };
  }
}
