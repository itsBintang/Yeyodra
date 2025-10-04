# Settings Page Implementation

## Overview
Settings page implementation cloned from Hydra with simplified tabs:
1. **General** - Downloads path and Steam path configuration
2. **Download Sources** - Coming soon
3. **Account** - Coming soon

## Backend (Rust/Tauri)

### Files Created/Modified:
- `src-tauri/src/preferences.rs` - User preferences management
- `src-tauri/src/lib.rs` - Added preferences commands
- `src-tauri/Cargo.toml` - Added dependencies (winreg, shellexpand, tauri-plugin-dialog)

### Key Features:
- **Auto Steam Detection**: Automatically detects Steam installation path from Windows Registry
  - Checks `HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Valve\Steam`
  - Falls back to 32-bit path and HKEY_CURRENT_USER
  - Cross-platform support (Linux/Mac paths included)
- **JSON Persistence**: Stores preferences in `AppData/preferences.json`
- **Tauri Commands**:
  - `get_user_preferences()` - Load preferences
  - `update_user_preferences(preferences)` - Save preferences

### Data Structure:
```rust
pub struct UserPreferences {
    downloads_path: Option<String>,
    steam_path: Option<String>,
    language: Option<String>,
}
```

## Frontend (React/TypeScript)

### Files Created:
- `src/pages/Settings/Settings.tsx` - Main settings page with tab navigation
- `src/pages/Settings/Settings.scss` - Main settings styles
- `src/pages/Settings/SettingsGeneral.tsx` - General tab component
- `src/pages/Settings/SettingsGeneral.scss` - General tab styles

### Components Updated:
- `src/components/TextField/TextField.tsx` - Added `label`, `hint`, `rightContent` props
- `src/components/TextField/TextField.scss` - Updated styles for new features

### Features:
- **Tab Navigation**: Clean tab interface for switching between settings categories
- **Folder Picker**: Uses Tauri dialog plugin to select folders
- **Auto-detected Paths**: Shows Steam path with indication if auto-detected or custom
- **Real-time Updates**: Preferences saved immediately on change

### Key Props Added to TextField:
```typescript
interface TextFieldProps {
  label?: string;           // Field label
  hint?: string;            // Helper text below input
  rightContent?: ReactNode; // Button or icon on the right
}
```

## Translations

Added to `src/locales/en/translation.json`:
```json
"settings": {
  "general": "General",
  "download_sources": "Download Sources",
  "account": "Account",
  "paths": "Paths",
  "downloads_path": "Downloads path",
  "steam_path": "Steam installation path",
  "change": "Change",
  "not_set": "Not set",
  "auto_detected": "Auto-detected",
  "steam_path_custom": "Using custom Steam path",
  "steam_path_auto": "Steam path was automatically detected from Windows Registry",
  "steam_path_description": "Steam path is used to detect installed games...",
  "loading": "Loading settings..."
}
```

## SCSS Variables Added

Added to `src/scss/globals.scss`:
```scss
$h1-font-size: 32px;
$h2-font-size: 24px;
$h3-font-size: 18px;
$color-text: #ffffff;
$brand-color: $primary-color;
```

## Dependencies Added

### Rust (Cargo.toml):
```toml
shellexpand = "3.1"
tauri-plugin-dialog = "2"

[target.'cfg(windows)'.dependencies]
winreg = "0.52"
```

### NPM (package.json):
```json
"@tauri-apps/plugin-dialog": "^2.x.x"
```

## Usage

### Getting Preferences:
```typescript
import { invoke } from "@tauri-apps/api/core";
import type { UserPreferences } from "@/types";

const prefs = await invoke<UserPreferences>("get_user_preferences");
console.log(prefs.steamPath); // Auto-detected or custom path
```

### Updating Preferences:
```typescript
const updated = await invoke<UserPreferences>("update_user_preferences", {
  preferences: {
    downloadsPath: "C:/Games/Downloads",
    steamPath: "C:/Program Files (x86)/Steam"
  }
});
```

### Selecting Folders:
```typescript
import { open } from "@tauri-apps/plugin-dialog";

const selected = await open({
  directory: true,
  multiple: false,
  defaultPath: currentPath
});

if (selected) {
  // Update preference with selected path
}
```

## Next Steps

1. **Download Sources Tab**: Implement repack source management
2. **Account Tab**: User authentication and profile management
3. **More Settings**: Add language selection, theme options, etc.

## Notes

- Steam path auto-detection only works on Windows via Registry
- Preferences are stored per-user in AppData directory
- All path changes are saved immediately without confirmation
- Cross-platform compatible (Linux/Mac Steam paths included)

