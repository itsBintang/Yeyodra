# Ludasavi Root Cause Analysis - FINAL REPORT

**Tanggal:** 6 Oktober 2025  
**Status:** ✅ ROOT CAUSE IDENTIFIED

---

## 🎯 EXECUTIVE SUMMARY

**Problem:** Cloud save tidak bisa detect save games untuk Stardew Valley di Chaos.  
**Error:** "The system cannot find the file specified. (os error 2)"

**Root Cause:** Ludusavi CLI **membutuhkan GAME TITLE** untuk lookup save files dari manifest database, BUKAN Steam App ID.

---

## 📊 DETAILED FINDINGS

### 1. Ludusavi Manifest Structure

Ludusavi memiliki database manifest (~20,000+ games) dengan struktur:

```json
{
  "Stardew Valley": {           // ← GAME TITLE as PRIMARY KEY
    "files": {
      "<home>/AppData/Roaming/StardewValley/Saves/**.xml": {}
    },
    "steam": {"id": 413150},    // ← Steam App ID as METADATA
    "gog": {"id": 1453375253}
  }
}
```

**Key Insight:** Game **TITLE** adalah **PRIMARY KEY**, Steam App ID hanya **METADATA**.

---

### 2. Testing Results

#### ✅ Test 1: Backup dengan Game Title
```bash
PS> .\ludusavi.exe backup "Stardew Valley" --preview --api

{
  "overall": {
    "totalGames": 1,
    "totalBytes": 3116130,
    "processedGames": 1
  },
  "games": {
    "Stardew Valley": {
      "decision": "Processed",
      "change": "New",
      "files": {
        "C:/Users/Nazril/AppData/Roaming/StardewValley/Saves/...": {
          "bytes": 3073797
        }
      }
    }
  }
}
```
**✅ SUCCESS!** Ludusavi detect semua save files!

---

#### ❌ Test 2: Backup dengan Steam App ID
```bash
PS> .\ludusavi.exe backup "413150" --preview --api

{
  "errors": {
    "unknownGames": ["413150"]
  },
  "overall": {
    "totalGames": 0,
    "totalBytes": 0
  }
}
```
**❌ FAILED!** Ludusavi tidak recognize "413150" sebagai game.

---

#### ✅ Test 3: Find dengan Steam ID Flag
```bash
PS> .\ludusavi.exe find --steam-id 413150 --api

{
  "games": {
    "Stardew Valley": {
      "score": 1.0
    }
  }
}
```
**✅ SUCCESS!** Ludusavi bisa **resolve Steam ID → Game Title** dengan `find` command!

---

### 3. Ludusavi CLI Capabilities

#### `find` Command - Supports Steam ID Lookup
```bash
ludusavi find --steam-id <STEAM_ID>
```
- **Purpose:** Resolve Steam ID → Game Title
- **Precedence:** Steam ID → GOG ID → Lutris ID → exact names → normalized names
- **Output:** Game title yang match dengan Steam ID

#### `backup` Command - NO Steam ID Support
```bash
ludusavi backup <GAME_TITLE> --preview --api
```
- **Parameter:** Hanya accept **GAME TITLE** (atau custom game name dari config)
- **NO** `--steam-id` flag untuk backup command
- **Behavior:** Jika parameter bukan game title yang valid, return `unknownGames` error

---

### 4. Hydra Implementation Analysis

#### Code Evidence dari Hydra:

**File:** `src/main/services/ludusavi.ts` (line 52-85)
```typescript
public static async backupGame(
  _shop: GameShop,
  objectId: string,              // ← Pass objectId (Steam App ID)
  backupPath?: string | null,
  winePrefix?: string | null,
  preview?: boolean
): Promise<LudusaviBackup> {
  return new Promise((resolve, reject) => {
    const args = [
      "--config",
      this.configPath,
      "backup",
      objectId,                    // ← Directly pass to ludusavi!
      "--api",
      "--force",
    ];

    cp.execFile(this.binaryPath, args, (err, stdout) => {
      if (err) return reject(err);
      return resolve(JSON.parse(stdout));
    });
  });
}
```

**File:** `src/types/level.types.ts` (line 33-51)
```typescript
export interface Game {
  title: string;                  // ← Game title IS stored in database
  objectId: string;               // ← Steam App ID (for Steam games)
  shop: GameShop;
  iconUrl: string | null;
  // ... other fields
}
```

**File:** `src/renderer/src/helpers.ts` (line 33-39)
```typescript
export const buildGameDetailsPath = (
  game: { shop: GameShop; objectId: string; title: string },
  params: Record<string, string> = {}
) => {
  const searchParams = new URLSearchParams({ title: game.title, ...params });
  return `/game/${game.shop}/${game.objectId}?${searchParams.toString()}`;
  // URL: /game/steam/413150?title=Stardew%20Valley
};
```

---

### 5. The Mystery: Why Does Hydra Work?

**Hydra's Behavior:**
1. ✅ Hydra **stores both** `title` AND `objectId` in Game object
2. ✅ Hydra **pass `objectId`** to ludusavi (NOT title!)
3. ❓ **HOW does ludusavi accept Steam App ID in Hydra but not in our tests?**

**Possible Explanations:**

#### Theory 1: Custom Game Mapping (MOST LIKELY) ⭐
Hydra might auto-add custom game mappings when user first tries cloud save:

```yaml
# ludusavi config.yaml
customGames:
  - name: "413150"                # objectId as name
    files:
      - "<detected_save_path>"
    registry: []
```

**Evidence:**
- Line 102-104 di `ludusavi.ts`: Checks `customGames` dengan `name === objectId`
- Line 11 di `select-game-backup-path.ts`: Calls `Ludusavi.addCustomGame(objectId, backupPath)`

**BUT:** No code found that auto-detects and adds games to customGames on first backup!

#### Theory 2: Modified Ludusavi Binary atau Manifest
Hydra might use:
- Custom ludusavi binary with enhanced lookup
- Modified manifest with Steam ID as alternative names
- **UNLIKELY** - No evidence in code

#### Theory 3: Two-Step Process (POSSIBLE)
Hydra might:
1. First call `ludusavi find --steam-id 413150` to get "Stardew Valley"
2. Then call `ludusavi backup "Stardew Valley"`

**UNLIKELY** - No evidence of two-step process in code

---

## 🔍 CRITICAL UNANSWERED QUESTION

**Why does Hydra successfully backup with `objectId` (Steam App ID) when our direct tests fail?**

**We confirmed:**
- ✅ Hydra passes `objectId` (Steam App ID) directly to ludusavi CLI
- ✅ Ludusavi CLI fails when given Steam App ID in our tests
- ❌ **No code found** in Hydra that converts objectId → title before calling ludusavi

**Possibilities:**
1. Hydra relies on **user manually setting save path** via "Manage Files" button
2. There's **hidden logic** we haven't found yet
3. Hydra's ludusavi binary or manifest is **different** from ours

---

## 💡 PRACTICAL SOLUTIONS FOR CHAOS

Regardless of how Hydra does it, we have **3 clear solutions**:

### Solution 1: Pass Game Title Instead of objectId (RECOMMENDED) ✅

**Implementation:**
```rust
// Backend
#[tauri::command]
pub async fn get_game_backup_preview(
    game_title: String,          // ← Use title instead of object_id
    wine_prefix_path: Option<String>,
    app_handle: AppHandle,
) -> Result<LudusaviBackup, String> {
    let ludasavi = Ludasavi::new(app_handle);
    ludasavi.get_backup_preview(&game_title, wine_prefix_path.as_deref())
        .await
        .map_err(|e| e.to_string())
}
```

```typescript
// Frontend
const preview = await window.electron.getGameBackupPreview(
  game.title,                    // ← Pass game.title
  winePrefix
);
```

**Pros:**
- ✅ Leverages full ludusavi manifest database (20,000+ games)
- ✅ Auto-detect save files for all supported games
- ✅ Simple and straightforward
- ✅ No manual configuration needed

**Cons:**
- ⚠️ Needs API changes in backend + frontend
- ⚠️ Must ensure `LibraryGame` has valid `title` field

---

### Solution 2: Two-Step Lookup (ALTERNATIVE)

**Implementation:**
```rust
// Backend
pub async fn backup_game(&self, object_id: &str, shop: &str) -> Result<LudusaviBackup> {
    // Step 1: Resolve Steam ID → Title
    if shop == "steam" {
        let find_output = Command::new(&self.binary_path)
            .args(["find", "--steam-id", object_id, "--api"])
            .output()?;
        
        let find_result: FindResult = serde_json::from_slice(&find_output.stdout)?;
        let game_title = find_result.games.keys().next().ok_or("Game not found")?;
        
        // Step 2: Backup with title
        self.backup_game_by_title(game_title, ...).await
    } else {
        // For custom games, use object_id directly
        self.backup_game_by_title(object_id, ...).await
    }
}
```

**Pros:**
- ✅ No frontend changes needed
- ✅ Leverages ludusavi's Steam ID lookup
- ✅ Maintains compatibility with existing API

**Cons:**
- ⚠️ Two CLI calls per backup (slower)
- ⚠️ More complex error handling
- ⚠️ Only works for games in ludusavi manifest

---

### Solution 3: Custom Game Mapping (NOT RECOMMENDED)

Add every game to ludusavi customGames config:

```yaml
customGames:
  - name: "413150"
    files: ["<user_appdata>/StardewValley/Saves"]
```

**Pros:**
- ✅ Can use objectId directly

**Cons:**
- ❌ Must manually configure EVERY game
- ❌ Doesn't leverage ludusavi manifest
- ❌ Complex path detection logic needed
- ❌ Not scalable

---

## 🎯 RECOMMENDED IMPLEMENTATION

### **Use Solution 1: Pass Game Title**

**Step 1:** Update Rust backend to accept `game_title`
**Step 2:** Update frontend to pass `game.title` 
**Step 3:** Test with Stardew Valley
**Step 4:** Fallback to custom game mapping if title not in manifest

**Rationale:**
- Simplest and most reliable
- Leverages ludusavi's full capabilities
- Matches ludusavi's intended usage pattern

---

## 📝 NEXT STEPS

1. ✅ Document findings (DONE)
2. ⏭️ Implement Solution 1 in Chaos
3. ⏭️ Test with multiple games (Stardew Valley, Terraria, etc.)
4. ⏭️ Add fallback for games not in manifest
5. ⏭️ Update checkpoint documentation

---

## 🔬 FOR FURTHER INVESTIGATION (Optional)

To truly understand Hydra's mechanism:

1. **Run Hydra in debug mode** and capture actual CLI commands
2. **Inspect Hydra's ludusavi config.yaml** after successful backup
3. **Check if Hydra modifies ludusavi manifest** dynamically
4. **Trace Hydra's process execution** with tools like Process Monitor

**However:** This is NOT necessary for implementing working cloud save in Chaos!

---

## ✅ CONCLUSION

**Root Cause:** Ludusavi CLI requires GAME TITLE for backup, not Steam App ID.

**Solution:** Pass `game.title` instead of `game.objectId` to ludusavi commands.

**Next Action:** Implement Solution 1 with confidence! 🚀


