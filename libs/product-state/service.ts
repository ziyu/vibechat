import { builtInChatSpaces } from "@config";
import type {
  ProductRoomAccessReader,
  ProductStateRepository,
} from "./contracts";
import type {
  ProductRoomPreference,
  ProductUserPreferences,
} from "./types";

export type ProductStateErrorCode = "PRODUCT_ROOM_NOT_FOUND" | "PRODUCT_SPACE_NOT_FOUND";

export class ProductStateError extends Error {
  constructor(readonly code: ProductStateErrorCode) {
    super(code);
    this.name = "ProductStateError";
  }
}

export class ProductStateService {
  constructor(private readonly options: {
    repository: ProductStateRepository;
    rooms: ProductRoomAccessReader;
    now?: () => Date;
  }) {}

  getSnapshot(userId: string) {
    return this.options.repository.getSnapshot(userId);
  }

  async getSpaceDirectory(locale: "en" | "zh-CN") {
    const counts = await this.options.repository.getSpaceFavoriteCounts();
    return builtInChatSpaces.map((space) => ({
      id: space.spaceId,
      versionId: space.spaceVersionId,
      semanticVersion: space.semanticVersion,
      integrity: space.integrity,
      name: space.name[locale],
      summary: space.summary[locale],
      author: space.author,
      category: space.category,
      icon: space.icon,
      accent: space.accent,
      canvas: space.canvas,
      permissions: space.permissions,
      networkDomains: space.networkDomains,
      official: space.official,
      favoriteCount: counts[space.spaceId] || 0,
      source: "builtin" as const,
    }));
  }

  async updatePreferences(
    userId: string,
    current: ProductUserPreferences,
    patch: Partial<ProductUserPreferences>,
  ) {
    return this.options.repository.upsertPreferences(
      userId,
      { ...current, ...patch },
      this.options.now?.() || new Date(),
    );
  }

  async updateRoomPreference(
    userId: string,
    preference: ProductRoomPreference,
  ) {
    const rooms = await this.options.rooms.getAccessibleByMatrixRoomIds(
      userId,
      [preference.matrixRoomId],
    );
    if (!rooms.length) throw new ProductStateError("PRODUCT_ROOM_NOT_FOUND");
    return this.options.repository.upsertRoomPreference(
      userId,
      preference,
      this.options.now?.() || new Date(),
    );
  }

  async setSpaceFavorite(userId: string, spaceId: string, favorite: boolean) {
    if (!builtInChatSpaces.some((space) => space.spaceId === spaceId)) {
      throw new ProductStateError("PRODUCT_SPACE_NOT_FOUND");
    }
    await this.options.repository.setSpaceFavorite(
      userId,
      spaceId,
      favorite,
      this.options.now?.() || new Date(),
    );
  }
}
