import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QuestionIcon, PlusIcon, CheckIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import classNames from "classnames";
import type { CatalogueSearchResult } from "../../types";
import { useLibrary } from "@/hooks";
import "./GameItem.scss";

export interface GameItemProps {
  game: CatalogueSearchResult;
}

export function GameItem({ game }: GameItemProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("game_details");
  const { library, updateLibrary } = useLibrary();
  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const exists = library.some(
      (libItem) =>
        libItem.shop === game.shop && libItem.objectId === game.objectId
    );
    setAdded(exists);
  }, [library, game.shop, game.objectId]);

  const handleClick = () => {
    navigate(`/game/${game.shop}/${game.objectId}`);
  };

  const addGameToLibrary = async (
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    event.stopPropagation();
    if (added || isAddingToLibrary) return;

    setIsAddingToLibrary(true);

    try {
      await invoke("add_game_to_library", {
        shop: game.shop,
        objectId: game.objectId,
        title: game.title,
      });
      updateLibrary();
    } catch (error) {
      console.error(error);
    } finally {
      setIsAddingToLibrary(false);
    }
  };

  const libraryImage = useMemo(() => {
    if (game.libraryImageUrl) {
      return (
        <img
          className="game-item__cover"
          src={game.libraryImageUrl}
          alt={game.title}
          loading="lazy"
        />
      );
    }

    return (
      <div className="game-item__cover-placeholder">
        <QuestionIcon size={28} />
      </div>
    );
  }, [game.libraryImageUrl, game.title]);

  return (
    <button type="button" className="game-item" onClick={handleClick}>
      {libraryImage}

      <div className="game-item__details">
        <span className="game-item__title">{game.title}</span>
        <span className="game-item__genres">{game.genres.join(", ")}</span>
      </div>

      <div
        className={classNames("game-item__plus-wrapper", {
          "game-item__plus-wrapper--added": added,
        })}
        role="button"
        tabIndex={0}
        onClick={addGameToLibrary}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            addGameToLibrary(e);
          }
        }}
        title={added ? t("already_in_library") : t("add_to_library")}
      >
        {added ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
      </div>
    </button>
  );
}

