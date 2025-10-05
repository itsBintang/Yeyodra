import { useState } from "react";
import { useParams } from "react-router-dom";
import { GameDetailsProvider, useGameDetails } from "@/contexts/game-details";
import { HeroPanel } from "@/components/HeroPanel/HeroPanel";
import { DescriptionHeader } from "@/components/DescriptionHeader/DescriptionHeader";
import { GallerySlider } from "@/components/GallerySlider/GallerySlider";
import { GameDetailsSidebar } from "@/components/GameDetailsSidebar/GameDetailsSidebar";
import { GameOptionsModal, DownloadModal, DlcManager } from "@/components";
import { UnlockIcon } from "@primer/octicons-react";
import cloudIconAnimated from "@/assets/icons/cloud-animated.gif";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "./GameDetails.scss";

function GameDetailsContent() {
  const { shopDetails, stats, isLoading, game, repacks, achievements, showGameOptionsModal, setShowGameOptionsModal, showDownloadModal, setShowDownloadModal, updateGame } = useGameDetails();
  const { objectId, shop } = useParams<{ objectId: string; shop: string }>();
  const [showDlcManager, setShowDlcManager] = useState(false);

  const handleCloudSaveClick = () => {
    // TODO: Implement cloud save modal
    console.log("Cloud save clicked");
  };

  const handleManageDlcs = () => {
    setShowDlcManager(true);
  };

  // For custom games, create mock shopDetails from library game data
  const isCustomGame = shop === "custom";
  const effectiveShopDetails = isCustomGame && game ? {
    objectId: game.objectId,
    type: "game",
    name: game.title,
    steam_appid: 0,
    is_free: false,
    detailed_description: "",
    about_the_game: "",
    short_description: "",
    header_image: game.libraryHeroImageUrl || undefined,
    capsule_image: game.iconUrl || undefined,
    screenshots: [],
    movies: [],
    developers: [],
    publishers: [],
    genres: [],
    categories: [],
    supported_languages: "",
    pc_requirements: { minimum: "", recommended: "" },
    mac_requirements: { minimum: "", recommended: "" },
    linux_requirements: { minimum: "", recommended: "" },
    release_date: { coming_soon: false, date: "" },
    content_descriptors: { ids: [] },
  } : shopDetails;

  // For custom games, wait for game to load before showing UI
  if (isLoading || (isCustomGame && !game)) {
    return (
      <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
        <div className="game-details__wrapper">
          <div className="game-details__container">
            {/* Hero Skeleton */}
            <div className="game-details__hero">
              <Skeleton className="game-details__hero-image-skeleton" />
            </div>

            {/* Hero Panel Skeleton */}
            <div className="game-details__hero-panel-skeleton">
              <div className="hero-panel__content">
                <Skeleton width={155} height={16} />
                <Skeleton width={135} height={16} />
              </div>
            </div>

            {/* Description Container Skeleton */}
            <div className="game-details__description-container">
              <div className="game-details__description-content">
                {/* Description Header Skeleton */}
                <div className="description-header">
                  <section className="description-header__info">
                    <Skeleton width={145} height={16} />
                    <Skeleton width={150} height={16} />
                  </section>
                </div>

                {/* Description Body Skeleton */}
                <div className="game-details__description-skeleton">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={`desc-${index}`} height={16} style={{ marginBottom: "8px" }} />
                  ))}
                  <Skeleton height={200} style={{ marginTop: "16px", marginBottom: "16px" }} />
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={`desc2-${index}`} height={16} style={{ marginBottom: "8px" }} />
                  ))}
                  <Skeleton height={200} style={{ marginTop: "16px", marginBottom: "16px" }} />
                  <Skeleton height={16} />
                </div>
              </div>

              {/* Sidebar Skeleton */}
              <div className="game-details-sidebar">
                <div className="game-details-sidebar__section">
                  <Skeleton height={20} width="50%" style={{ marginBottom: "16px" }} />
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={`sidebar-${index}`} height={20} style={{ marginBottom: "8px" }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SkeletonTheme>
    );
  }

  // Don't show error for custom games even if shopDetails is null
  if (!effectiveShopDetails && !isCustomGame) {
    return (
      <div className="game-details-error">
        <h1>Failed to load game details</h1>
        <p>Please try again later</p>
      </div>
    );
  }

  // Use HD assets from Hydra API (stats.assets), fallback to Steam API or library game
  const heroImage = stats?.assets?.libraryHeroImageUrl || 
                    (effectiveShopDetails?.header_image as string | undefined) || 
                    game?.libraryHeroImageUrl || 
                    "";
  const logoImage = stats?.assets?.logoImageUrl || 
                   (effectiveShopDetails?.capsule_image as string | undefined) || 
                   game?.logoImageUrl || 
                   "";

  return (
    <>
      <div className="game-details__wrapper">
        <section className="game-details__container">
          {/* Hero Section - Direct inline like Hydra */}
          <div className="game-details__hero">
            {heroImage ? (
              <img
                src={heroImage}
                className="game-details__hero-image"
                alt={(effectiveShopDetails?.name || game?.title || "Game") as string}
              />
            ) : (
              <div className="game-details__hero-placeholder" />
            )}
            <div className="game-details__hero-backdrop" style={{ flex: 1 }} />

            <div className="game-details__hero-logo-backdrop">
              <div className="game-details__hero-content">
                {logoImage ? (
                  <img
                    src={logoImage}
                    className="game-details__game-logo"
                    alt={(effectiveShopDetails?.name || game?.title || "") as string}
                  />
                ) : (
                  <h1 className="game-details__game-logo-text">
                    {(effectiveShopDetails?.name || game?.title || "Custom Game") as string}
                  </h1>
                )}

                <div className="game-details__hero-buttons game-details__hero-buttons--right">
                  {game && (
                    <button
                      type="button"
                      className="game-details__dlc-button"
                      onClick={handleManageDlcs}
                    >
                      <UnlockIcon size={20} />
                      DLC Unlocker
                    </button>
                  )}
                  <button
                    type="button"
                    className="game-details__cloud-sync-button"
                    onClick={handleCloudSaveClick}
                  >
                    <div className="game-details__cloud-icon-container">
                      <img
                        src={cloudIconAnimated}
                        alt="Cloud icon"
                        className="game-details__cloud-icon"
                      />
                    </div>
                    Cloud save
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Panel (glassmorphism bar) */}
          <HeroPanel />

          {/* Description Container */}
          <div className="game-details__description-container">
            <div className="game-details__description-content">
              {effectiveShopDetails && <DescriptionHeader shopDetails={effectiveShopDetails} />}
              {effectiveShopDetails && <GallerySlider shopDetails={effectiveShopDetails} />}
              
              {/* About This Game - Direct HTML rendering like Hydra */}
              {isCustomGame ? (
                <div className="game-details__description">
                  <p style={{ color: "#888", fontStyle: "italic" }}>
                    This is a custom game. You can launch it using the Play button above.
                  </p>
                </div>
              ) : (
                effectiveShopDetails && (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: effectiveShopDetails.detailed_description,
                    }}
                    className="game-details__description"
                  />
                )
              )}
            </div>
            
            {effectiveShopDetails && (
              <GameDetailsSidebar 
                shopDetails={effectiveShopDetails} 
                stats={stats} 
                achievements={achievements}
                shop={shop}
                objectId={objectId}
              />
            )}
          </div>
        </section>
      </div>

      {/* Modals */}
      {game && (
        <GameOptionsModal
          visible={showGameOptionsModal}
          game={game}
          onClose={() => setShowGameOptionsModal(false)}
          onGameUpdate={updateGame}
        />
      )}
      
      <DownloadModal
        visible={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        appId={objectId || ""}
        gameName={effectiveShopDetails?.name || game?.title || ""}
        gameImageUrl={stats?.assets?.libraryImageUrl || effectiveShopDetails?.header_image}
        hasRepacks={repacks && repacks.length > 0}
        onDownloadComplete={updateGame}
      />

      {game && (
        <DlcManager
          visible={showDlcManager}
          onClose={() => setShowDlcManager(false)}
          appId={objectId || ""}
          gameName={effectiveShopDetails?.name || game?.title || ""}
          gameLogoUrl={game.logoImageUrl || undefined}
        />
      )}
    </>
  );
}

export function GameDetails() {
  const { objectId, shop } = useParams<{ objectId: string; shop: string }>();

  if (!objectId || !shop) {
    return (
      <div className="game-details-error">
        <h1>Game not found</h1>
        <p>Invalid game ID or shop</p>
      </div>
    );
  }

  return (
    <GameDetailsProvider objectId={objectId} shop={shop}>
      <GameDetailsContent />
    </GameDetailsProvider>
  );
}

