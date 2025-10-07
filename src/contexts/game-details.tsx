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
  children: React.ReactNode;
}

export function GameDetailsProvider({
  objectId,
  shop,
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
      console.error("Failed to fetch shop details:", error);
      // Check if it's a 503 error (Steam API down)
      const errorMsg = String(error);
      if (errorMsg.includes("503")) {
        console.warn("⚠️ Steam Store API is temporarily unavailable. This is a Steam server issue, not your connection.");
        console.warn("The app will work with limited information. Try refreshing later.");
      }
      // Don't set shopDetails to null - let the UI handle gracefully
    }
  }, [objectId, shop]);

  // Fetch game stats (Hydra API) - Skip for custom games
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
          console.error("Failed to save shop assets:", error);
        }
      }
    } catch (error) {
      console.error("Failed to fetch game stats:", error);
      // Stats are optional, don't block UI
      setStats(null);
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
      console.error("Failed to fetch achievements:", error);
      // Achievements are optional, set to empty array
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
  useEffect(() => {
    const loadGameDetails = async () => {
      setIsLoading(true);
      
      // Fetch all data in parallel
      await Promise.all([
        fetchShopDetails(),
        fetchStats(),
        updateRepacks(),
        updateGame(),
        fetchAchievements(),
      ]);
      
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
      isLoading,
      showGameOptionsModal,
      setShowGameOptionsModal,
      showDownloadModal,
      setShowDownloadModal,
      updateRepacks,
      updateGame,
    }),
    [shopDetails, stats, repacks, game, achievements, isLoading, showGameOptionsModal, showDownloadModal, updateRepacks, updateGame]
  );

  return <Provider value={value}>{children}</Provider>;
}

