import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/store";
import { setHeaderTitle } from "@/features/appSlice";
import { useGameDetails } from "@/contexts/game-details";
import { GameDetailsProvider } from "@/contexts/game-details";
import { AchievementPanel } from "./AchievementPanel";
import { AchievementListFull } from "./AchievementListFull";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "./Achievements.scss";

function AchievementsContent() {
  const { t } = useTranslation("achievements");
  const dispatch = useAppDispatch();
  const { shopDetails, achievements, isLoading, game } = useGameDetails();
  const { shop, objectId, title } = useParams<{ shop: string; objectId: string; title: string }>();

  useEffect(() => {
    if (title) {
      dispatch(setHeaderTitle(title));
    }
  }, [title, dispatch]);

  if (isLoading || !achievements) {
    return (
      <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
        <div className="achievements">
          <div className="achievements__hero">
            <Skeleton height={200} />
          </div>
          <div className="achievements__container">
            <Skeleton count={10} height={80} style={{ marginBottom: "16px" }} />
          </div>
        </div>
      </SkeletonTheme>
    );
  }

  if (!achievements || achievements.length === 0) {
    return (
      <div className="achievements">
        <div className="achievements__empty">
          <h2>{t("no_achievements_title")}</h2>
          <p>{t("no_achievements_description")}</p>
          <Link to={`/game/${shop}/${objectId}`} className="achievements__back-link">
            {t("back_to_game")}
          </Link>
        </div>
      </div>
    );
  }

  // Use standard Steam URLs like in library JSON
  const heroImage = shopDetails?.header_image || "";
  const logoImage = objectId 
    ? `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/logo.png`
    : (shopDetails?.capsule_image || "");

  return (
    <div className="achievements">
      {/* Background image - hidden but kept for future use */}
      {heroImage && (
        <img
          src={heroImage}
          alt={title}
          className="achievements__hero-image"
        />
      )}

      {/* Main Content */}
      <div className="achievements__container">
        {/* Hero Section - inside scrollable container like Hydra */}
        <div className="achievements__hero">
          <div className="achievements__hero-content">
            <Link to={`/game/${shop}/${objectId}`}>
              {logoImage ? (
                <img
                  src={logoImage}
                  alt={title}
                  className="achievements__hero-logo"
                />
              ) : (
                <h1 className="achievements__hero-title">{title}</h1>
              )}
            </Link>
          </div>
          <div className="achievements__hero-playtime">
            {game ? (
              game.playTimeInSeconds === 0 ? (
                <p>{t("not_played_yet", { title: game.title || title })}</p>
              ) : (
                <p>
                  {t("play_time", {
                    amount: `${Math.floor(game.playTimeInSeconds / 3600)} ${t("hours")}`,
                  })}
                </p>
              )
            ) : (
              <p>{t("not_played_yet", { title: title })}</p>
            )}
          </div>
        </div>

        <AchievementPanel achievements={achievements} />
        <AchievementListFull achievements={achievements} />
      </div>
    </div>
  );
}

export function Achievements() {
  const { shop, objectId, title } = useParams<{ shop: string; objectId: string; title: string }>();

  // HYDRA PATTERN: gameTitle from URL
  const gameTitle = decodeURIComponent(title || "Unknown Game");

  if (!shop || !objectId || !title) {
    return (
      <div className="achievements__error">
        <h2>Invalid parameters</h2>
        <p>Missing required parameters for achievements page</p>
      </div>
    );
  }

  return (
    <GameDetailsProvider objectId={objectId} shop={shop} gameTitle={gameTitle}>
      <AchievementsContent />
    </GameDetailsProvider>
  );
}

