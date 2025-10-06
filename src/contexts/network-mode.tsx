import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserPreferences } from "@/types";

interface NetworkModeContextType {
  isLowConnectionMode: boolean;
  toggleLowConnectionMode: () => Promise<void>;
  isLoading: boolean;
}

const NetworkModeContext = createContext<NetworkModeContextType | undefined>(undefined);

export function NetworkModeProvider({ children }: { children: ReactNode }) {
  const [isLowConnectionMode, setIsLowConnectionMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNetworkMode();
  }, []);

  const loadNetworkMode = async () => {
    try {
      const prefs = await invoke<UserPreferences>("get_user_preferences");
      setIsLowConnectionMode(prefs.lowConnectionMode || false);
    } catch (error) {
      console.error("Failed to load network mode:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLowConnectionMode = async () => {
    try {
      const prefs = await invoke<UserPreferences>("get_user_preferences");
      const updated = await invoke<UserPreferences>("update_user_preferences", {
        preferences: {
          ...prefs,
          lowConnectionMode: !isLowConnectionMode,
        },
      });
      setIsLowConnectionMode(updated.lowConnectionMode || false);
      
      // Restart aria2c with new connection count
      console.log("[NetworkMode] Restarting aria2c with new settings...");
      const result = await invoke<string>("restart_aria2c");
      console.log("[NetworkMode]", result);
    } catch (error) {
      console.error("Failed to toggle network mode:", error);
      throw error;
    }
  };

  return (
    <NetworkModeContext.Provider
      value={{ isLowConnectionMode, toggleLowConnectionMode, isLoading }}
    >
      {children}
    </NetworkModeContext.Provider>
  );
}

export function useNetworkMode() {
  const context = useContext(NetworkModeContext);
  if (context === undefined) {
    throw new Error("useNetworkMode must be used within NetworkModeProvider");
  }
  return context;
}

