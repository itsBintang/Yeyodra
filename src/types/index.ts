// Add your type definitions here

// User Profile Types (Local - No Auth)
export interface UserProfile {
  id: string;
  displayName: string;
  profileImageUrl?: string;
  backgroundImageUrl?: string;
  createdAt: string;
}

export interface UserStats {
  libraryCount: number;
  totalPlaytime: number; // in seconds
  gamesPlayed: number;
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
  downloadCount: number;
  playerCount: number;
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

// Download History Types
export interface CompletedDownload {
  appId: string;
  title: string;
  downloadType: string; // "SteamTools" or "Repack"
  completedAt: number; // Unix timestamp
  iconUrl: string | null;
}

// Aria2c Download Types
export interface Aria2DownloadStatus {
  gid: string;
  status: "active" | "waiting" | "paused" | "error" | "complete" | "removed";
  totalLength: string;
  completedLength: string;
  downloadSpeed: string;
  files: Aria2FileInfo[];
}

export interface Aria2FileInfo {
  path: string;
  length: string;
  completedLength: string;
}

export interface Aria2GlobalStat {
  downloadSpeed: string;
  numActive: string;
  numWaiting: string;
  numStopped: string;
}

// Game Download Status (Extended with aria2c integration)
export type DownloadStatus = "active" | "paused" | "complete" | "error" | "queued";

export interface Download {
  shop: string;
  objectId: string;
  title: string;
  uri: string;
  downloadPath: string;
  progress: number;
  status: DownloadStatus;
  bytesDownloaded: number;
  fileSize: number;
  downloadSpeed?: number;
  gid?: string; // Aria2c GID for tracking
  filename?: string;
  createdAt: string;
  updatedAt: string;
}

// Library Game (Game in user's library)
export interface LibraryGame {
  id: string;
  title: string;
  objectId: string;
  shop: string;
  iconUrl: string | null;
  coverImageUrl: string | null;
  libraryHeroImageUrl: string | null;
  logoImageUrl: string | null;
  playTimeInSeconds: number;
  lastTimePlayed: string | null;
  isDeleted: boolean;
  favorite: boolean;
  isPinned: boolean;
  executablePath?: string | null;
  launchOptions?: string | null;
  isInstalled?: boolean; // NEW: Track if game is installed via SteamTools
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

// User Preferences (Simplified - Only essential settings)
export interface UserPreferences {
  downloadsPath?: string | null;
  steamPath?: string | null;
  language?: string;
}

// Achievement Types
export interface SteamAchievement {
  name: string;
  displayName: string;
  description?: string;
  icon: string;
  icongray: string;
  hidden: boolean;
  points?: number;
}

export interface UnlockedAchievement {
  name: string;
  unlockTime: number;
}

export interface UserAchievement extends SteamAchievement {
  unlocked: boolean;
  unlockTime: number | null;
}

