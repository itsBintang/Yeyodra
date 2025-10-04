import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SyncIcon } from "@primer/octicons-react";
import { useToast } from "@/hooks";
import "./SteamRestartButton.scss";

export function SteamRestartButton() {
  const [isRestarting, setIsRestarting] = useState(false);
  const { showSuccessToast, showErrorToast } = useToast();

  const handleRestartSteam = async () => {
    if (isRestarting) return;
    
    setIsRestarting(true);
    
    try {
      const result = await invoke<string>("restart_steam_command");
      showSuccessToast("Steam Restarted", result);
    } catch (error) {
      console.error("Failed to restart Steam:", error);
      showErrorToast("Steam Restart Failed", `Failed to restart Steam: ${error}`);
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <button
      className={`steam-restart-button ${isRestarting ? "steam-restart-button--restarting" : ""}`}
      onClick={handleRestartSteam}
      disabled={isRestarting}
      title={isRestarting ? "Restarting Steam..." : "Restart Steam"}
    >
      <SyncIcon 
        size={16} 
        className={isRestarting ? "steam-restart-button__icon--spinning" : ""} 
      />
      <span className="steam-restart-button__text">
        {isRestarting ? "Restarting..." : "Restart Steam"}
      </span>
    </button>
  );
}
