import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { Button, GameCard, Hero } from "../components";
import type { CatalogueGame, Steam250Game } from "../types";
import { CatalogueCategory } from "../types";
import flameIconStatic from "../assets/icons/flame-static.png";
import flameIconAnimated from "../assets/icons/flame-animated.gif";
import starsIconAnimated from "../assets/icons/stars-animated.gif";
import cloudIconAnimated from "../assets/icons/cloud-animated.gif";
import trophyIcon from "../assets/icons/trophy.svg";
import "./Home.scss";

export function Home() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();

  const [animateFlame, setAnimateFlame] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [randomGame, setRandomGame] = useState<Steam250Game | null>(null);

  const [currentCatalogueCategory, setCurrentCatalogueCategory] = useState(
    CatalogueCategory.Hot
  );

  const [catalogue, setCatalogue] = useState<
    Record<CatalogueCategory, CatalogueGame[]>
  >({
    [CatalogueCategory.Hot]: [],
    [CatalogueCategory.Weekly]: [],
    [CatalogueCategory.Achievements]: [],
  });

  const getCatalogue = useCallback(async (category: CatalogueCategory) => {
    try {
      setCurrentCatalogueCategory(category);
      setIsLoading(true);

      const catalogue = await invoke<CatalogueGame[]>("get_catalogue", { category });
      setCatalogue((prev) => ({ ...prev, [category]: catalogue }));
    } catch (error) {
      console.error("Failed to fetch catalogue:", error);
      setCatalogue((prev) => ({ ...prev, [category]: [] }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRandomGame = useCallback(() => {
    invoke<Steam250Game>("get_random_game")
      .then((game) => {
        if (game) setRandomGame(game);
      })
      .catch((error) => {
        console.error("Failed to fetch random game:", error);
      });
  }, []);

  const handleRandomizerClick = () => {
    if (randomGame) {
      navigate(`/game/steam/${randomGame.objectId}`);
    }
  };

  const handleCategoryClick = (category: CatalogueCategory) => {
    if (category !== currentCatalogueCategory) {
      getCatalogue(category);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    getCatalogue(CatalogueCategory.Hot);
    getRandomGame();
  }, [getCatalogue, getRandomGame]);

  const categories = Object.values(CatalogueCategory);

  const handleMouseEnterCategory = (category: CatalogueCategory) => {
    if (category === CatalogueCategory.Hot) {
      setAnimateFlame(true);
    }
  };

  const handleMouseLeaveCategory = (category: CatalogueCategory) => {
    if (category === CatalogueCategory.Hot) {
      setAnimateFlame(false);
    }
  };

  return (
    <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
      <section className="home__content">
        <Hero />

        <section className="home__header">
          <ul className="home__buttons-list">
            {categories.map((category) => (
              <li key={category}>
                <Button
                  theme={
                    category === currentCatalogueCategory
                      ? "primary"
                      : "outline"
                  }
                  onClick={() => handleCategoryClick(category)}
                  onMouseEnter={() => handleMouseEnterCategory(category)}
                  onMouseLeave={() => handleMouseLeaveCategory(category)}
                >
                  {category === CatalogueCategory.Hot && (
                    <div className="home__icon-wrapper">
                      <img
                        src={flameIconStatic}
                        alt="Flame icon"
                        className="home__flame-icon"
                        style={{ display: animateFlame ? "none" : "block" }}
                      />
                      <img
                        src={flameIconAnimated}
                        alt="Flame animation"
                        className="home__flame-icon"
                        style={{ display: animateFlame ? "block" : "none" }}
                      />
                    </div>
                  )}

                  {category === CatalogueCategory.Weekly && (
                    <div className="home__icon-wrapper">
                      <img
                        src={cloudIconAnimated}
                        alt="Cloud animation"
                        className="home__cloud-icon"
                      />
                    </div>
                  )}

                  {category === CatalogueCategory.Achievements && (
                    <div className="home__icon-wrapper">
                      <img
                        src={trophyIcon}
                        alt="Trophy icon"
                        className="home__category-icon"
                      />
                    </div>
                  )}

                  {t(category)}
                </Button>
              </li>
            ))}
          </ul>

          <Button
            onClick={handleRandomizerClick}
            theme="outline"
            disabled={!randomGame}
          >
            <div className="home__icon-wrapper">
              <img
                src={starsIconAnimated}
                alt="Stars animation"
                className="home__stars-icon"
              />
            </div>
            {t("surprise_me")}
          </Button>
        </section>

        <h2 className="home__title">
          {currentCatalogueCategory === CatalogueCategory.Hot && (
            <div className="home__title-icon">
              <img
                src={flameIconAnimated}
                alt="Flame animation"
                className="home__title-flame-icon"
              />
            </div>
          )}

          {currentCatalogueCategory === CatalogueCategory.Weekly && (
            <div className="home__title-icon">
              <img
                src={cloudIconAnimated}
                alt="Cloud animation"
                className="home__title-cloud-icon"
              />
            </div>
          )}

          {currentCatalogueCategory === CatalogueCategory.Achievements && (
            <div className="home__title-icon">
              <img
                src={trophyIcon}
                alt="Trophy icon"
                className="home__title-category-icon"
              />
            </div>
          )}

          {t(currentCatalogueCategory)}
        </h2>

        <section className="home__cards">
          {isLoading
            ? Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} className="home__card-skeleton" />
              ))
            : catalogue[currentCatalogueCategory].map((result) => (
                <GameCard
                  key={result.objectId}
                  game={result}
                  onClick={() => navigate(`/game/${result.shop}/${result.objectId}`)}
                />
              ))}
        </section>
      </section>
    </SkeletonTheme>
  );
}

