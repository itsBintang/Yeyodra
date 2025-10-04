// Add your type definitions here

export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface AppSettings {
  theme: "light" | "dark";
  language: string;
}

export enum CatalogueCategory {
  Hot = "hot",
  Weekly = "weekly",
  Achievements = "achievements",
}

export interface CatalogueGame {
  object_id: string;
  shop: string;
  title: string;
  library_image_url?: string;
  background_image_url?: string;
  // Keep camelCase versions for compatibility
  objectId?: string;
  libraryImageUrl?: string;
  backgroundImageUrl?: string;
}

export interface Steam250Game {
  object_id: string;
  title: string;
  // Keep camelCase version for compatibility
  objectId?: string;
}

export interface TrendingGame {
  uri: string;
  libraryHeroImageUrl: string;
  logoImageUrl: string;
  description?: string;
}

export interface ShopAssets {
  objectId: string;
  shop: string;
  title: string;
  iconUrl?: string | null;
  libraryHeroImageUrl?: string | null;
  libraryImageUrl?: string | null;
  logoImageUrl?: string | null;
  logoPosition?: string | null;
  coverImageUrl?: string | null;
}

export interface GameStats {
  download_count: number;
  player_count: number;
  assets?: ShopAssets | null;
}

export interface CatalogueSearchPayload {
  title: string;
  downloadSourceFingerprints: string[];
  tags: number[];
  publishers: string[];
  genres: string[];
  developers: string[];
}

export interface CatalogueSearchResult {
  id: string;
  objectId: string;
  title: string;
  shop: string;
  genres: string[];
  libraryImageUrl?: string;
}

export interface CatalogueSearchResponse {
  edges: CatalogueSearchResult[];
  count: number;
}

// Steam Types
export interface SteamGenre {
  id: string;
  description: string;
}

export interface SteamCategory {
  id: number;
  description: string;
}

export interface SteamScreenshot {
  id: number;
  path_thumbnail: string;
  path_full: string;
}

export interface SteamVideoSource {
  max: string;
  "480": string;
}

export interface SteamMovie {
  id: number;
  mp4: SteamVideoSource;
  webm: SteamVideoSource;
  thumbnail: string;
  name: string;
  highlight: boolean;
}

export interface SteamAppDetails {
  type: string;
  name: string;
  steam_appid: number;
  is_free: boolean;
  detailed_description: string;
  about_the_game: string;
  short_description: string;
  header_image?: string;
  capsule_image?: string;
  screenshots?: SteamScreenshot[];
  movies?: SteamMovie[];
  developers?: string[];
  publishers?: string[];
  genres?: SteamGenre[];
  categories?: SteamCategory[];
  supported_languages: string;
  pc_requirements: {
    minimum: string;
    recommended: string;
  };
  mac_requirements: {
    minimum: string;
    recommended: string;
  };
  linux_requirements: {
    minimum: string;
    recommended: string;
  };
  release_date: {
    coming_soon: boolean;
    date: string;
  };
  content_descriptors: {
    ids: number[];
  };
}

export type ShopDetails = SteamAppDetails & {
  objectId: string;
};

export type ShopDetailsWithAssets = ShopDetails & {
  assets: ShopAssets | null;
};

// Game Download Status
export type DownloadStatus = "active" | "paused" | "complete" | "error";

export interface Download {
  shop: string;
  objectId: string;
  uri: string;
  downloadPath: string;
  progress: number;
  status: DownloadStatus;
  bytesDownloaded: number;
  fileSize: number;
}

// Library Game (Game in user's library)
export interface LibraryGame {
  id: string;
  title: string;
  objectId: string;
  shop: string;
  iconUrl: string | null;
  libraryHeroImageUrl: string | null;
  logoImageUrl: string | null;
  playTimeInSeconds: number;
  lastTimePlayed: string | null;
  isDeleted: boolean;
  favorite: boolean;
  isPinned: boolean;
}

// Game Repack
export interface GameRepack {
  id: string;
  title: string;
  uris: string[];
  uploadDate: string | null;
  fileSize: string;
  repacker: string;
}

