import {
  DownloadIcon,
  GearIcon,
  HeartFillIcon,
  HeartIcon,
  PlusCircleIcon,
  PlayIcon,
} from "@primer/octicons-react";
import { Button } from "@/components";
import { useGameDetails } from "@/contexts/game-details";
import { useLibrary } from "@/hooks";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useParams } from "react-router-dom";
import "./HeroPanelActions.scss";
import { useState } from "react";

export function HeroPanelActions() {
  const { t } = useTranslation("game_details");
  const { game, shopDetails, updateGame, setShowGameOptionsModal, setShowDownloadModal } = useGameDetails();
  const { updateLibrary } = useLibrary();
  const { shop, objectId } = useParams<{ shop: string; objectId: string }>();
  
  const [toggleLibraryGameDisabled, setToggleLibraryGameDisabled] = useState(false);

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

  // Game IS in library: Show action buttons with separator
  return (
    <div className="hero-panel-actions__container">
        {/* Show Play button if installed, Download button otherwise */}
        {game.isInstalled ? (
          <Button
            onClick={handlePlayClick}
            theme="primary"
            disabled={toggleLibraryGameDisabled}
            className="hero-panel-actions__action"
          >
            <PlayIcon />
            {t("play")}
          </Button>
        ) : (
          <Button
            onClick={handleDownloadClick}
            theme="outline"
            disabled={toggleLibraryGameDisabled}
            className="hero-panel-actions__action"
          >
            <DownloadIcon />
            {t("download")}
          </Button>
        )}
      
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
  );
}

