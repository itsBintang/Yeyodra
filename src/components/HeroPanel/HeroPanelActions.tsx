import {
  DownloadIcon,
  GearIcon,
  HeartFillIcon,
  HeartIcon,
  PinIcon,
  PinSlashIcon,
  PlayIcon,
  PlusCircleIcon,
} from "@primer/octicons-react";
import { Button } from "../Button";
import { useGameDetails } from "@/contexts/game-details";
import { useLibrary } from "@/hooks";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useParams } from "react-router-dom";
import "./HeroPanelActions.scss";
import { useState } from "react";

export function HeroPanelActions() {
  const { t } = useTranslation("game_details");
  const { game, repacks, shopDetails, updateGame } = useGameDetails();
  const { updateLibrary } = useLibrary();
  const { shop, objectId } = useParams<{ shop: string; objectId: string }>();
  
  const [toggleLibraryGameDisabled, setToggleLibraryGameDisabled] = useState(false);

  const handleAddToLibrary = async () => {
    if (!shop || !objectId || !shopDetails?.name) return;
    
    setToggleLibraryGameDisabled(true);
    
    try {
      await invoke("add_game_to_library", {
        shop,
        objectId,
        title: shopDetails.name,
      });
      
      // Update game state and library
      await Promise.all([
        updateGame(),
        updateLibrary(),
      ]);
    } catch (error) {
      console.error("Failed to add game to library:", error);
    } finally {
      setToggleLibraryGameDisabled(false);
    }
  };

  const handleDownloadClick = () => {
    // TODO: Implement download modal/repack selection
    console.log("Download clicked");
  };

  const handleFavoriteClick = () => {
    // TODO: Implement favorite toggle
    console.log("Favorite clicked");
  };

  const handlePinClick = () => {
    // TODO: Implement pin toggle
    console.log("Pin clicked");
  };

  const handleOptionsClick = () => {
    // TODO: Implement options modal
    console.log("Options clicked");
  };

  // If game is not in library, show "Add to Library" button instead of Download
  const showAddToLibrary = !game;

  return (
    <div className="hero-panel-actions__container">
      {showAddToLibrary ? (
        <Button
          theme="outline"
          disabled={toggleLibraryGameDisabled}
          onClick={handleAddToLibrary}
          className="hero-panel-actions__action"
        >
          <PlusCircleIcon />
          {t("add_to_library")}
        </Button>
      ) : (
        <Button
          onClick={handleDownloadClick}
          theme="outline"
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
        className="hero-panel-actions__action"
      >
        <HeartIcon />
      </Button>

      <Button
        onClick={handlePinClick}
        theme="outline"
        className="hero-panel-actions__action"
      >
        <PinIcon />
      </Button>

      <Button
        onClick={handleOptionsClick}
        theme="outline"
        className="hero-panel-actions__action"
      >
        <GearIcon />
        {t("options")}
      </Button>
    </div>
  );
}

