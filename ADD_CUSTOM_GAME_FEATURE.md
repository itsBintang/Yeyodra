# Add Custom Game Feature - Implementation Complete

## Overview
Implemented the ability to add custom games (external/non-catalogue games) to the user's library through the `+` button in the sidebar, following Hydra's implementation pattern.

## Features
- ✅ Add custom games with executable path
- ✅ Auto-generate unique ID for custom games  
- ✅ Auto-fill game name from executable filename
- ✅ Prevent duplicate executables
- ✅ Navigate to game details after adding
- ✅ Full i18n support (English & Indonesian)

## Implementation Details

### Frontend

#### 1. AddCustomGameModal Component
**Location:** `src/components/AddCustomGameModal/AddCustomGameModal.tsx`

**Features:**
- File picker dialog for selecting game executable
- Auto-fill game title from filename
- Form validation
- Loading states during add operation
- Toast notifications for success/error
- Navigate to game details page after successful addition

**Key Functions:**
```typescript
handleSelectExecutable() // Opens file dialog for .exe/.lnk files
handleAddGame()         // Invokes Rust command to add game
handleClose()           // Resets form and closes modal
```

#### 2. Sidebar Integration
**Location:** `src/components/Sidebar/Sidebar.tsx`

**Changes:**
- Added `showAddGameModal` state
- Wired up `+` button click handler
- Imported and rendered `AddCustomGameModal`

```tsx
const [showAddGameModal, setShowAddGameModal] = useState(false);

const handleAddGameButtonClick = () => {
  setShowAddGameModal(true);
};

<AddCustomGameModal
  visible={showAddGameModal}
  onClose={handleCloseAddGameModal}
/>
```

#### 3. Component Export
**Location:** `src/components/index.ts`

Added export for the new modal component.

### Backend (Rust)

#### 1. Add Custom Game Function
**Location:** `src-tauri/src/library.rs`

**Function:** `add_custom_game_to_library()`

**Features:**
- Generates unique UUID for game ID
- Sets shop as "custom"
- Checks for duplicate executable paths
- Creates LibraryGame with executable pre-set
- Marks game as "installed" by default
- Saves game to library JSON file

**Key Logic:**
```rust
pub fn add_custom_game_to_library(
    app_handle: &AppHandle,
    title: String,
    executable_path: String,
) -> Result<LibraryGame, String> {
    let shop = "custom".to_string();
    let object_id = uuid::Uuid::new_v4().to_string();
    
    // Check for duplicates
    let all_games = get_all_library_games(app_handle)?;
    if let Some(existing) = all_games.iter().find(|g| {
        g.executable_path.as_ref() == Some(&executable_path) && !g.is_deleted
    }) {
        return Err(...);
    }
    
    // Create game with executable path
    let game = LibraryGame {
        id,
        title,
        object_id,
        shop,
        executable_path: Some(executable_path),
        is_installed: Some(true),
        ...
    };
    
    // Save to file
    std::fs::write(&game_path, json)?;
    Ok(game)
}
```

#### 2. Tauri Command Registration
**Location:** `src-tauri/src/lib.rs`

**Changes:**
- Imported `add_custom_game_to_library` function
- Created `#[tauri::command]` wrapper
- Registered in `invoke_handler!` macro

```rust
use library::{..., add_custom_game_to_library as add_custom_to_lib, ...};

#[tauri::command]
fn add_custom_game_to_library(
    app_handle: tauri::AppHandle,
    title: String,
    executable_path: String,
) -> Result<LibraryGame, String> {
    add_custom_to_lib(&app_handle, title, executable_path)
}

// In Builder
.invoke_handler(tauri::generate_handler![
    ...
    add_custom_game_to_library,
    ...
])
```

### Translations

#### English (`src/locales/en/translation.json`)
```json
"sidebar": {
  "add_custom_game_tooltip": "Add custom game",
  ...
},
"add_custom_game": {
  "title": "Add Custom Game",
  "description": "Add a game that's not in the catalogue to your library",
  "executable_path": "Executable Path",
  "select_executable": "Select game executable...",
  "browse": "Browse",
  "game_title": "Game Title",
  "enter_title": "Enter game title...",
  "cancel": "Cancel",
  "add": "Add Game",
  "adding": "Adding...",
  "fill_required": "Please fill in all required fields",
  "success": "Custom game added successfully",
  "failed": "Failed to add custom game"
}
```

#### Indonesian (`src/locales/id/translation.json`)
Similar structure with Indonesian translations.

## How It Works

### User Flow
1. User clicks `+` button in "MY LIBRARY" section of sidebar
2. Modal opens with two fields:
   - **Executable Path** (read-only, with Browse button)
   - **Game Title** (editable)
3. User clicks "Browse" and selects game executable
4. Game title auto-fills from filename (can be edited)
5. User clicks "Add Game"
6. Backend creates game with unique ID
7. Game is added to library with "custom" shop
8. Frontend navigates to game details page
9. Success toast notification shows

### Validation
- Both fields must be filled
- Executable must not already exist in library
- Shows error toast if duplicate detected

## Comparison with Hydra

### Similarities ✅
- Modal-based interface
- File picker for executable selection
- Auto-fill game name from filename
- Duplicate detection
- Navigate to game details after adding
- UUID generation for custom games
- Shop field set to "custom"

### Differences
- **Hydra:** Supports custom images (icon, logo, hero)
- **Chaos:** Uses no images initially (can be customized later via Edit Game modal)
- **Hydra:** Uses Level.js database
- **Chaos:** Uses JSON file storage
- **Hydra:** Generates gradient backgrounds
- **Chaos:** No default images (cleaner approach)

## Technical Decisions

### Why No Default Images?
Unlike Hydra which generates random gradient backgrounds, we decided to:
- Keep custom games simple initially
- Allow users to customize images later through Edit Game modal
- Reduce initial complexity
- Avoid unnecessary gradient generation

### File Storage
- Custom games stored as JSON files in library directory
- Filename format: `custom_{uuid}.json`
- Example: `custom_a1b2c3d4-e5f6-7890-abcd-ef1234567890.json`

### Shop Field
- All custom games have `shop: "custom"`
- This allows filtering and special handling
- Compatible with existing game details system

## Files Modified

### Frontend
1. `src/components/AddCustomGameModal/AddCustomGameModal.tsx` - NEW
2. `src/components/AddCustomGameModal/AddCustomGameModal.scss` - NEW
3. `src/components/index.ts` - Added export
4. `src/components/Sidebar/Sidebar.tsx` - Added modal state and handler
5. `src/locales/en/translation.json` - Added translations
6. `src/locales/id/translation.json` - Added translations

### Backend
1. `src-tauri/src/library.rs` - Added `add_custom_game_to_library()` function
2. `src-tauri/src/lib.rs` - Added command registration

### Dependencies
- ✅ All required dependencies already present:
  - `uuid` (with v4 feature) - Already in Cargo.toml
  - `@tauri-apps/plugin-dialog` - Already in package.json
  - `@primer/octicons-react` - Already in package.json

## Testing Checklist

- [ ] Click `+` button opens modal
- [ ] Browse button opens file picker
- [ ] Selecting executable auto-fills game title
- [ ] Can edit game title after auto-fill
- [ ] Form validation works (both fields required)
- [ ] Adding game creates JSON file in library directory
- [ ] Navigates to game details page after adding
- [ ] Success toast appears
- [ ] Duplicate executable shows error
- [ ] Game appears in sidebar library list
- [ ] Can launch custom game from details page
- [ ] Can edit/remove custom game through options modal
- [ ] Custom games persist after app restart
- [ ] i18n works for both English and Indonesian

## Known Limitations

1. **No Custom Images on Creation**
   - Users must add images later through Edit Game modal
   - Could be enhanced to support image upload during creation

2. **Windows Only** (by design)
   - File picker filters only .exe and .lnk files
   - Could be expanded for Linux (.desktop, binaries) and macOS (.app)

3. **No Metadata**
   - Custom games don't have genres, developers, descriptions, etc.
   - This is by design - external games don't need catalogue metadata

## Future Enhancements

Possible improvements:
- [ ] Support image upload during creation
- [ ] Import game metadata from Steam/IGDB API if available
- [ ] Batch import multiple games
- [ ] Import from other launchers (Steam, Epic, GOG)
- [ ] Auto-detect installed games
- [ ] Custom game categories/tags

## Conclusion

The custom game feature is fully implemented and functional, closely following Hydra's pattern while keeping it simple and maintainable. Users can now add any external game to their library with just the executable path and title.

