import { useParams } from "react-router-dom";
import { GameDetailsProvider, useGameDetails } from "@/contexts/game-details";
import { HeroPanel } from "@/components/HeroPanel/HeroPanel";
import { DescriptionHeader } from "@/components/DescriptionHeader/DescriptionHeader";
import { GallerySlider } from "@/components/GallerySlider/GallerySlider";
import { GameDetailsSidebar } from "@/components/GameDetailsSidebar/GameDetailsSidebar";
import cloudIconAnimated from "@/assets/icons/cloud-animated.gif";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "./GameDetails.scss";

function GameDetailsContent() {
  const { shopDetails, stats, isLoading } = useGameDetails();

  const handleCloudSaveClick = () => {
    // TODO: Implement cloud save modal
    console.log("Cloud save clicked");
  };

  if (isLoading) {
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

  if (!shopDetails) {
    return (
      <div className="game-details-error">
        <h1>Failed to load game details</h1>
        <p>Please try again later</p>
      </div>
    );
  }

  // Use HD assets from Hydra API (stats.assets), fallback to Steam API
  const heroImage = stats?.assets?.libraryHeroImageUrl || shopDetails.header_image || "";
  const logoImage = stats?.assets?.logoImageUrl || shopDetails.capsule_image || "";

  return (
    <div className="game-details__wrapper">
      <section className="game-details__container">
        {/* Hero Section - Direct inline like Hydra */}
        <div className="game-details__hero">
          <img
            src={heroImage}
            className="game-details__hero-image"
            alt={shopDetails.name}
          />
          <div className="game-details__hero-backdrop" style={{ flex: 1 }} />

          <div className="game-details__hero-logo-backdrop">
            <div className="game-details__hero-content">
              {logoImage ? (
                <img
                  src={logoImage}
                  className="game-details__game-logo"
                  alt={shopDetails.name}
                />
              ) : (
                <h1 className="game-details__game-logo-text">{shopDetails.name}</h1>
              )}

              <div className="game-details__hero-buttons game-details__hero-buttons--right">
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
            <DescriptionHeader shopDetails={shopDetails} />
            <GallerySlider shopDetails={shopDetails} />
            
            {/* About This Game - Direct HTML rendering like Hydra */}
            <div
              dangerouslySetInnerHTML={{
                __html: shopDetails.detailed_description,
              }}
              className="game-details__description"
            />
          </div>
          
          <GameDetailsSidebar shopDetails={shopDetails} stats={stats} />
        </div>
      </section>
    </div>
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

