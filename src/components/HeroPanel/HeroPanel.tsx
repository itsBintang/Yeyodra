import { useTranslation } from "react-i18next";
import { useGameDetails } from "@/contexts/game-details";
import { HeroPanelActions } from "./HeroPanelActions";
import "./HeroPanel.scss";

export function HeroPanel() {
  const { t } = useTranslation("game_details");
  const { repacks, shopDetails, game } = useGameDetails();

  const getInfo = () => {
    // For now, show repack info if available
    const [latestRepack] = repacks;

    if (latestRepack) {
      const repacksCount = repacks.length;
      return (
        <>
          <p>{t("updated_at", { updated_at: latestRepack.uploadDate || "N/A" })}</p>
          <p>{t("download_count_available", { count: repacksCount })}</p>
        </>
      );
    }

    // Fallback: show "You haven't played {game name}"
    if (game && game.playTimeInSeconds === 0) {
      return <p>{t("not_played_yet", { title: shopDetails?.name || "" })}</p>;
    }

    if (game && game.playTimeInSeconds > 0) {
      return <p>{t("play_time", { amount: `${Math.floor(game.playTimeInSeconds / 3600)} ${t("hours")}` })}</p>;
    }

    // If game not in library yet
    return <p>{t("not_played_yet", { title: shopDetails?.name || "" })}</p>;
  };

  return (
    <div className="hero-panel">
      <div className="hero-panel__content">{getInfo()}</div>
      <div className="hero-panel__actions">
        <HeroPanelActions />
      </div>
    </div>
  );
}

