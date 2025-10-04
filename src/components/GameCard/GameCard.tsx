import { DownloadIcon, PeopleIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Badge } from "../Badge/Badge";
import "./GameCard.scss";

interface GameStats {
  downloadCount: number;
  playerCount: number;
}

export interface GameCardProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  game: any;
}

export function GameCard({ game, ...props }: GameCardProps) {
  const { t } = useTranslation("game_card");
  const navigate = useNavigate();

  const [stats, setStats] = useState<GameStats | null>(null);
  const uniqueRepackers: string[] = [];

  const numberFormatter = new Intl.NumberFormat();

  const handleHover = useCallback(() => {
    if (!stats && game.objectId && game.shop) {
      invoke<GameStats>("get_game_stats", {
        objectId: game.objectId,
        shop: game.shop,
      })
        .then((fetchedStats) => {
          setStats(fetchedStats);
        })
        .catch((error) => {
          console.error("Failed to fetch game stats:", error);
        });
    }
  }, [game, stats]);

  const firstThreeRepackers = uniqueRepackers.slice(0, 3);
  const remainingCount = uniqueRepackers.length - 3;

  const handleClick = useCallback(() => {
    if (game.objectId && game.shop) {
      navigate(`/game/${game.objectId}?shop=${game.shop}`);
    }
  }, [game, navigate]);

  return (
    <button
      {...props}
      type="button"
      className="game-card"
      onMouseEnter={handleHover}
      onClick={handleClick}
    >
      <div className="game-card__backdrop">
        <img
          src={game.libraryImageUrl || game.backgroundImageUrl}
          alt={game.title}
          className="game-card__cover"
          loading="lazy"
        />

        <div className="game-card__content">
          <div className="game-card__title-container">
            <p className="game-card__title">{game.title}</p>
          </div>

          {uniqueRepackers.length > 0 ? (
            <ul className="game-card__download-options">
              {firstThreeRepackers.map((repacker) => (
                <li key={repacker}>
                  <Badge>{repacker}</Badge>
                </li>
              ))}
              {remainingCount > 0 && (
                <li>
                  <Badge>
                    +{remainingCount}{" "}
                    {t("available", { count: remainingCount })}
                  </Badge>
                </li>
              )}
            </ul>
          ) : (
            <p className="game-card__no-download-label">{t("no_downloads")}</p>
          )}

          <div className="game-card__specifics">
            <div className="game-card__specifics-item">
              <DownloadIcon />
              <span>
                {stats ? numberFormatter.format(stats.downloadCount) : "…"}
              </span>
            </div>
            <div className="game-card__specifics-item">
              <PeopleIcon />
              <span>
                {stats ? numberFormatter.format(stats.playerCount) : "…"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

