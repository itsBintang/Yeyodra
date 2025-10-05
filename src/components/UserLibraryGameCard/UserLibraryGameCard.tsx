import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClockIcon } from "@primer/octicons-react";
import type { LibraryGame } from "@/types";
import "./UserLibraryGameCard.scss";

interface UserLibraryGameCardProps {
  game: LibraryGame;
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
      title={game.title}
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
