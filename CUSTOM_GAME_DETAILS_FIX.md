# Custom Game Details Page Fix

## Problem
Custom games (shop: "custom") were showing "Failed to load game details" error when clicked from the library. This happened because the app was trying to fetch Steam API data for custom games, which don't exist in Steam.

## Root Cause
The `GameDetailsProvider` context was calling:
- `fetchShopDetails()` - Tries to fetch from Steam API
- `fetchStats()` - Tries to fetch from Hydra API  
- `fetchAchievements()` - Tries to fetch achievements

All of these fail for custom games since they only exist locally.

## Solution (Following Hydra Pattern)

### Backend (Context) - `src/contexts/game-details.tsx`

Added shop type checking to skip API calls for custom games:

```typescript
// Fetch shop details (Steam API) - Skip for custom games
const fetchShopDetails = useCallback(async () => {
  // Skip fetching for custom games
  if (shop === "custom") {
    return;
  }
  
  // ... existing Steam API fetch code
}, [objectId, shop]);

// Fetch game stats (Hydra API) - Skip for custom games
const fetchStats = useCallback(async () => {
  // Skip fetching for custom games
  if (shop === "custom") {
    return;
  }
  
  // ... existing Hydra API fetch code
}, [objectId, shop]);

// Fetch achievements - Skip for custom games
const fetchAchievements = useCallback(async () => {
  // Skip fetching for custom games
  if (shop === "custom") {
    return;
  }
  
  // ... existing achievements fetch code
}, [objectId, shop]);
```

### Frontend (UI) - `src/pages/GameDetails.tsx`

Created mock `shopDetails` from library game data for custom games:

```typescript
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
```

### Key Changes

1. **Don't show error for custom games:**
```typescript
// Before:
if (!shopDetails) {
  return <div>Failed to load game details</div>;
}

// After:
if (!effectiveShopDetails && !isCustomGame) {
  return <div>Failed to load game details</div>;
}
```

2. **Use library game data for hero images:**
```typescript
const heroImage = stats?.assets?.libraryHeroImageUrl || 
                  effectiveShopDetails?.header_image || 
                  game?.libraryHeroImageUrl || 
                  "";
const logoImage = stats?.assets?.logoImageUrl || 
                 effectiveShopDetails?.capsule_image || 
                 game?.logoImageUrl || 
                 "";
```

3. **Show custom game message instead of description:**
```typescript
{isCustomGame ? (
  <div className="game-details__description">
    <p style={{ color: "#888", fontStyle: "italic" }}>
      This is a custom game. You can launch it using the Play button above.
    </p>
  </div>
) : (
  effectiveShopDetails && (
    <div dangerouslySetInnerHTML={{
      __html: effectiveShopDetails.detailed_description,
    }} />
  )
)}
```

4. **Use effectiveShopDetails throughout:**
```typescript
// Game title
{effectiveShopDetails?.name || game?.title || "Custom Game"}

// Components
{effectiveShopDetails && <DescriptionHeader shopDetails={effectiveShopDetails} />}
{effectiveShopDetails && <GallerySlider shopDetails={effectiveShopDetails} />}

// Modals
gameName={effectiveShopDetails?.name || game?.title || ""}
```

## How Hydra Does It

### Hydra's Approach:
```typescript
// From game-details.context.tsx line 74-76
if (game?.shop === "custom") {
  return "";
}

// From game-details-content.tsx line 74-76
const aboutTheGame = useMemo(() => {
  if (game?.shop === "custom") {
    return "";
  }
  // ... fetch from shopDetails
}, [shopDetails, t, game?.shop]);
```

Hydra checks `game?.shop === "custom"` and returns early or provides empty content.

## Comparison: Chaos vs Hydra

### Similarities ✅
- Both check for `shop === "custom"`
- Both skip API calls for custom games
- Both use library game data for display
- Both show empty/minimal content for custom games

### Differences
- **Hydra:** Uses Electron IPC with separate database (Level.js)
- **Chaos:** Uses Tauri invoke with JSON file storage
- **Hydra:** More integrated with shop assets system
- **Chaos:** Simpler, creates mock shopDetails object

## Result

### Before Fix:
- ❌ Custom games show "Failed to load game details"
- ❌ Error in console trying to fetch from Steam
- ❌ Infinite loading or error state

### After Fix:
- ✅ Custom games display properly
- ✅ Shows game title (from library data)
- ✅ Shows hero image (if set in library)
- ✅ Play button works
- ✅ Options button works
- ✅ Simple description: "This is a custom game..."
- ✅ No API errors in console

## Testing Checklist

- [x] Custom game shows details page (not error)
- [x] Game title displays correctly
- [x] Hero image shows if available in library
- [x] Logo image shows if available
- [x] Fallback to text title if no logo
- [x] Play button visible and functional
- [x] Options button opens modal
- [x] Description shows custom game message
- [x] No API errors for custom games in console
- [x] Regular Steam games still work normally
- [x] Regular games still fetch from APIs

## Files Modified

1. `src/contexts/game-details.tsx`
   - Added `shop === "custom"` checks in fetch functions
   - Skip API calls for custom games

2. `src/pages/GameDetails.tsx`
   - Created `effectiveShopDetails` mock for custom games
   - Updated error handling to exclude custom games
   - Updated hero image fallbacks
   - Added custom game description message
   - Updated all components to use `effectiveShopDetails`

## Technical Notes

### Why Mock ShopDetails?
The entire GameDetails UI is built around the `ShopDetails` type from Steam API. Rather than refactoring all components to make shopDetails optional, we create a mock object with the structure expected by all child components.

### Data Flow
1. User clicks custom game in library
2. Navigate to `/game/custom/{uuid}`
3. `GameDetailsProvider` loads
4. Checks `shop === "custom"` → skips API calls
5. `updateGame()` fetches from local library
6. `GameDetailsContent` creates `effectiveShopDetails` from library data
7. UI renders with library data

### Benefits of This Approach
- ✅ Minimal code changes
- ✅ No component refactoring needed
- ✅ Type-safe (uses existing ShopDetails type)
- ✅ Follows Hydra's pattern
- ✅ Clean separation of concerns

## Future Enhancements

Possible improvements:
- [ ] Allow editing custom game description
- [ ] Support custom screenshots/gallery
- [ ] Add custom metadata fields (genre, developer, etc.)
- [ ] Import metadata from IGDB/Steam if game exists there
- [ ] Better placeholder images for custom games
- [ ] Custom game categories/tags

## Conclusion

Custom games now work properly in the game details page, following Hydra's implementation pattern. The fix is clean, type-safe, and doesn't require refactoring existing components.

