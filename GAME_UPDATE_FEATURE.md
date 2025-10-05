# Game Update Feature - Implementation Complete

## Overview
Implemented a simple game update feature that enables Steam to download updates for pirated games by commenting out `setManifestid` lines in the game's `.lua` file.

## How It Works

### Enable Update (Comment Out)
When user clicks "Update Game" button:
1. Find the game's `.lua` file in `Steam/config/stplug-in/`
2. Comment out all `setManifestid` lines by adding `--` prefix
3. Steam will now detect the game needs update and download it automatically

**Example:**
```lua
# Before (update disabled):
setManifestid(268911, "6818141525323043853", 0)
setManifestid(268912, "8633535714830637397", 0)

# After (update enabled):
--setManifestid(268911, "6818141525323043853", 0)
--setManifestid(268912, "8633535714830637397", 0)
```

### Disable Update (Uncomment)
When user wants to lock the game version again:
1. Remove `--` prefix from all commented `setManifestid` lines
2. Game version is now locked again

## Implementation

### Rust Backend (`src-tauri/src/steamtools.rs`)

#### `enable_game_update(app_id: &str)`
- Finds the `.lua` file for the given AppID
- Uses regex to find all `setManifestid` lines
- Adds `--` comment prefix to each line
- Writes the modified content back to the file
- Returns success message with count of commented lines

#### `disable_game_update(app_id: &str)`
- Finds the `.lua` file for the given AppID
- Uses regex to find all commented `--setManifestid` lines
- Removes `--` prefix from each line
- Writes the modified content back to the file
- Returns success message with count of uncommented lines

### Tauri Commands (`src-tauri/src/lib.rs`)

```rust
#[tauri::command]
fn enable_update_for_game(app_id: String) -> Result<String, String>

#[tauri::command]
fn disable_update_for_game(app_id: String) -> Result<String, String>
```

### Frontend (`src/components/HeroPanel/HeroPanelActions.tsx`)

#### `handleUpdateClick()`
- Calls `enable_update_for_game` Tauri command
- Shows beautiful toast notification (success/error) to user
- Disables buttons during operation
- Uses custom toast component with glassmorphism design

#### UI Integration
- "Update Game" button appears when user clicks Sync icon (green)
- Button calls `handleUpdateClick` instead of `handleDownloadClick`
- Shows loading state during operation

## Usage

1. **Enable Update:**
   - User has game installed from SteamTools
   - Click Sync icon (green) in hero panel
   - Main button changes to "Update Game"
   - Click "Update Game" button
   - All `setManifestid` lines are commented out
   - Open Steam and it will detect the game needs update

2. **Disable Update (optional):**
   - Call `disable_update_for_game` command
   - All commented lines are uncommented
   - Game version is locked again

## Error Handling

- ✅ Validates Steam config path exists
- ✅ Validates stplug-in directory exists
- ✅ Validates `.lua` file exists for the game
- ✅ Checks if lines are already commented/uncommented
- ✅ Returns informative error messages

## Regex Patterns

### Comment Out Pattern:
```rust
r"(?m)^(\s*)(setManifestid\s*\([^)]+\)\s*)$"
```
- `(?m)` - Multiline mode
- `^(\s*)` - Capture leading whitespace
- `(setManifestid\s*\([^)]+\)\s*)` - Capture the setManifestid line
- `$` - End of line

### Uncomment Pattern:
```rust
r"(?m)^(\s*)--(\s*setManifestid\s*\([^)]+\)\s*)$"
```
- Same as above but matches lines starting with `--`

## Benefits

1. **Simple Implementation:** Just text manipulation, no complex logic
2. **Safe:** Only modifies `.lua` files, doesn't touch game files
3. **Reversible:** Can easily disable updates again
4. **Steam Native:** Uses Steam's built-in update mechanism
5. **No Downloads:** Doesn't require downloading anything through launcher

## UI/UX Features

### Toast Notifications
- ✅ **Success Toast:** Green checkmark icon with glassmorphism design
- ✅ **Error Toast:** Red X icon with detailed error message
- ✅ **Auto-dismiss:** Toast disappears after 5 seconds
- ✅ **Progress bar:** Visual feedback of remaining time
- ✅ **Smooth animations:** Slide up from bottom with fade effect
- ✅ **Manual close:** User can dismiss toast early with X button

### Toast Design
- Dark background with backdrop blur (glassmorphism)
- Rounded corners (8px)
- Box shadow for depth
- Consistent with app's dark theme
- Icon colors: Success (#34d399), Error (#ef4444)

## Future Enhancements

- [ ] Show update progress from Steam
- [ ] Auto-detect if updates are available
- [ ] Batch update multiple games
- [ ] Check current update status (enabled/disabled)
- [ ] Add "Disable Update" option to re-lock game version

## Files Modified

✅ `src-tauri/src/steamtools.rs` - Added `enable_game_update()` and `disable_game_update()`
✅ `src-tauri/src/lib.rs` - Added Tauri commands
✅ `src/components/HeroPanel/HeroPanelActions.tsx` - Added `handleUpdateClick()` handler

## Testing

Test the feature:
1. Build the app: `npm run tauri build` or `npm run tauri dev`
2. Navigate to a game details page (game must be installed)
3. Click the Sync icon (green)
4. Click "Update Game" button
5. Check the `.lua` file - all `setManifestid` lines should be commented
6. Open Steam - it should now show the game needs an update

## Important Notes

⚠️ **User must restart Steam** after enabling updates for changes to take effect
⚠️ **Only works for games installed via SteamTools** (games that have `.lua` files)
⚠️ **Updates will download through Steam**, not through Chaos Launcher

