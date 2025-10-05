import { useMemo } from "react";
import type { UserAchievement } from "@/types";
import "./AchievementPanel.scss";

interface AchievementPanelProps {
  achievements: UserAchievement[];
}

export function AchievementPanel({ achievements }: AchievementPanelProps) {
  const stats = useMemo(() => {
    const total = achievements.length;
    const unlocked = achievements.filter((a) => a.unlocked).length;
    const percentage = total > 0 ? (unlocked / total) : 0;

    return { total, unlocked, percentage };
  }, [achievements]);

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <div className="achievement-panel">
      <div className="achievement-panel__header">
        <span className="achievement-panel__count">
          {stats.unlocked} / {stats.total}
        </span>
        <span className="achievement-panel__percentage">
          {formatPercentage(stats.percentage)}
        </span>
      </div>
      
      <progress
        max={1}
        value={stats.percentage}
        className="achievement-panel__progress-bar"
      />
    </div>
  );
}

