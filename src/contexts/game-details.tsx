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
} from "@/types";

export interface GameDetailsContext {
  // Core Data
  shopDetails: ShopDetails | null;
  stats: GameStats | null;
  repacks: GameRepack[];
  
  // Loading States
  isLoading: boolean;
  
  // Actions
  updateRepacks: () => Promise<void>;
}

const gameDetailsContext = createContext<GameDetailsContext>({
  shopDetails: null,
  stats: null,
  repacks: [],
  isLoading: true,
  updateRepacks: async () => {},
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
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [repacks, setRepacks] = useState<GameRepack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch shop details (Steam API)
  const fetchShopDetails = useCallback(async () => {
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
    }
  }, [objectId]);

  // Fetch game stats (Hydra API)
  const fetchStats = useCallback(async () => {
    try {
      const gameStats = await invoke<GameStats>("get_game_stats", {
        objectId,
        shop,
      });
      
      setStats(gameStats);
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

  // Initial data fetch
  useEffect(() => {
    const loadGameDetails = async () => {
      setIsLoading(true);
      
      // Fetch all data in parallel
      await Promise.all([
        fetchShopDetails(),
        fetchStats(),
        updateRepacks(),
      ]);
      
      setIsLoading(false);
    };

    loadGameDetails();
  }, [fetchShopDetails, fetchStats, updateRepacks]);

  const value = useMemo<GameDetailsContext>(
    () => ({
      shopDetails,
      stats,
      repacks,
      isLoading,
      updateRepacks,
    }),
    [shopDetails, stats, repacks, isLoading, updateRepacks]
  );

  return <Provider value={value}>{children}</Provider>;
}

