import type {
  ProductRoomPreference,
  ProductStateSnapshot,
  ProductUserPreferences,
} from "./types";

export interface ProductStateRepository {
  getSnapshot(userId: string): Promise<ProductStateSnapshot>;
  getSpaceFavoriteCounts(): Promise<Record<string, number>>;
  upsertPreferences(
    userId: string,
    preferences: ProductUserPreferences,
    updatedAt: Date,
  ): Promise<ProductUserPreferences>;
  upsertRoomPreference(
    userId: string,
    preference: ProductRoomPreference,
    updatedAt: Date,
  ): Promise<ProductRoomPreference>;
  setSpaceFavorite(
    userId: string,
    spaceId: string,
    favorite: boolean,
    createdAt: Date,
  ): Promise<void>;
}

export interface ProductRoomAccessReader {
  getAccessibleByMatrixRoomIds(
    userId: string,
    matrixRoomIds: string[],
  ): Promise<Array<{ matrixRoomId: string }>>;
}
