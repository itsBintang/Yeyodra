import {
  DownloadIcon,
  GearIcon,
  HeartFillIcon,
  HeartIcon,
  PlayIcon,
  SyncIcon,
  ToolsIcon,
} from "@primer/octicons-react";
import { Button } from "@/components";
import { useGameDetails } from "@/contexts/game-details";
import { useToast } from "@/hooks";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useParams } from "react-router-dom";
import "./HeroPanelActions.scss";
import { useState, useEffect } from "react";

type ActionMode = "update" | "play" | "settings";

export function HeroPanelActions() {
  const { t } = useTranslation("game_details");
  const { game, gameTitle, setShowGameOptionsModal, setShowDownloadModal } = useGameDetails();
  const { showSuccessToast, showErrorToast } = useToast();
  const { objectId } = useParams<{ shop: string; objectId: string }>();
  
  const [toggleLibraryGameDisabled, setToggleLibraryGameDisabled] = useState(false);
  const [activeMode, setActiveMode] = useState<ActionMode>("play");
  const [isUpdating, setIsUpdating] = useState(false);

  // Auto-switch mode based on executable availability
  useEffect(() => {
    if (game?.isInstalled) {
      if (game.executablePath) {
        // Switch to play mode when executable is set
        setActiveMode("play");
      } else if (activeMode === "play") {
        // If play mode is active but no executable, switch to update mode
        setActiveMode("update");
      }
    }
  }, [game?.executablePath, game?.isInstalled]);

  const handleDownloadClick = () => {
    setShowDownloadModal(true);
  };

  const handleUpdateClick = async () => {
    // HYDRA PATTERN: Use gameTitle from context
    if (!objectId || !gameTitle) return;
    
    setToggleLibraryGameDisabled(true);
    setIsUpdating(true);
    
    // Add a small delay for better UX (loading animation)
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const message = await invoke<string>("enable_update_for_game", {
        appId: objectId,
      });
      
      console.log("[UpdateGame] Success:", message);
      
      showSuccessToast(
        t("auto_update_enabled_title"),
        t("auto_update_enabled_message", { gameName: gameTitle }),
        5000
      );
    } catch (error) {
      console.error("[UpdateGame] Failed:", error);
      
      showErrorToast(
        "Failed to Enable Auto-Update",
        typeof error === "string" ? error : "An error occurred while enabling auto-update",
        5000
      );
    } finally {
      setToggleLibraryGameDisabled(false);
      setIsUpdating(false);
    }
  };

  const handlePlayClick = async () => {
    if (!game?.executablePath) {
      showErrorToast(
        "Cannot Play Game",
        "No executable file selected. Please set the game executable in Options.",
        5000
      );
      return;
    }

    setToggleLibraryGameDisabled(true);
    
    try {
      const message = await invoke<string>("launch_game_executable", {
        executablePath: game.executablePath,
      });
      
      console.log("[LaunchGame] Success:", message);
      
      showSuccessToast(
        "Game Launched",
        message,
        3000
      );
    } catch (error) {
      console.error("[LaunchGame] Failed:", error);
      
      showErrorToast(
        "Failed to Launch Game",
        typeof error === "string" ? error : "An error occurred while launching the game",
        5000
      );
    } finally {
      setToggleLibraryGameDisabled(false);
    }
  };

  const handleFavoriteClick = () => {
    // TODO: Implement favorite toggle
    console.log("Favorite clicked");
  };

  const handleOptionsClick = () => {
    setShowGameOptionsModal(true);
  };

  // NEW FLOW: Game NOT in library → Show "Download" button directly
  // Download will auto-add to library after completion
  if (!game) {
    return (
      <div className="hero-panel-actions__container">
        <div className="hero-panel-actions__integrated-wrapper">
          <div className="hero-panel-actions__main-button">
            <Button
              theme="primary"
              onClick={handleDownloadClick}
              className="hero-panel-actions__primary-btn"
            >
              <DownloadIcon />
              {t("download")}
            </Button>
          </div>

          <div className="hero-panel-actions__icon-group">
            <button
              className="hero-panel-actions__icon-btn hero-panel-actions__icon-btn--download active"
              onClick={handleDownloadClick}
              title={t("download")}
            >
              <DownloadIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get main button config based on active mode
  const getMainButtonConfig = () => {
    if (!game.isInstalled) {
      return {
        icon: <DownloadIcon />,
        label: t("download"),
        onClick: handleDownloadClick,
        theme: "primary" as const,
      };
    }

    switch (activeMode) {
      case "update":
        return {
          icon: <DownloadIcon />,
          label: t("update_game"),
          onClick: handleUpdateClick,
          theme: "primary" as const,
        };
      case "play":
        return {
          icon: <PlayIcon />,
          label: t("play"),
          onClick: handlePlayClick,
          theme: "primary" as const,
        };
      case "settings":
        return {
          icon: <GearIcon />,
          label: t("options"),
          onClick: handleOptionsClick,
          theme: "primary" as const,
        };
    }
  };

  const mainButton = getMainButtonConfig();

  // Game IS in library: Show action buttons with icon filters
  return (
    <div className="hero-panel-actions__container">
      {/* Integrated Wrapper - Main button + Filter icons */}
      {game.isInstalled ? (
        <>
          <div className="hero-panel-actions__integrated-wrapper">
            {/* Main Action Button - Changes based on active mode */}
            <div className="hero-panel-actions__main-button">
              <Button
                onClick={mainButton.onClick}
                theme={mainButton.theme}
                disabled={toggleLibraryGameDisabled}
                className="hero-panel-actions__primary-btn"
              >
                {mainButton.icon}
                {mainButton.label}
              </Button>
            </div>

            {/* Action Icons */}
            <div className="hero-panel-actions__icon-group">
              <button
                className={`hero-panel-actions__icon-btn hero-panel-actions__icon-btn--sync ${
                  activeMode === "update" ? "active" : ""
                } ${isUpdating ? "scanning" : ""}`}
                onClick={() => setActiveMode("update")}
                disabled={toggleLibraryGameDisabled}
                title={t("update_game")}
              >
                <SyncIcon size={16} />
              </button>

              <button
                className={`hero-panel-actions__icon-btn hero-panel-actions__icon-btn--play ${
                  activeMode === "play" ? "active" : ""
                } ${!game.executablePath ? "disabled" : ""}`}
                onClick={() => setActiveMode("play")}
                disabled={toggleLibraryGameDisabled || !game.executablePath}
                title={game.executablePath ? t("play") : "No executable set"}
              >
                <PlayIcon size={16} />
              </button>

              <button
                className={`hero-panel-actions__icon-btn hero-panel-actions__icon-btn--tools ${
                  activeMode === "settings" ? "active" : ""
                }`}
                onClick={() => setActiveMode("settings")}
                disabled={toggleLibraryGameDisabled}
                title="Bypass"
              >
                <ToolsIcon size={16} />
              </button>
            </div>
          </div>

          {/* Favorite & Options buttons - separated */}
          <div className="hero-panel-actions__separator" />
          
          <Button
            onClick={handleFavoriteClick}
            theme="outline"
            disabled={toggleLibraryGameDisabled}
            className="hero-panel-actions__action"
          >
            {game.favorite ? <HeartFillIcon /> : <HeartIcon />}
          </Button>

          <Button
            onClick={handleOptionsClick}
            theme="outline"
            disabled={toggleLibraryGameDisabled}
            className="hero-panel-actions__action"
          >
            <GearIcon />
            {t("options")}
          </Button>
        </>
      ) : (
        /* Not installed - Show Download button with integrated wrapper */
        <>
          <div className="hero-panel-actions__integrated-wrapper">
            {/* Main Action Button - Download */}
            <div className="hero-panel-actions__main-button">
              <Button
                onClick={mainButton.onClick}
                theme={mainButton.theme}
                disabled={toggleLibraryGameDisabled}
                className="hero-panel-actions__primary-btn"
              >
                <DownloadIcon />
                {mainButton.label}
              </Button>
            </div>

            {/* Single Icon - Plus icon for download */}
            <div className="hero-panel-actions__icon-group">
              <button
                className="hero-panel-actions__icon-btn hero-panel-actions__icon-btn--download active"
                onClick={handleDownloadClick}
                disabled={toggleLibraryGameDisabled}
                title={t("download")}
              >
                <PlusIcon size={16} />
              </button>
            </div>
          </div>

          {/* Favorite & Options buttons - separated */}
          <div className="hero-panel-actions__separator" />
          
          <Button
            onClick={handleFavoriteClick}
            theme="outline"
            disabled={toggleLibraryGameDisabled}
            className="hero-panel-actions__action"
          >
            {game.favorite ? <HeartFillIcon /> : <HeartIcon />}
          </Button>

          <Button
            onClick={handleOptionsClick}
            theme="outline"
            disabled={toggleLibraryGameDisabled}
            className="hero-panel-actions__action"
          >
            <GearIcon />
            {t("options")}
          </Button>
        </>
      )}
    </div>
  );
}

