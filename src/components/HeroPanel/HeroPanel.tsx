import { useTranslation } from "react-i18next";
import { useGameDetails } from "@/contexts/game-details";
import { Button } from "../Button";
import "./HeroPanel.scss";

export function HeroPanel() {
  const { t } = useTranslation("game_details");
  const { repacks, shopDetails } = useGameDetails();

  const getInfo = () => {
    // For now, show repack info if available
    const [latestRepack] = repacks;

    if (latestRepack) {
      const repacksCount = repacks.length;
      return (
        <>
          <p>{t("updated_at", { updated_at: latestRepack.uploadDate || "N/A" })}</p>
          <p>{t("download_options", { count: repacksCount })}</p>
        </>
      );
    }

    // Fallback: show short description or no downloads
    if (shopDetails?.short_description) {
      return <p>{shopDetails.short_description}</p>;
    }

    return <p>{t("no_downloads")}</p>;
  };

  const handleDownloadClick = () => {
    // TODO: Implement download modal
    console.log("Download clicked");
  };

  return (
    <div className="hero-panel">
      <div className="hero-panel__content">{getInfo()}</div>
      <div className="hero-panel__actions">
        <Button theme="primary" onClick={handleDownloadClick}>
          {t("download")}
        </Button>
      </div>
    </div>
  );
}

