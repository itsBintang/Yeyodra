import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { UserAchievement } from "@/types";
import "./AchievementsList.scss";

interface AchievementsListProps {
  achievements: UserAchievement[];
  maxDisplay?: number;
  shop?: string;
  objectId?: string;
  gameTitle?: string;
}

export function AchievementsList({ achievements, maxDisplay = 4, shop, objectId, gameTitle }: AchievementsListProps) {
  const { t } = useTranslation("game_details");

  if (!achievements || achievements.length === 0) {
    return null;
  }

  // const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const displayAchievements = achievements.slice(0, maxDisplay);

  const formatUnlockTime = (unlockTime: number | null): string => {
    if (!unlockTime) return "";
    
    const date = new Date(unlockTime * 1000); // Convert from seconds to milliseconds
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="achievements-list">
      <ul className="achievements-list__items">
        {displayAchievements.map((achievement) => (
          <li key={achievement.name} className="achievements-list__item">
            <img
              className={`achievements-list__icon ${
                achievement.unlocked ? "" : "achievements-list__icon--locked"
              }`}
              src={achievement.unlocked ? achievement.icon : achievement.icongray}
              alt={achievement.displayName}
              title={achievement.description || achievement.displayName}
            />
            <div className="achievements-list__info">
              <p className="achievements-list__name">{achievement.displayName}</p>
              {achievement.unlocked && achievement.unlockTime && (
                <small className="achievements-list__unlock-date">
                  {formatUnlockTime(achievement.unlockTime)}
                </small>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Link
        to={`/game/${shop}/${objectId}/achievements/${encodeURIComponent(gameTitle || '')}`}
        className="achievements-list__see-all"
      >
        {t("see_all_achievements")}
      </Link>
    </div>
  );
}

