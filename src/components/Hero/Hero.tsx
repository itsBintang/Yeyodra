import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Skeleton from "react-loading-skeleton";
import type { TrendingGame } from "../../types";
import "./Hero.scss";

export function Hero() {
  const [isLoading, setIsLoading] = useState(false);
  const [featuredGameDetails, setFeaturedGameDetails] = useState<TrendingGame[] | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    invoke<TrendingGame[]>("get_trending_games")
      .then((result) => {
        setFeaturedGameDetails(result);
      })
      .catch((error) => {
        console.error("Failed to fetch trending games:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <Skeleton className="hero" />;
  }

  if (featuredGameDetails?.length) {
    return featuredGameDetails.map((game) => (
      <button
        type="button"
        onClick={() => navigate(game.uri)}
        className="hero"
        key={game.uri}
      >
        <div className="hero__backdrop">
          <img
            src={game.libraryHeroImageUrl}
            alt={game.description ?? ""}
            className="hero__media"
          />

          <div className="hero__content">
            <img
              src={game.logoImageUrl}
              width="250px"
              alt={game.description ?? ""}
              loading="eager"
              className="hero__logo"
            />
            <p className="hero__description">{game.description}</p>
          </div>
        </div>
      </button>
    ));
  }

  return null;
}

