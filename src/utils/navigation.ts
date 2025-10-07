// HYDRA PATTERN: Navigation helpers with title in URL for graceful degradation

export interface GameNavigationData {
  shop: string;
  objectId: string;
  title: string;
}

/**
 * Build game details path with title in query params
 * This ensures title is always available even if Steam API fails
 * Pattern from Hydra
 */
export function buildGameDetailsPath(
  game: GameNavigationData,
  params: Record<string, string> = {}
): string {
  const searchParams = new URLSearchParams({ title: game.title, ...params });
  return `/game/${game.shop}/${game.objectId}?${searchParams.toString()}`;
}

/**
 * Build achievements path with game data
 */
export function buildGameAchievementsPath(
  game: GameNavigationData
): string {
  const searchParams = new URLSearchParams({
    title: game.title,
    shop: game.shop,
    objectId: game.objectId,
  });
  return `/achievements/${game.shop}/${game.objectId}/${encodeURIComponent(game.title)}?${searchParams.toString()}`;
}

