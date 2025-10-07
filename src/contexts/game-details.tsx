import { invoke } from "@tauri-apps/api/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  GameRepack,
  GameStats,
  ShopDetails,
  LibraryGame,
  UserAchievement,
} from "@/types";
import { useAppDispatch } from "@/store";
import { setHeaderTitle } from "@/features/appSlice";

export interface GameDetailsContext {
  // Core Data
  shopDetails: ShopDetails | null;
  stats: GameStats | null;
  repacks: GameRepack[];
  game: LibraryGame | null;
  achievements: UserAchievement[] | null;
  gameTitle: string; // HYDRA PATTERN: Fallback title for graceful degradation
  
  // Loading States
  isLoading: boolean;
  
  // Modal States
  showGameOptionsModal: boolean;
  setShowGameOptionsModal: (show: boolean) => void;
  showDownloadModal: boolean;
  setShowDownloadModal: (show: boolean) => void;
  
  // Actions
  updateRepacks: () => Promise<void>;
  updateGame: () => Promise<void>;
}

const gameDetailsContext = createContext<GameDetailsContext>({
  shopDetails: null,
  stats: null,
  repacks: [],
  game: null,
  achievements: null,
  gameTitle: "",
  isLoading: true,
  showGameOptionsModal: false,
  setShowGameOptionsModal: () => {},
  showDownloadModal: false,
  setShowDownloadModal: () => {},
  updateRepacks: async () => {},
  updateGame: async () => {},
});

export const { Provider } = gameDetailsContext;

export const useGameDetails = () => useContext(gameDetailsContext);

export interface GameDetailsProviderProps {
  objectId: string;
  shop: string;
  gameTitle: string; // HYDRA PATTERN: Title from URL query param
  children: React.ReactNode;
}

export function GameDetailsProvider({
  objectId,
  shop,
  gameTitle,
  children,
}: GameDetailsProviderProps) {
  const dispatch = useAppDispatch();
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [repacks, setRepacks] = useState<GameRepack[]>([]);
  const [game, setGame] = useState<LibraryGame | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showGameOptionsModal, setShowGameOptionsModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Fetch shop details (Steam API) - Skip for custom games
  // HYDRA PATTERN: Silent error handling, no throwing
  const fetchShopDetails = useCallback(async () => {
    // Skip fetching for custom games
    if (shop === "custom") {
      return;
    }
    
    try {
      const details = await invoke<ShopDetails>(
        "get_game_shop_details",
        {
          objectId,
          language: "english", // TODO: Get from settings
        }
      );
      
      setShopDetails({ ...details, objectId });
    } catch (error) {
      // HYDRA PATTERN: Silent error - just log, don't throw, don't block
      const errorMsg = String(error);
      
      if (errorMsg.includes("429")) {
        console.warn("⚠️ Rate limited by Steam API. Page will work with limited data.");
      } else if (errorMsg.includes("503")) {
        console.warn("⚠️ Steam Store API is temporarily unavailable. Page will work with limited data.");
      } else if (errorMsg.includes("Circuit breaker")) {
        console.warn("⚠️ Circuit breaker is open. Page will work with cached/limited data.");
      } else {
        console.warn("⚠️ Could not fetch shop details. Page will work with limited data.");
      }
      
      // HYDRA PATTERN: Don't set to null - leave as is, let UI handle with fallbacks
      // shopDetails will remain null if this is first load, or keep old data if cached
    }
  }, [objectId, shop]);

  // Fetch game stats (Hydra API) - Skip for custom games
  // HYDRA PATTERN: Silent error handling
  const fetchStats = useCallback(async () => {
    // Skip fetching for custom games
    if (shop === "custom") {
      return;
    }
    
    try {
      const gameStats = await invoke<GameStats>("get_game_stats", {
        objectId,
        shop,
      });
      
      setStats(gameStats);
      
      // Save shop assets if available
      if (gameStats?.assets) {
        try {
          await invoke("save_game_shop_assets", {
            shop,
            objectId,
            assets: gameStats.assets,
          });
        } catch (error) {
          // Silent - saving assets is nice-to-have, not critical
          console.warn("Could not save shop assets to cache:", error);
        }
      }
    } catch (error) {
      // HYDRA PATTERN: Silent error - stats are optional, don't block UI
      console.warn("⚠️ Could not fetch game stats. Some features may be limited.");
      // Don't set to null - leave as is
    }
  }, [objectId, shop]);

  // Fetch repacks (Hydra API)
  const updateRepacks = useCallback(async () => {
    try {
      // TODO: Implement get_game_repacks Rust command
      // const gameRepacks = await invoke<GameRepack[]>("get_game_repacks", {
      //   objectId,
      //   shop,
      // });
      // setRepacks(gameRepacks);
      
      // Placeholder for now
      setRepacks([]);
    } catch (error) {
      console.error("Failed to fetch repacks:", error);
      setRepacks([]);
    }
  }, [objectId, shop]);

  // Fetch game from library
  const updateGame = useCallback(async () => {
    try {
      const libraryGame = await invoke<LibraryGame | null>("get_library_game", {
        shop,
        objectId,
      });
      
      console.log("[GameDetails] Library game fetched:", libraryGame);
      setGame(libraryGame);
    } catch (error) {
      console.error("Failed to fetch library game:", error);
      setGame(null);
    }
  }, [objectId, shop]);

  // Fetch achievements - Skip for custom games
  // HYDRA PATTERN: Silent error handling
  const fetchAchievements = useCallback(async () => {
    // Skip fetching for custom games
    if (shop === "custom") {
      return;
    }
    
    try {
      const gameAchievements = await invoke<UserAchievement[]>("get_game_achievements_command", {
        shop,
        objectId,
        language: "english", // TODO: Get from settings
      });
      
      console.log("[GameDetails] Achievements fetched:", gameAchievements.length);
      setAchievements(gameAchievements);
    } catch (error) {
      // HYDRA PATTERN: Silent error - achievements are optional
      console.warn("⚠️ Could not fetch achievements. Achievement features may be limited.");
      // Set to empty array so UI knows we tried but failed
      setAchievements([]);
    }
  }, [objectId, shop]);

  // Set header title when component mounts or objectId changes
  useEffect(() => {
    // Reset header title first
    dispatch(setHeaderTitle(""));
  }, [objectId, dispatch]);

  // Update header title when shopDetails loads
  useEffect(() => {
    if (shopDetails?.name) {
      dispatch(setHeaderTitle(shopDetails.name));
    }
  }, [shopDetails?.name, dispatch]);

  // Initial data fetch
  // HYDRA PATTERN: Use Promise.allSettled to never block loading
  useEffect(() => {
    const loadGameDetails = async () => {
      setIsLoading(true);
      
      // HYDRA PATTERN: Promise.allSettled instead of Promise.all
      // This ensures loading always completes, even if some requests fail
      const results = await Promise.allSettled([
        fetchShopDetails(),
        fetchStats(),
        updateRepacks(),
        updateGame(),
        fetchAchievements(),
      ]);
      
      // Log which requests failed (for debugging)
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const names = ['shopDetails', 'stats', 'repacks', 'game', 'achievements'];
          console.warn(`[GameDetails] ${names[index]} fetch failed:`, result.reason);
        }
      });
      
      // HYDRA PATTERN: ALWAYS end loading, no matter what
      setIsLoading(false);
    };

    loadGameDetails();
  }, [fetchShopDetails, fetchStats, updateRepacks, updateGame, fetchAchievements]);

  const value = useMemo<GameDetailsContext>(
    () => ({
      shopDetails,
      stats,
      repacks,
      game,
      achievements,
      gameTitle, // HYDRA PATTERN: Always available from URL
      isLoading,
      showGameOptionsModal,
      setShowGameOptionsModal,
      showDownloadModal,
      setShowDownloadModal,
      updateRepacks,
      updateGame,
    }),
    [shopDetails, stats, repacks, game, achievements, gameTitle, isLoading, showGameOptionsModal, showDownloadModal, updateRepacks, updateGame]
  );

  return <Provider value={value}>{children}</Provider>;
}

