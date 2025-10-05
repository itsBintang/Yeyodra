import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { SyncIcon } from "@primer/octicons-react";
import { useToast } from "@/hooks";
import "./SteamRestartButton.scss";

export function SteamRestartButton() {
  const { t } = useTranslation("sidebar");
  const [isRestarting, setIsRestarting] = useState(false);
  const { showSuccessToast, showErrorToast } = useToast();

  const handleRestartSteam = async () => {
    if (isRestarting) return;
    
    setIsRestarting(true);
    
    try {
      const result = await invoke<string>("restart_steam_command");
      showSuccessToast(t("steam_restarted"), result);
    } catch (error) {
      console.error("Failed to restart Steam:", error);
      showErrorToast(t("steam_restart_failed"), `${t("failed_to_restart_steam")}: ${error}`);
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <button
      className={`steam-restart-button ${isRestarting ? "steam-restart-button--restarting" : ""}`}
      onClick={handleRestartSteam}
      disabled={isRestarting}
      title={isRestarting ? t("restarting_steam") : t("restart_steam")}
    >
      <SyncIcon 
        size={16} 
        className={isRestarting ? "steam-restart-button__icon--spinning" : ""} 
      />
      <span className="steam-restart-button__text">
        {isRestarting ? t("restarting") : t("restart_steam")}
      </span>
    </button>
  );
}
