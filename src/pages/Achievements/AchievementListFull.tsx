import { useTranslation } from "react-i18next";
import { EyeClosedIcon } from "@primer/octicons-react";
import type { UserAchievement } from "@/types";
import "./AchievementListFull.scss";

interface AchievementListFullProps {
  achievements: UserAchievement[];
}

export function AchievementListFull({ achievements }: AchievementListFullProps) {
  const { t } = useTranslation("achievements");

  const formatUnlockTime = (unlockTime: number | null): string => {
    if (!unlockTime) return "";
    
    const date = new Date(unlockTime * 1000); // Convert from seconds to milliseconds
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="achievement-list-full">
      <ul className="achievement-list-full__items">
        {achievements.map((achievement) => (
          <li 
            key={achievement.name} 
            className={`achievement-list-full__item ${
              achievement.unlocked ? "achievement-list-full__item--unlocked" : "achievement-list-full__item--locked"
            }`}
          >
            <div className="achievement-list-full__icon-container">
              <img
                className={`achievement-list-full__icon ${
                  achievement.unlocked ? "" : "achievement-list-full__icon--locked"
                }`}
                src={achievement.unlocked ? achievement.icon : achievement.icongray}
                alt={achievement.displayName}
                loading="lazy"
              />
            </div>

            <div className="achievement-list-full__content">
              <h4 className="achievement-list-full__title">
                {achievement.hidden && (
                  <span
                    className="achievement-list-full__hidden-icon"
                    title={t("hidden_achievement")}
                  >
                    <EyeClosedIcon size={14} />
                  </span>
                )}
                {achievement.displayName}
              </h4>
              
              <p className="achievement-list-full__description">
                {achievement.description || t("hidden_achievement_description")}
              </p>
            </div>

            <div className="achievement-list-full__meta">
              {achievement.unlocked && achievement.unlockTime && (
                <div className="achievement-list-full__unlock-time">
                  <small>{formatUnlockTime(achievement.unlockTime)}</small>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

