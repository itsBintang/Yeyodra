import { useParams, useSearchParams } from "react-router-dom";
import { GameDetailsProvider, useGameDetails } from "@/contexts/game-details";
import { HeroPanel } from "@/components/HeroPanel/HeroPanel";
import { DescriptionHeader } from "@/components/DescriptionHeader/DescriptionHeader";
import { GallerySlider } from "@/components/GallerySlider/GallerySlider";
import { GameDetailsSidebar } from "@/components/GameDetailsSidebar/GameDetailsSidebar";
import cloudIconAnimated from "@/assets/icons/cloud-animated.gif";
import Skeleton from "react-loading-skeleton";
import "./GameDetails.scss";

function GameDetailsContent() {
  const { shopDetails, stats, isLoading } = useGameDetails();

  const handleCloudSaveClick = () => {
    // TODO: Implement cloud save modal
    console.log("Cloud save clicked");
  };

  if (isLoading) {
    return (
      <div className="game-details">
        {/* Hero Skeleton */}
        <div className="game-details__hero-skeleton">
          <Skeleton height={400} baseColor="#1a1a1a" highlightColor="#2a2a2a" />
        </div>

        {/* Content Skeleton */}
        <div className="game-details__content-skeleton">
          <div className="game-details__main-skeleton">
            <Skeleton height={30} width="60%" style={{ marginBottom: "1rem" }} />
            <Skeleton count={5} style={{ marginBottom: "0.5rem" }} />
          </div>
          <div className="game-details__sidebar-skeleton">
            <Skeleton height={200} style={{ marginBottom: "1rem" }} />
            <Skeleton height={100} />
          </div>
        </div>
      </div>
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

  // Hydra uses libraryHeroImageUrl from assets, fallback to header_image
  const heroImage = shopDetails.header_image || "";
  const logoImage = shopDetails.capsule_image || "";

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
  const { objectId } = useParams<{ objectId: string }>();
  const [searchParams] = useSearchParams();
  const shop = searchParams.get("shop") || "steam";

  if (!objectId) {
    return (
      <div className="game-details-error">
        <h1>Game not found</h1>
        <p>Invalid game ID</p>
      </div>
    );
  }

  return (
    <GameDetailsProvider objectId={objectId} shop={shop}>
      <GameDetailsContent />
    </GameDetailsProvider>
  );
}

