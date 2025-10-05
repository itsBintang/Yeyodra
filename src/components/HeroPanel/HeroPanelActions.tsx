import {
  DownloadIcon,
  GearIcon,
  HeartFillIcon,
  HeartIcon,
  PlusCircleIcon,
  PlayIcon,
  SyncIcon,
  UploadIcon,
  ToolsIcon,
  IterationsIcon,
} from "@primer/octicons-react";
import { Button } from "@/components";
import { useGameDetails } from "@/contexts/game-details";
import { useLibrary } from "@/hooks";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useParams } from "react-router-dom";
import "./HeroPanelActions.scss";
import { useState } from "react";

type ActionMode = "update" | "play" | "settings" | "other";

export function HeroPanelActions() {
  const { t } = useTranslation("game_details");
  const { game, shopDetails, updateGame, setShowGameOptionsModal, setShowDownloadModal } = useGameDetails();
  const { updateLibrary } = useLibrary();
  const { shop, objectId } = useParams<{ shop: string; objectId: string }>();
  
  const [toggleLibraryGameDisabled, setToggleLibraryGameDisabled] = useState(false);
  const [activeMode, setActiveMode] = useState<ActionMode>("play");

  const handleAddToLibrary = async () => {
    if (!shop || !objectId || !shopDetails?.name) return;
    
    setToggleLibraryGameDisabled(true);
    
    try {
      console.log("[AddToLibrary] Adding game:", { shop, objectId, title: shopDetails.name });
      
      const result = await invoke("add_game_to_library", {
        shop,
        objectId,
        title: shopDetails.name,
      });
      
      console.log("[AddToLibrary] Game added successfully:", result);
      
      // Update game state and library
      await Promise.all([
        updateGame(),
        updateLibrary(),
      ]);
      
      console.log("[AddToLibrary] State updated successfully");
    } catch (error) {
      console.error("Failed to add game to library:", error);
    } finally {
      setToggleLibraryGameDisabled(false);
    }
  };

  const handleDownloadClick = () => {
    setShowDownloadModal(true);
  };

  const handlePlayClick = () => {
    // TODO: Implement game launch
    console.log("Play clicked - Launch game");
  };

  const handleFavoriteClick = () => {
    // TODO: Implement favorite toggle
    console.log("Favorite clicked");
  };

  const handleOptionsClick = () => {
    setShowGameOptionsModal(true);
  };

  // Render different UI based on whether game is in library
  // Game NOT in library: Show only "Add to Library" button
  if (!game) {
    return (
      <Button
        theme="outline"
        disabled={toggleLibraryGameDisabled}
        onClick={handleAddToLibrary}
        className="hero-panel-actions__action"
      >
        <PlusCircleIcon />
        {t("add_to_library")}
      </Button>
    );
  }

  // Get main button config based on active mode
  const getMainButtonConfig = () => {
    if (!game.isInstalled) {
      return {
        icon: <DownloadIcon />,
        label: t("download"),
        onClick: handleDownloadClick,
        theme: "outline" as const,
      };
    }

    switch (activeMode) {
      case "update":
        return {
          icon: <DownloadIcon />,
          label: t("update_game"),
          onClick: handleDownloadClick,
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
          theme: "outline" as const,
        };
      case "other":
        return {
          icon: <HeartIcon />,
          label: "Action",
          onClick: handleFavoriteClick,
          theme: "outline" as const,
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
                }`}
                onClick={() => setActiveMode("update")}
                disabled={toggleLibraryGameDisabled}
                title={t("update_game")}
              >
                <SyncIcon size={16} />
              </button>

              <button
                className={`hero-panel-actions__icon-btn hero-panel-actions__icon-btn--upload ${
                  activeMode === "play" ? "active" : ""
                }`}
                onClick={() => setActiveMode("play")}
                disabled={toggleLibraryGameDisabled}
                title={t("play")}
              >
                <UploadIcon size={16} />
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

              <button
                className={`hero-panel-actions__icon-btn hero-panel-actions__icon-btn--iterations ${
                  activeMode === "other" ? "active" : ""
                }`}
                onClick={() => setActiveMode("other")}
                disabled={toggleLibraryGameDisabled}
                title="Other Action"
              >
                <IterationsIcon size={16} />
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
        /* Not installed - Show Download button separately */
        <>
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

          <div className="hero-panel-actions__secondary-group">
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
          </div>
        </>
      )}
    </div>
  );
}

