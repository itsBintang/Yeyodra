import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { CatalogueSearchResult } from "../../types";
import { Badge } from "../Badge/Badge";
import "./GameItem.scss";

export interface GameItemProps {
  game: CatalogueSearchResult;
}

export function GameItem({ game }: GameItemProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/game/${game.shop}/${game.objectId}`);
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
        <span>?</span>
      </div>
    );
  }, [game.libraryImageUrl, game.title]);

  return (
    <button type="button" className="game-item" onClick={handleClick}>
      {libraryImage}

      <div className="game-item__details">
        <span className="game-item__title">{game.title}</span>
        <span className="game-item__genres">{game.genres.join(", ")}</span>

        <div className="game-item__badges">
          <Badge>{game.shop}</Badge>
        </div>
      </div>
    </button>
  );
}

