export type ProductTheme = "light" | "dark" | "system";
export type ProductLocale = "en" | "zh-CN";

export interface ProductUserPreferences {
  notificationsEnabled: boolean;
  theme: ProductTheme;
  locale: ProductLocale;
}

export interface ProductRoomPreference {
  matrixRoomId: string;
  pinned: boolean;
  muted: boolean;
}

export interface ProductStateSnapshot {
  preferences: ProductUserPreferences;
  roomPreferences: ProductRoomPreference[];
  favoriteSpaceIds: string[];
}
