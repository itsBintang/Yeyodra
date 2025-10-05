# Stats Display Fix - Download Count & Player Count

## Issue Description
Stats (Download Count and Player Count) were showing as `NaN` on the game details page, even though they were working correctly on game cards in the home page on hover.

## Root Cause Analysis

### The Problem
There was a **naming convention mismatch** between the TypeScript type definition and the actual data structure being sent from the Rust backend:

1. **TypeScript Type Definition** (incorrect):
   ```typescript
   export interface GameStats {
     download_count: number;  // ❌ snake_case
     player_count: number;    // ❌ snake_case
     assets?: ShopAssets | null;
   }
   ```

2. **Rust Backend Serialization** (correct):
   ```rust
   pub struct GameStats {
       #[serde(rename = "downloadCount", alias = "download_count")]
       pub download_count: i64,  // Serializes as "downloadCount"
       #[serde(rename = "playerCount", alias = "player_count")]
       pub player_count: i64,    // Serializes as "playerCount"
       pub assets: Option<ShopAssets>,
   }
   ```

3. **Frontend Usage**:
   - `GameCard.tsx` was correctly using `stats.downloadCount` and `stats.playerCount`
   - `GameDetailsSidebar.tsx` was incorrectly using `stats.download_count` and `stats.player_count`

### Why GameCard Worked But GameDetailsSidebar Didn't

The `GameCard` component had its own local interface definition:
```typescript
interface GameStats {
  downloadCount: number;  // ✅ Correct camelCase
  playerCount: number;    // ✅ Correct camelCase
}
```

While `GameDetailsSidebar` was using the global type from `src/types/index.ts` which had the incorrect snake_case naming.

## Solution

### Changes Made

1. **Fixed TypeScript Type Definition** (`src/types/index.ts`):
   ```typescript
   export interface GameStats {
     downloadCount: number;  // ✅ Changed to camelCase
     playerCount: number;    // ✅ Changed to camelCase
     assets?: ShopAssets | null;
   }
   ```

2. **Updated GameDetailsSidebar Component** (`src/components/GameDetailsSidebar/GameDetailsSidebar.tsx`):
   ```typescript
   // Before:
   {formatNumber(stats.download_count)}  // ❌
   {formatNumber(stats.player_count)}    // ❌
   
   // After:
   {formatNumber(stats.downloadCount)}   // ✅
   {formatNumber(stats.playerCount)}     // ✅
   ```

### No Changes Needed

- **Rust Backend**: Already correctly configured to serialize as camelCase
- **GameCard Component**: Already using correct camelCase property names
- **API Calls**: No changes needed, already working correctly

## Verification

After the fix, verified that:
1. ✅ No linter errors
2. ✅ All usages of `downloadCount` and `playerCount` are consistent across the codebase
3. ✅ TypeScript type matches the actual JSON structure from Rust backend
4. ✅ Both GameCard (home page) and GameDetailsSidebar (details page) use the same property names

## How Hydra Does It

Checked the Hydra implementation for reference:
- Hydra uses **camelCase** consistently: `downloadCount`, `playerCount`
- This is the standard JavaScript/TypeScript convention
- Rust backend properly handles the serialization with `serde` rename attributes

## Files Modified
1. `src/types/index.ts` - Fixed GameStats interface
2. `src/components/GameDetailsSidebar/GameDetailsSidebar.tsx` - Updated property access

## Testing Recommendations
1. Navigate to a game details page and verify stats show numbers instead of `NaN`
2. Hover over game cards on the home page to ensure stats still load correctly
3. Check browser console for any API or parsing errors

## Lessons Learned
- Always match TypeScript types to the actual serialized JSON structure
- When using `serde` with rename, ensure frontend types match the renamed values, not the Rust field names
- Check both the local type definitions and global type definitions when debugging type issues

