# 🐛 LIBRARY BUGS FIXED - Complete Report

## **Issues Found & Fixed**

### **1. ❌ CRITICAL: Wrong Conditional Rendering Logic**

**Problem:**
```typescript
// BEFORE (WRONG):
return (
  <div>
    {!game ? <AddButton /> : <DownloadButton />}
    {/* These were ALWAYS showing, even when game not in library! */}
    <FavoriteButton />
    <PinButton />
    <OptionsButton />
  </div>
);
```

**Impact:**
- User melihat button Favorite/Pin/Options bahkan untuk game yang belum ada di library
- Tidak konsisten dengan Hydra behavior
- Confusing UX

**Solution:**
```typescript
// AFTER (CORRECT):
// If NOT in library: Show ONLY "Add to Library" button
if (!game) {
  return <AddToLibraryButton />;
}

// If IN library: Show all action buttons
return (
  <div>
    <DownloadButton />
    <Separator />
    <FavoriteButton />
    <PinButton />
    <OptionsButton />
  </div>
);
```

---

### **2. ❌ CRITICAL: Field Name Mismatch (snake_case vs camelCase)**

**Problem:**
```rust
// Rust serializes as snake_case by default:
pub struct LibraryGame {
    pub object_id: String,    // Becomes "object_id" in JSON
    pub icon_url: Option<String>,  // Becomes "icon_url" in JSON
}
```

```typescript
// TypeScript expects camelCase:
interface LibraryGame {
  objectId: string;  // ❌ Can't find "objectId"
  iconUrl: string;   // ❌ Can't find "iconUrl"
}
```

**Impact:**
- **Images tidak muncul di sidebar** karena `iconUrl` = null
- Parse error saat membaca file JSON lama
- Game bisa di-add tapi data tidak lengkap

**Solution:**
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryGame {
    // Use BOTH camelCase (for new) AND snake_case (for old compatibility)
    #[serde(rename = "objectId", alias = "object_id")]
    pub object_id: String,
    
    #[serde(rename = "iconUrl", alias = "icon_url")]
    pub icon_url: Option<String>,
    
    #[serde(rename = "libraryHeroImageUrl", alias = "library_hero_image_url")]
    pub library_hero_image_url: Option<String>,
    
    // ... all other fields with rename + alias
}
```

**Why `alias`?**
- `rename = "objectId"` → **Serialize** (write) menggunakan camelCase
- `alias = "object_id"` → **Deserialize** (read) bisa baca format lama snake_case
- Backward compatible dengan file JSON yang sudah ada

---

### **3. 🔧 Enhancement: Better State Management**

**Added:**
- Dynamic icon state: `game.favorite ? <HeartFillIcon /> : <HeartIcon />`
- Dynamic pin state: `game.isPinned ? <PinSlashIcon /> : <PinIcon />`
- Disabled state for all buttons while operation in progress
- Console logging untuk debugging

---

## **How to Test**

### **Step 1: Clean Old Library Data (if needed)**
```powershell
# Delete old library files with wrong format
Remove-Item "$env:APPDATA\Chaos\library\*.json" -Force
Remove-Item "$env:APPDATA\Chaos\shop_assets\*.json" -Force
```

### **Step 2: Rebuild & Run**
```bash
npm run tauri dev
```

### **Step 3: Test Flow**
1. Go to Catalogue/Home
2. Click on a game → Opens Game Details
3. ✅ Should see ONLY "Add to Library" button
4. Click "Add to Library"
5. Console should show:
   ```
   [AddToLibrary] Adding game: { shop: "steam", objectId: "123", title: "..." }
   [AddToLibrary] Game added successfully: { id: "steam_123", ... }
   [GameDetails] Library game fetched: { id: "steam_123", iconUrl: "https://...", ... }
   [AddToLibrary] State updated successfully
   ```
6. ✅ Button should change to Download/Favorite/Pin/Options
7. ✅ Sidebar should update with game + icon

### **Step 4: Verify Sidebar**
1. Check "MY LIBRARY" section in sidebar
2. ✅ Game should appear with icon image
3. ✅ Click game → navigates to game details
4. ✅ Active state should highlight

### **Step 5: Verify Persistence**
1. Close app
2. Reopen app
3. ✅ Game should still be in library
4. ✅ Icon should still show

---

## **Files Changed**

1. `src/components/HeroPanel/HeroPanelActions.tsx`
   - Fixed conditional rendering logic
   - Added dynamic icon states
   - Added debug logging

2. `src-tauri/src/library.rs`
   - Added `#[serde(rename = "...", alias = "...")]` to all fields
   - Ensures camelCase output with snake_case backward compatibility

3. `src/contexts/game-details.tsx`
   - Added debug logging for game fetch

---

## **Expected Behavior (Like Hydra)**

### **State 1: Game NOT in Library**
```
┌────────────────────────┐
│  [➕ Add to Library]   │
└────────────────────────┘
```

### **State 2: Game IN Library (not downloaded)**
```
┌──────────────────────────────────────────┐
│  [⬇ Download] | [♥] [📌] [⚙ Options]   │
└──────────────────────────────────────────┘
```

### **State 3: Game IN Library (downloaded, has .exe)**
```
┌──────────────────────────────────────────┐
│  [▶ Play] | [♥] [📌] [⚙ Options]        │
└──────────────────────────────────────────┘
```

### **State 4: Game Running**
```
┌──────────────────────────────────────────┐
│  [⏹ Close] | [♥] [📌] [⚙ Options]       │
└──────────────────────────────────────────┘
```

---

## **Common Issues & Solutions**

### **Issue: "Images still not showing in sidebar"**
**Solution:**
```powershell
# 1. Check if assets are saved
ls "$env:APPDATA\Chaos\shop_assets\"

# 2. Check file content
cat "$env:APPDATA\Chaos\shop_assets\steam_123.json"

# 3. Verify iconUrl exists
# Should see: "iconUrl": "https://..."

# 4. If missing, delete and re-add game
Remove-Item "$env:APPDATA\Chaos\library\steam_123.json"
# Then re-add from game details
```

### **Issue: "Parse error when reading old library files"**
**Solution:**
The `alias` attribute should fix this. But if still failing:
```powershell
# Nuclear option: Start fresh
Remove-Item "$env:APPDATA\Chaos\library\*" -Recurse -Force
Remove-Item "$env:APPDATA\Chaos\shop_assets\*" -Recurse -Force
```

### **Issue: "Button doesn't change after adding to library"**
**Solution:**
```typescript
// Make sure both updateGame() and updateLibrary() are called
await Promise.all([
  updateGame(),      // Updates local game state
  updateLibrary(),   // Updates Redux global state
]);
```

---

## **Architecture Overview**

```
User clicks "Add to Library"
  ↓
[Frontend] HeroPanelActions.handleAddToLibrary()
  ↓
[Tauri IPC] invoke("add_game_to_library", { shop, objectId, title })
  ↓
[Rust Backend] add_game_to_library()
  ├─ Check if game exists (restore if deleted)
  ├─ Get assets from shop_assets/
  ├─ Create LibraryGame with camelCase serialization
  └─ Save to library/{shop}_{objectId}.json
  ↓
[Frontend] updateGame() + updateLibrary()
  ├─ Fetch from get_library_game (local state)
  └─ Fetch from get_library_games (Redux state)
  ↓
[UI] Re-render with new state
  ├─ HeroPanelActions shows new buttons
  └─ Sidebar shows game with icon
```

---

## **Testing Checklist**

- [ ] Can add game to library from game details
- [ ] Button changes from "Add to Library" → "Download/etc" after adding
- [ ] Game appears in sidebar with icon
- [ ] Icon image loads correctly
- [ ] Clicking sidebar item navigates to game details
- [ ] Active state highlights in sidebar
- [ ] Game persists after app restart
- [ ] Can favorite/unfavorite (UI state changes)
- [ ] Can pin/unpin (UI state changes)
- [ ] Console shows proper debug logs
- [ ] No parse errors in console

---

## **Next Steps**

1. ✅ Add to library - DONE
2. ⏳ Implement favorite toggle
3. ⏳ Implement pin toggle
4. ⏳ Implement options modal
5. ⏳ Implement download system
6. ⏳ Implement play game functionality

---

**Debug Tips:**

Check console for logs:
```javascript
[AddToLibrary] Adding game: ...
[AddToLibrary] Game added successfully: ...
[GameDetails] Library game fetched: ...
[AddToLibrary] State updated successfully
```

Check file system:
```powershell
# Library games
ls "$env:APPDATA\Chaos\library\"

# Shop assets (images)
ls "$env:APPDATA\Chaos\shop_assets\"

# View game data
cat "$env:APPDATA\Chaos\library\steam_123.json" | ConvertFrom-Json | Format-List
```

