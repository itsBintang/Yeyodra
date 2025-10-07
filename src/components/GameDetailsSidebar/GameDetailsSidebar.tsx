import { useMemo, useState } from "react";
import { DownloadIcon, PeopleIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import type { GameStats, ShopDetails, UserAchievement } from "@/types";
import { Button } from "../Button";
import { SidebarSection } from "../SidebarSection/SidebarSection";
import { AchievementsList } from "../AchievementsList/AchievementsList";
import { GameLanguageSection } from "./GameLanguageSection";
import "./GameDetailsSidebar.scss";

interface GameDetailsSidebarProps {
  shopDetails?: ShopDetails | null; // HYDRA PATTERN: Optional - Steam API might fail
  stats: GameStats | null;
  achievements?: UserAchievement[] | null;
  shop?: string;
  objectId?: string;
}

export function GameDetailsSidebar({ shopDetails, stats, achievements, shop, objectId }: GameDetailsSidebarProps) {
  const { t } = useTranslation("game_details");
  const [activeRequirement, setActiveRequirement] = useState<"minimum" | "recommended">("minimum");

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Format date
  const releaseDate = useMemo(() => {
    if (!shopDetails?.release_date?.date) return "TBA";
    return shopDetails.release_date.date;
  }, [shopDetails?.release_date]);

  // Get genres
  const genres = useMemo(() => {
    if (!shopDetails?.genres || shopDetails.genres.length === 0) return null;
    return shopDetails.genres.map((g) => g.description).join(", ");
  }, [shopDetails?.genres]);

  // Get developers
  const developers = useMemo(() => {
    if (!shopDetails?.developers || shopDetails.developers.length === 0) return null;
    return shopDetails.developers.join(", ");
  }, [shopDetails?.developers]);

  // Get publishers
  const publishers = useMemo(() => {
    if (!shopDetails?.publishers || shopDetails.publishers.length === 0) return null;
    return shopDetails.publishers.join(", ");
  }, [shopDetails?.publishers]);

  return (
    <aside className="game-details-sidebar">
      {/* HYDRA PATTERN: Achievements from Hydra API (independent of Steam API) */}
      {achievements && achievements.length > 0 && (
        <SidebarSection 
          title={t("achievements_count", {
            unlockedCount: achievements.filter(a => a.unlocked).length,
            achievementsCount: achievements.length,
          })}
        >
          <AchievementsList 
            achievements={achievements}
            shop={shop}
            objectId={objectId}
            gameTitle={shopDetails?.name || "Game"}
          />
        </SidebarSection>
      )}

      {/* HYDRA PATTERN: Stats from Hydra API (independent of Steam API) */}
      {stats && (
        <SidebarSection title={t("stats")}>
          <div className="game-details-sidebar__stats">
            <div className="game-details-sidebar__stat-category">
              <p className="game-details-sidebar__stat-title">
                <DownloadIcon size={18} />
                {t("download_count")}
              </p>
              <p className="game-details-sidebar__stat-value">
                {formatNumber(stats.downloadCount)}
              </p>
            </div>

            <div className="game-details-sidebar__stat-category">
              <p className="game-details-sidebar__stat-title">
                <PeopleIcon size={18} />
                {t("player_count")}
              </p>
              <p className="game-details-sidebar__stat-value">
                {formatNumber(stats.playerCount)}
              </p>
            </div>
          </div>
        </SidebarSection>
      )}

      {/* System Requirements (from Steam API - might be unavailable) */}
      {shopDetails && (shopDetails.pc_requirements?.minimum || shopDetails.pc_requirements?.recommended) && (
        <SidebarSection title={t("requirements")}>
          <div className="game-details-sidebar__requirement-buttons">
            <Button
              className="game-details-sidebar__requirement-button"
              onClick={() => setActiveRequirement("minimum")}
              theme={activeRequirement === "minimum" ? "primary" : "outline"}
            >
              {t("minimum")}
            </Button>

            <Button
              className="game-details-sidebar__requirement-button"
              onClick={() => setActiveRequirement("recommended")}
              theme={activeRequirement === "recommended" ? "primary" : "outline"}
            >
              {t("recommended")}
            </Button>
          </div>

          <div
            className="game-details-sidebar__requirement-details"
            dangerouslySetInnerHTML={{
              __html:
                shopDetails.pc_requirements?.[activeRequirement] ||
                `No ${activeRequirement} requirements available`,
            }}
          />
        </SidebarSection>
      )}

      {/* Game Information (from Steam API - might be unavailable) */}
      {shopDetails && (
        <>
          <SidebarSection title={t("information")}>
            <div className="game-details-sidebar__info-list">
              {/* Release Date */}
              <div className="game-details-sidebar__info-item">
                <span className="game-details-sidebar__info-label">Release Date</span>
                <span className="game-details-sidebar__info-value">{releaseDate}</span>
              </div>

              {/* Developers */}
              {developers && (
                <div className="game-details-sidebar__info-item">
                  <span className="game-details-sidebar__info-label">Developer</span>
                  <span className="game-details-sidebar__info-value">{developers}</span>
                </div>
              )}

              {/* Publishers */}
              {publishers && (
                <div className="game-details-sidebar__info-item">
                  <span className="game-details-sidebar__info-label">Publisher</span>
                  <span className="game-details-sidebar__info-value">{publishers}</span>
                </div>
              )}

              {/* Genres */}
              {genres && (
                <div className="game-details-sidebar__info-item">
                  <span className="game-details-sidebar__info-label">Genres</span>
                  <span className="game-details-sidebar__info-value">{genres}</span>
                </div>
              )}

              {/* Free to Play */}
              {shopDetails.is_free && (
                <div className="game-details-sidebar__info-item">
                  <span className="game-details-sidebar__info-label">Price</span>
                  <span className="game-details-sidebar__info-value game-details-sidebar__info-value--free">
                    Free to Play
                  </span>
                </div>
              )}
            </div>
          </SidebarSection>

          {/* Language Support */}
          <GameLanguageSection shopDetails={shopDetails} />
        </>
      )}
    </aside>
  );
}
