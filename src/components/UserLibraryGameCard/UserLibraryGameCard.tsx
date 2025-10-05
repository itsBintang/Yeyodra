import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClockIcon } from "@primer/octicons-react";
import type { GameShop } from "@/types";
import "./UserLibraryGameCard.scss";

interface UserLibraryGame {
  id: number;
  objectId: string;
  shop: GameShop;
  title: string;
  iconUrl: string | null;
  coverImageUrl: string | null;
  playTimeInSeconds: number;
  lastTimePlayed: Date | null;
}

interface UserLibraryGameCardProps {
  game: UserLibraryGame;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function UserLibraryGameCard({
  game,
  onMouseEnter,
  onMouseLeave,
}: UserLibraryGameCardProps) {
  const { t } = useTranslation("profile");
  const navigate = useNavigate();
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);

  const formatPlayTime = useCallback(
    (playTimeInSeconds = 0, isShort = false) => {
      const minutes = playTimeInSeconds / 60;

      if (minutes < 60) {
        return isShort
          ? `${Math.floor(minutes)}m`
          : t("amount_minutes", { amount: Math.floor(minutes) });
      }

      const hours = minutes / 60;
      return isShort
        ? `${Math.floor(hours)}h`
        : t("amount_hours", { amount: Math.floor(hours) });
    },
    [t]
  );

  const handleClick = () => {
    navigate(`/game/${game.shop}/${game.objectId}`);
  };

  return (
    <li
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="user-library-game__wrapper"
      title={isTooltipHovered ? undefined : game.title}
    >
      <button
        type="button"
        className="user-library-game__cover"
        onClick={handleClick}
      >
        <div className="user-library-game__overlay">
          <div
            className="user-library-game__playtime"
            title={formatPlayTime(game.playTimeInSeconds)}
          >
            <ClockIcon size={11} />
            <span className="user-library-game__playtime-long">
              {formatPlayTime(game.playTimeInSeconds)}
            </span>
            <span className="user-library-game__playtime-short">
              {formatPlayTime(game.playTimeInSeconds, true)}
            </span>
          </div>
        </div>

        <img
          src={game.coverImageUrl || game.iconUrl || "/default-game-cover.png"}
          alt={game.title}
          className="user-library-game__game-image"
        />
      </button>
    </li>
  );
}
