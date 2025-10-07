import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { GameDetailsProvider, useGameDetails } from "@/contexts/game-details";
import { CloudSyncProvider, useCloudSync } from "@/contexts/cloud-sync";
import { useLibrary } from "@/hooks";
import { HeroPanel } from "@/components/HeroPanel/HeroPanel";
import { DescriptionHeader } from "@/components/DescriptionHeader/DescriptionHeader";
import { GallerySlider } from "@/components/GallerySlider/GallerySlider";
import { GameDetailsSidebar } from "@/components/GameDetailsSidebar/GameDetailsSidebar";
import { GameOptionsModal, DownloadModal, DlcManager, CloudSyncModal, CloudSyncFilesModal } from "@/components";
import { UnlockIcon } from "@primer/octicons-react";
import cloudIconAnimated from "@/assets/icons/cloud-animated.gif";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "./GameDetails.scss";

function GameDetailsContent() {
  const { shopDetails, stats, isLoading, game, repacks, achievements, showGameOptionsModal, setShowGameOptionsModal, showDownloadModal, setShowDownloadModal, updateGame } = useGameDetails();
  const { objectId, shop } = useParams<{ objectId: string; shop: string }>();
  const [showDlcManager, setShowDlcManager] = useState(false);
  const { setShowCloudSyncModal, showCloudSyncModal, setShowCloudSyncFilesModal, showCloudSyncFilesModal } = useCloudSync();
  const { updateLibrary } = useLibrary();

  const handleCloudSaveClick = () => {
    setShowCloudSyncModal(true);
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

  // HYDRA PATTERN: Don't show error page - just show available data
  // Even if shopDetails is null, we can still show library game info
  
  // HYDRA PATTERN: Multi-source fallback strategy for images
  // Priority: 1) Stats (Yeyodra API) 2) ShopDetails (Steam API) 3) Library Game (Local)
  const heroImage = stats?.assets?.libraryHeroImageUrl || 
                    (effectiveShopDetails?.header_image as string | undefined) || 
                    game?.libraryHeroImageUrl || 
                    "";
  const logoImage = stats?.assets?.logoImageUrl || 
                   (effectiveShopDetails?.capsule_image as string | undefined) || 
                   game?.logoImageUrl || 
                   "";
  
  // HYDRA PATTERN: Always have a title, even if all API calls fail
  const gameTitle = effectiveShopDetails?.name || game?.title || "Unknown Game";

  return (
    <>
      <div className="game-details__wrapper">
        <section className="game-details__container">
          {/* Hero Section - Direct inline like Hydra */}
          <div className="game-details__hero">
            {/* HYDRA PATTERN: Hero image with fallback */}
            {heroImage ? (
              <img
                src={heroImage}
                className="game-details__hero-image"
                alt={gameTitle}
              />
            ) : (
              <div className="game-details__hero-placeholder" />
            )}
            <div className="game-details__hero-backdrop" style={{ flex: 1 }} />

            <div className="game-details__hero-logo-backdrop">
              <div className="game-details__hero-content">
                {/* HYDRA PATTERN: Logo with graceful text fallback */}
                {logoImage ? (
                  <img
                    src={logoImage}
                    className="game-details__game-logo"
                    alt={gameTitle}
                  />
                ) : (
                  <h1 className="game-details__game-logo-text">
                    {gameTitle}
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
              {/* HYDRA PATTERN: Optional chaining - components handle null */}
              {effectiveShopDetails && <DescriptionHeader shopDetails={effectiveShopDetails} />}
              {effectiveShopDetails && <GallerySlider shopDetails={effectiveShopDetails} />}
              
              {/* HYDRA PATTERN: Graceful fallback for description */}
              {isCustomGame ? (
                <div className="game-details__description">
                  <p style={{ color: "#888", fontStyle: "italic" }}>
                    This is a custom game. You can launch it using the Play button above.
                  </p>
                </div>
              ) : effectiveShopDetails?.detailed_description ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: effectiveShopDetails.detailed_description,
                  }}
                  className="game-details__description"
                />
              ) : (
                <div className="game-details__description">
                  <div className="game-details__no-data">
                    <p style={{ color: "#888", fontStyle: "italic" }}>
                      Could not retrieve shop details. This may be due to Steam API rate limiting or temporary unavailability.
                    </p>
                    <p style={{ color: "#888", fontSize: "0.9em", marginTop: "8px" }}>
                      You can still add this game to your library and download it using the buttons above.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* HYDRA PATTERN: Sidebar shows if ANY data available (achievements/stats/shopDetails) */}
            {(effectiveShopDetails || stats || (achievements && achievements.length > 0)) && (
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
      
      {/* HYDRA PATTERN: Use gameTitle constant for consistency */}
      <DownloadModal
        visible={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        appId={objectId || ""}
        gameName={gameTitle}
        gameImageUrl={stats?.assets?.libraryImageUrl || effectiveShopDetails?.header_image}
        hasRepacks={repacks && repacks.length > 0}
        onDownloadComplete={async () => {
          // NEW FLOW: Auto-refresh library after download (game auto-added to library)
          await Promise.all([
            updateGame(),
            updateLibrary(),
          ]);
        }}
      />

      {game && (
        <DlcManager
          visible={showDlcManager}
          onClose={() => setShowDlcManager(false)}
          appId={objectId || ""}
          gameName={gameTitle}
          gameLogoUrl={game.logoImageUrl || undefined}
        />
      )}

      <CloudSyncModal
        visible={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
        gameTitle={gameTitle}
      />

      <CloudSyncFilesModal
        visible={showCloudSyncFilesModal}
        onClose={() => setShowCloudSyncFilesModal(false)}
      />
    </>
  );
}

export function GameDetails() {
  const { objectId, shop } = useParams<{ objectId: string; shop: string }>();
  const [searchParams] = useSearchParams();
  
  // HYDRA PATTERN: Get title from URL query params
  // This ensures title is ALWAYS available, even if Steam API fails
  const gameTitle = searchParams.get("title") || "Unknown Game";

  if (!objectId || !shop) {
    return (
      <div className="game-details-error">
        <h1>Game not found</h1>
        <p>Invalid game ID or shop</p>
      </div>
    );
  }

  return (
    <GameDetailsProvider objectId={objectId} shop={shop} gameTitle={gameTitle}>
      <CloudSyncWrapper objectId={objectId} shop={shop} />
    </GameDetailsProvider>
  );
}

// Wrapper component to access game from context
function CloudSyncWrapper({ objectId, shop }: { objectId: string; shop: string }) {
  return (
    <CloudSyncProvider objectId={objectId} shop={shop}>
      <GameDetailsContent />
    </CloudSyncProvider>
  );
}

