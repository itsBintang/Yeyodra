import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/store";
import { setHeaderTitle } from "@/features/appSlice";
import { UserLibraryGameCard, SortOptions } from "@/components";
import type { SortOption } from "@/components";
import { TelescopeIcon } from "@primer/octicons-react";
import type { UserStats } from "@/types";
import "./ProfileContent.scss";

interface ProfileContentProps {
  userId: string;
}

export function ProfileContent({ userId: _userId }: ProfileContentProps) {
  const { t } = useTranslation("profile");
  const dispatch = useAppDispatch();
  const [sortBy, setSortBy] = useState<SortOption>("playedRecently");
  
  const { userProfile } = useAppSelector((state) => state.user);
  const library = useAppSelector((state) => state.library.games);

  useEffect(() => {
    if (userProfile) {
      dispatch(setHeaderTitle(userProfile.displayName));
    }
    
    return () => {
      dispatch(setHeaderTitle(""));
    };
  }, [userProfile, dispatch]);

  // Sort library based on selected option
  const sortedLibrary = useMemo(() => {
    if (!library) return [];
    
    const sorted = [...library];
    
    if (sortBy === "playtime") {
      return sorted.sort((a, b) => b.playTimeInSeconds - a.playTimeInSeconds);
    }
    
    if (sortBy === "playedRecently") {
      return sorted.sort((a, b) => {
        const dateA = a.lastTimePlayed ? new Date(a.lastTimePlayed).getTime() : 0;
        const dateB = b.lastTimePlayed ? new Date(b.lastTimePlayed).getTime() : 0;
        return dateB - dateA;
      });
    }
    
    return sorted;
  }, [library, sortBy]);

  // Calculate user stats from library
  const userStats: UserStats = useMemo(() => {
    if (!sortedLibrary || sortedLibrary.length === 0) {
      return {
        libraryCount: 0,
        totalPlaytime: 0,
        gamesPlayed: 0,
      };
    }

    const totalPlaytime = sortedLibrary.reduce(
      (sum, game) => sum + game.playTimeInSeconds,
      0
    );
    
    const gamesPlayed = sortedLibrary.filter(
      (game) => game.playTimeInSeconds > 0
    ).length;

    return {
      libraryCount: sortedLibrary.length,
      totalPlaytime,
      gamesPlayed,
    };
  }, [sortedLibrary]);

  // Format playtime
  const formatPlaytime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    if (hours < 1) return t("less_than_hour");
    return t("hours_played", { hours });
  };

  const hasGames = sortedLibrary && sortedLibrary.length > 0;

  return (
    <section className="profile-content__section">
      <div className="profile-content__main">
        {hasGames && <SortOptions sortBy={sortBy} onSortChange={setSortBy} />}

        {!hasGames && (
          <div className="profile-content__no-games">
            <div className="profile-content__telescope-icon">
              <TelescopeIcon size={24} />
            </div>
            <h2>{t("no_games_title")}</h2>
            <p>{t("no_games_description")}</p>
          </div>
        )}

        {hasGames && (
          <div>
            <div className="profile-content__section-header">
              <div className="profile-content__section-title-group">
                <h2>{t("library")}</h2>
                <span className="profile-content__section-badge">
                  {userStats.libraryCount}
                </span>
              </div>
            </div>

            <ul className="profile-content__games-grid">
              {sortedLibrary.map((game) => (
                <UserLibraryGameCard key={game.id} game={game} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {hasGames && (
        <div className="profile-content__right-content">
          <div>
            <div className="profile-content__section-header">
              <h2>{t("stats")}</h2>
            </div>
            
            <div className="profile-content__stats-box">
              <ul className="profile-content__stats-list">
                <li className="profile-content__stat-item">
                  <h3 className="profile-content__stat-title">
                    {t("total_games")}
                  </h3>
                  <p className="profile-content__stat-value">
                    {userStats.libraryCount}
                  </p>
                </li>

                <li className="profile-content__stat-item">
                  <h3 className="profile-content__stat-title">
                    {t("games_played")}
                  </h3>
                  <p className="profile-content__stat-value">
                    {userStats.gamesPlayed}
                  </p>
                </li>

                <li className="profile-content__stat-item">
                  <h3 className="profile-content__stat-title">
                    {t("total_playtime")}
                  </h3>
                  <p className="profile-content__stat-value">
                    {formatPlaytime(userStats.totalPlaytime)}
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
