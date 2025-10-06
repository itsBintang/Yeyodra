# Ludasavi Steam App ID Fix - FINAL SOLUTION

## 🎯 ROOT CAUSE DISCOVERY

### Initial Assumption (WRONG ❌)
Initially, we believed that Ludusavi CLI requires **game titles** (e.g., "Stardew Valley") based on:
- Hydra's code review showing both `title` and `objectId` stored in database
- Misunderstanding of Ludusavi manifest structure
- Assumption that game titles would be more "human-readable"

### Testing Revealed Truth (CORRECT ✅)

**Direct CLI Testing:**
```powershell
# Test 1: Using Steam App ID
PS> ludusavi.exe --config $config backup "413150" --preview --api
Result: ✅ SUCCESS - "totalGames": 1, detected save files

# Test 2: Using Game Title
PS> ludusavi.exe --config $config backup "Stardew Valley" --preview --api
Result: ❌ FAIL - "unknownGames": ["Stardew Valley"], "totalGames": 0
```

**Manifest Structure Analysis:**
```yaml
# Ludusavi manifest.yaml structure
"413150":  # ← Key is Steam App ID, NOT game title!
  files:
    <winAppData>/StardewValley/Saves:
      tags:
        - save
      when:
        - os: windows
```

## 📊 KEY FINDINGS

1. **Ludusavi Manifest Database uses Steam App IDs as PRIMARY KEYs**
   - Entry: `"413150"` (Steam App ID for Stardew Valley)
   - NOT: `"Stardew Valley"` (game title)

2. **Ludusavi CLI `backup` command accepts Steam App ID directly**
   - No need for title-to-ID conversion
   - Works out-of-the-box with Steam App IDs

3. **Hydra's implementation was CORRECT all along**
   - Hydra passes `objectId` (Steam App ID) to Ludusavi
   - Our initial "fix" to use `game.title` was WRONG

## 🔧 THE FIX

### Backend Changes

#### 1. `src-tauri/src/ludasavi.rs`
```rust
// BEFORE (WRONG):
pub fn backup_game(&self, game_title: &str, ...) -> Result<LudusaviBackup> {
    let mut args = vec![
        "backup".to_string(),
        game_title.to_string(),  // ❌ WRONG
    ];
}

// AFTER (CORRECT):
pub fn backup_game(&self, object_id: &str, ...) -> Result<LudusaviBackup> {
    let mut args = vec![
        "backup".to_string(),
        object_id.to_string(),  // ✅ CORRECT - Steam App ID
    ];
}
```

#### 2. `src-tauri/src/cloud_sync.rs`
```rust
// BEFORE (WRONG):
fn bundle_backup(&self, shop: &str, object_id: &str, game_title: &str, ...) {
    self.ludasavi.backup_game(game_title, ...)?;  // ❌
}

// AFTER (CORRECT):
fn bundle_backup(&self, shop: &str, object_id: &str, ...) {
    self.ludasavi.backup_game(object_id, ...)?;  // ✅
}
```

#### 3. `src-tauri/src/lib.rs`
```rust
// BEFORE (WRONG):
#[tauri::command]
fn get_game_backup_preview(
    app_handle: tauri::AppHandle,
    game_title: String,  // ❌
    _shop: String,
) -> Result<LudusaviBackup, String> {
    ludasavi.get_backup_preview(&game_title, ...)?  // ❌
}

// AFTER (CORRECT):
#[tauri::command]
fn get_game_backup_preview(
    app_handle: tauri::AppHandle,
    object_id: String,  // ✅
    _shop: String,
) -> Result<LudusaviBackup, String> {
    ludasavi.get_backup_preview(&object_id, ...)?  // ✅
}
```

### Frontend Changes

#### 4. `src/contexts/cloud-sync.tsx`
```typescript
// BEFORE (WRONG):
interface CloudSyncProviderProps {
  objectId: string;
  shop: string;
  gameTitle: string;  // ❌ Not needed
}

const getGameBackupPreview = useCallback(async () => {
  const preview = await invoke<LudusaviBackup>("get_game_backup_preview", {
    gameTitle,  // ❌
    shop,
  });
}, [gameTitle, shop]);  // ❌

// AFTER (CORRECT):
interface CloudSyncProviderProps {
  objectId: string;
  shop: string;
  // gameTitle removed ✅
}

const getGameBackupPreview = useCallback(async () => {
  const preview = await invoke<LudusaviBackup>("get_game_backup_preview", {
    objectId,  // ✅
    shop,
  });
}, [objectId, shop]);  // ✅
```

#### 5. `src/pages/GameDetails.tsx`
```typescript
// BEFORE (WRONG):
function CloudSyncWrapper({ objectId, shop }: { objectId: string; shop: string }) {
  const { game } = useGameDetails();
  return (
    <CloudSyncProvider objectId={objectId} shop={shop} gameTitle={game?.title || ""}>
      {/* ❌ passing gameTitle */}
    </CloudSyncProvider>
  );
}

// AFTER (CORRECT):
function CloudSyncWrapper({ objectId, shop }: { objectId: string; shop: string }) {
  return (
    <CloudSyncProvider objectId={objectId} shop={shop}>
      {/* ✅ objectId only */}
    </CloudSyncProvider>
  );
}
```

## 🧪 VERIFICATION

### Test Case: Stardew Valley (Steam App ID: 413150)

**Manual CLI Test:**
```powershell
PS> $binary = "$env:APPDATA\com.nazril.tauri-app\ludusavi\ludusavi.exe"
PS> $config = "$env:APPDATA\com.nazril.tauri-app\ludusavi"
PS> & $binary --config $config backup "413150" --preview --api

Result:
{
  "overall": {
    "totalGames": 1,
    "totalBytes": 52416044,
    "processedGames": 1,
    "processedBytes": 52416044
  },
  "games": {
    "413150": {
      "decision": "Processed",
      "files": {
        "C:/Users/.../AppData/Roaming/StardewValley/Saves": {...}
      }
    }
  }
}
✅ SUCCESS!
```

**Expected App Behavior:**
1. User clicks "Cloud save" button in game details
2. Frontend passes `objectId: "413150"` to `get_game_backup_preview` command
3. Backend calls `ludusavi backup "413150" --preview --api`
4. Ludusavi detects save files for Steam App ID 413150
5. UI displays detected saves and backup options

## 📝 LESSONS LEARNED

1. **ALWAYS test assumptions with direct CLI commands**
   - Don't rely solely on code review
   - Verify behavior with manual testing

2. **Understand data structures before implementing**
   - Ludusavi manifest uses Steam App IDs as keys
   - This is documented but easy to miss

3. **Trust working implementations**
   - Hydra's approach was correct
   - Our "improvement" broke functionality

4. **Test incrementally**
   - Each parameter change should be verified
   - Don't assume title = better than ID

## ✅ FINAL STATUS

- [x] Reverted all `game_title` → `object_id` parameter changes
- [x] Backend now correctly passes Steam App ID to Ludusavi
- [x] Frontend correctly sends `objectId` in IPC calls
- [x] All dependency arrays updated
- [x] No linter errors
- [x] Manual CLI testing confirms fix works

## 🚀 NEXT STEPS

1. Test cloud save feature in running app
2. Verify backup/restore for multiple games
3. Document for other game shops (GOG, Epic, etc.)
4. Implement automatic backup on game start/stop

---

**Date:** October 6, 2025
**Issue:** Ludusavi not detecting save games
**Root Cause:** Passing game title instead of Steam App ID
**Solution:** Use Steam App ID (objectId) throughout the entire stack

