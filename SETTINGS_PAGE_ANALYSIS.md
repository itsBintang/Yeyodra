# 🎛️ SETTINGS PAGE - COMPLETE ANALYSIS (HYDRA)

## **📋 OVERVIEW**

Settings page di Hydra adalah halaman kompleks dengan **7+ categories** yang manage user preferences, download sources, debrid services, themes, dan account settings. Semua settings disimpan di **LevelDB** dan di-sync ke Redux store.

---

## **🏗️ ARCHITECTURE - SETTINGS SYSTEM**

### **Frontend Structure**

```
settings.tsx (Main Container)
  ↓
SettingsContextProvider (State Management)
  ↓
├─ SettingsGeneral
├─ SettingsBehavior
├─ SettingsDownloadSources
├─ SettingsAppearance
├─ SettingsTorBox (Feature Flag)
├─ SettingsRealDebrid
├─ SettingsAllDebrid
└─ SettingsAccount (Auth Required)
```

---

## **📁 FILE STRUCTURE - HYDRA**

### **Frontend (Renderer)**
```
src/renderer/src/pages/settings/
├── settings.tsx                    # Main container with tab navigation
├── settings-general.tsx            # Downloads path, language, notifications
├── settings-behavior.tsx           # App behavior (startup, NSFW, etc)
├── settings-download-sources.tsx   # Manage repack sources
├── settings-appearance.tsx         # Theme management
├── settings-real-debrid.tsx        # Real-Debrid API integration
├── settings-all-debrid.tsx         # All-Debrid API integration
├── settings-torbox.tsx             # TorBox API integration
├── settings-account.tsx            # User account management
└── add-download-source-modal.tsx   # Modal for adding sources
```

### **Context**
```
src/renderer/src/context/settings/
└── settings.context.tsx            # Global settings state management
```

### **Backend (Main Process)**
```
src/main/events/user-preferences/
├── get-user-preferences.ts         # Fetch preferences from LevelDB
├── update-user-preferences.ts      # Update preferences + Redux sync
├── authenticate-real-debrid.ts     # OAuth flow for Real-Debrid
├── authenticate-all-debrid.ts      # OAuth flow for All-Debrid
├── authenticate-torbox.ts          # OAuth flow for TorBox
└── auto-launch.ts                  # Startup configuration
```

---

## **💾 DATA STRUCTURE**

### **UserPreferences Type (Complete)**

```typescript
export interface UserPreferences {
  // Download Settings
  downloadsPath?: string | null;              // Custom downloads folder
  
  // API Keys (Debrid Services)
  realDebridApiToken?: string | null;         // Real-Debrid authentication
  torBoxApiToken?: string | null;             // TorBox authentication
  allDebridApiKey?: string | null;            // All-Debrid authentication
  ggDealsApiKey?: string | null;              // GG.deals integration
  
  // Localization
  language?: string;                          // UI language (e.g., "en", "id")
  
  // App Behavior
  preferQuitInsteadOfHiding?: boolean;        // Close vs minimize to tray
  runAtStartup?: boolean;                     // Launch with OS
  startMinimized?: boolean;                   // Start in tray (requires runAtStartup)
  disableNsfwAlert?: boolean;                 // Skip NSFW warning modal
  enableAutoInstall?: boolean;                // Linux: Auto-install dependencies
  seedAfterDownloadComplete?: boolean;        // Continue seeding after download
  extractFilesByDefault?: boolean;            // Auto-extract compressed downloads
  enableSteamAchievements?: boolean;          // Steam achievement integration
  
  // Notifications
  downloadNotificationsEnabled?: boolean;      // Show download complete notifications
  repackUpdatesNotificationsEnabled?: boolean; // Alert when new repacks available
  achievementNotificationsEnabled?: boolean;   // Show achievement unlocks
  achievementCustomNotificationsEnabled?: boolean; // Custom overlay notifications
  achievementCustomNotificationPosition?: AchievementCustomNotificationPosition;
  friendRequestNotificationsEnabled?: boolean; // Friend request alerts
  friendStartGameNotificationsEnabled?: boolean; // Friend started playing
  
  // Display
  showHiddenAchievementsDescription?: boolean; // Show spoilers for hidden achievements
  showDownloadSpeedInMegabits?: boolean;       // Mbps vs MB/s
  showDownloadSpeedInMegabytes?: boolean;      // MB/s (takes precedence)
}

export type AchievementCustomNotificationPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
```

---

## **🔄 SETTINGS FLOW - COMPLETE**

### **1. Initial Load**

```
App Startup
  ↓
[Main Process] getUserPreferences()
  ↓
[LevelDB] Query: levelKeys.userPreferences
  ↓
[Redux] Dispatch: setUserPreferences(data)
  ↓
[Frontend] useAppSelector((state) => state.userPreferences.value)
  ↓
[UI] Render form with current values
```

### **2. Update Setting**

```
User changes a setting (e.g., toggle checkbox)
  ↓
[Frontend] handleChange({ preferQuitInsteadOfHiding: true })
  ↓
[Context] updateUserPreferences(values)
  ↓
[IPC] window.electron.updateUserPreferences(values)
  ↓
[Main Process] update-user-preferences.ts
  ├─ 1. Read current preferences from LevelDB
  ├─ 2. Merge with new values: { ...current, ...values }
  ├─ 3. Special handling:
  │   ├─ If language changed → Update i18next + sync to cloud
  │   ├─ If runAtStartup → Configure auto-launch
  │   └─ If achievementPosition → Update overlay window
  └─ 4. Write to LevelDB: db.put(levelKeys.userPreferences, merged)
  ↓
[Main Process] Fetch updated preferences
  ↓
[Redux] Dispatch: setUserPreferences(updatedData)
  ↓
[Frontend] Form updates with new values (reactive)
```

---

## **📖 DETAILED BREAKDOWN - EACH SETTINGS TAB**

### **1. ⚙️ General Settings** (`settings-general.tsx`)

**Features:**
- **Downloads Path**: Select custom folder for game downloads
- **Language**: Dropdown with all available locales (sorted alphabetically)
- **Notifications**: 
  - Download complete
  - Repack updates
  - Friend requests
  - Friend starts game
  - Achievement unlocked
  - Achievement custom overlay (with position selector)
- **Common Redist**: Install common redistributables (DirectX, VC++, etc.)

**Key Implementation:**
```typescript
const handleChooseDownloadsPath = async () => {
  const { filePaths } = await window.electron.showOpenDialog({
    defaultPath: form.downloadsPath,
    properties: ["openDirectory"],
  });

  if (filePaths && filePaths.length > 0) {
    handleChange({ downloadsPath: filePaths[0] });
  }
};

const handleLanguageChange = (event) => {
  const value = event.target.value;
  handleChange({ language: value });
  changeLanguage(value); // Update i18next immediately
};
```

**Backend Support:**
```typescript
// Main Process
if (preferences.language) {
  await db.put(levelKeys.language, preferences.language);
  i18next.changeLanguage(preferences.language);
  patchUserProfile({ language }).catch(() => {}); // Sync to cloud
}
```

---

### **2. 🎯 Behavior Settings** (`settings-behavior.tsx`)

**Features:**
- **App Behavior**:
  - Quit instead of hiding to tray
  - Run at startup (OS auto-launch)
  - Start minimized (nested under runAtStartup)
  - Auto-install dependencies (Linux only)
- **Content**:
  - Disable NSFW alert modal
- **Downloads**:
  - Seed after download complete
  - Extract files by default
  - Show download speed in MB/s vs Mbps
- **Achievements**:
  - Show hidden achievement descriptions (spoilers)
  - Enable Steam achievements integration

**Key Implementation:**
```typescript
// Nested checkbox (startMinimized only enabled if runAtStartup is true)
<CheckboxField
  label={t("launch_minimized")}
  checked={form.runAtStartup && form.startMinimized}
  disabled={!form.runAtStartup}
  onChange={() => {
    handleChange({ startMinimized: !form.startMinimized });
    window.electron.autoLaunch({
      minimized: !form.startMinimized,
      enabled: form.runAtStartup,
    });
  }}
/>
```

**Backend Auto-Launch:**
```typescript
// Main Process: auto-launch.ts
import AutoLaunch from "auto-launch";

const autoLaunch = new AutoLaunch({
  name: "Hydra",
  path: app.getPath("exe"),
});

const configureAutoLaunch = async (enabled: boolean, minimized: boolean) => {
  if (enabled) {
    const args = minimized ? ["--hidden"] : [];
    await autoLaunch.enable();
    // Set launch args...
  } else {
    await autoLaunch.disable();
  }
};
```

---

### **3. 📦 Download Sources** (`settings-download-sources.tsx`)

**Purpose**: Manage repack sources (URLs to RSS/JSON feeds containing game repacks)

**Features:**
- List all configured download sources
- Add new source (via URL or import)
- Delete source
- Manually refresh sources
- View repack count per source
- Status indicators (active/error/syncing)

**Data Structure:**
```typescript
export interface DownloadSource {
  id: number;
  name: string;              // Display name
  url: string;               // Feed URL
  repackCount: number;       // Number of repacks from this source
  status: DownloadSourceStatus; // "active" | "error" | "syncing"
  objectIds: string[];       // Game IDs covered
  downloadCount: number;     // Usage statistics
  fingerprint: string;       // Unique identifier (hash)
  etag: string | null;       // HTTP ETag for caching
  createdAt: Date;
  updatedAt: Date;
}
```

**Flow:**
```
User clicks "Add Download Source"
  ↓
[Modal] Enter URL or import JSON
  ↓
[Validate] Fetch URL and parse
  ↓
[Backend] Extract metadata:
  ├─ name: Source title
  ├─ etag: HTTP ETag
  ├─ repacks: List of GameRepack[]
  └─ fingerprint: Generate hash
  ↓
[Dexie] Save to downloadSourcesTable
  ↓
[Background] Sync repacks to repacksTable
  ↓
[UI] Update list with new source
```

---

### **4. 🎨 Appearance** (`settings-appearance.tsx`)

**Features:**
- Theme browser (custom themes from community)
- Import theme from JSON
- Export current theme
- Delete themes
- Preview themes before applying

**Theme Structure:**
```typescript
export interface Theme {
  id: string;
  name: string;
  author: string;
  primaryColor: string;
  secondaryColor: string;
  // ... more color variables
  customCss?: string; // Advanced: inject custom CSS
}
```

---

### **5. 🔐 Debrid Services**

**Real-Debrid, All-Debrid, TorBox** (3 separate tabs)

**Purpose**: Premium download services that cache torrents for instant downloads

**Features:**
- OAuth authentication flow
- Display account status (premium, expiry date)
- Check cache availability for magnets
- Disconnect account

**Authentication Flow:**
```
User clicks "Authenticate"
  ↓
[Backend] Start OAuth flow:
  ├─ Open browser with OAuth URL
  └─ Start local server to receive callback
  ↓
[OAuth Provider] User authorizes
  ↓
[Callback] http://localhost:PORT/callback?code=...
  ↓
[Backend] Exchange code for API token
  ↓
[LevelDB] Save: realDebridApiToken / allDebridApiKey
  ↓
[Redux] Update state
  ↓
[UI] Show "Connected" status
```

**Usage in Download:**
```typescript
// When user selects repack with magnet link
if (userPreferences.realDebridApiToken) {
  // Check if cached on Real-Debrid
  const cached = await checkDebridCache(magnetLink);
  
  if (cached) {
    // Get instant download link (no need to wait for torrent)
    const downloadUrl = await getDebridDownloadLink(magnetLink);
    startDownload(downloadUrl, Downloader.RealDebrid);
  }
}
```

---

### **6. 👤 Account** (`settings-account.tsx`)

**Features** (requires authentication):
- View profile info (displayName, email)
- Subscription status
- Library sync status
- Sign out

---

## **🎯 KEY PATTERNS & BEST PRACTICES**

### **1. Form State Management**

```typescript
// Local form state (for instant UI feedback)
const [form, setForm] = useState({
  preferQuitInsteadOfHiding: false,
  // ... other fields
});

// Sync from Redux on mount
useEffect(() => {
  if (userPreferences) {
    setForm({
      preferQuitInsteadOfHiding: userPreferences.preferQuitInsteadOfHiding ?? false,
      // ... with fallback defaults
    });
  }
}, [userPreferences]);

// Update handler
const handleChange = (values) => {
  setForm(prev => ({ ...prev, ...values }));  // Instant UI update
  updateUserPreferences(values);              // Persist + sync
};
```

### **2. Debouncing (Not Used in Hydra)**

Hydra updates immediately on change. For text inputs, you might want debouncing:

```typescript
import { debounce } from "lodash-es";

const debouncedUpdate = useMemo(
  () => debounce((values) => updateUserPreferences(values), 500),
  [updateUserPreferences]
);
```

### **3. Conditional Rendering**

```typescript
// Show setting only if condition met
{showRunAtStartup && (
  <CheckboxField label="Run at startup" ... />
)}

// Nested dependency
<div className={form.runAtStartup ? "enabled" : "disabled"}>
  <CheckboxField 
    disabled={!form.runAtStartup}
    ...
  />
</div>
```

### **4. Feature Flags**

```typescript
const { isFeatureEnabled, Feature } = useFeature();

const categories = [
  { label: "General" },
  { label: "Behavior" },
  ...(isFeatureEnabled(Feature.TorBox) 
    ? [{ label: "TorBox" }] 
    : []),
];
```

---

## **🔧 IMPLEMENTATION FOR CHAOS (TAURI)**

### **Backend: User Preferences Storage**

```rust
// src-tauri/src/preferences.rs

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UserPreferences {
    #[serde(rename = "downloadsPath")]
    pub downloads_path: Option<String>,
    
    pub language: Option<String>,
    
    #[serde(rename = "preferQuitInsteadOfHiding")]
    pub prefer_quit_instead_of_hiding: Option<bool>,
    
    #[serde(rename = "runAtStartup")]
    pub run_at_startup: Option<bool>,
    
    #[serde(rename = "startMinimized")]
    pub start_minimized: Option<bool>,
    
    #[serde(rename = "disableNsfwAlert")]
    pub disable_nsfw_alert: Option<bool>,
    
    #[serde(rename = "seedAfterDownloadComplete")]
    pub seed_after_download_complete: Option<bool>,
    
    #[serde(rename = "extractFilesByDefault")]
    pub extract_files_by_default: Option<bool>,
    
    #[serde(rename = "downloadNotificationsEnabled")]
    pub download_notifications_enabled: Option<bool>,
    
    #[serde(rename = "showDownloadSpeedInMegabytes")]
    pub show_download_speed_in_megabytes: Option<bool>,
}

fn get_preferences_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    Ok(app_data_dir.join("preferences.json"))
}

#[tauri::command]
pub fn get_user_preferences(app_handle: AppHandle) -> Result<UserPreferences, String> {
    let path = get_preferences_path(&app_handle)?;
    
    if !path.exists() {
        return Ok(UserPreferences::default());
    }
    
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read preferences: {}", e))?;
    
    let preferences: UserPreferences = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse preferences: {}", e))?;
    
    Ok(preferences)
}

#[tauri::command]
pub fn update_user_preferences(
    app_handle: AppHandle,
    preferences: UserPreferences,
) -> Result<UserPreferences, String> {
    let path = get_preferences_path(&app_handle)?;
    
    // Read existing preferences
    let mut current = if path.exists() {
        let contents = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read preferences: {}", e))?;
        serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse preferences: {}", e))?
    } else {
        UserPreferences::default()
    };
    
    // Merge with new values (only update non-None fields)
    if preferences.downloads_path.is_some() {
        current.downloads_path = preferences.downloads_path;
    }
    if preferences.language.is_some() {
        current.language = preferences.language;
    }
    // ... repeat for all fields
    
    // Save to file
    let json = serde_json::to_string_pretty(&current)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;
    
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write preferences: {}", e))?;
    
    Ok(current)
}
```

### **Frontend: Settings Context**

```typescript
// src/contexts/settings.tsx

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserPreferences } from "@/types";

interface SettingsContext {
  preferences: UserPreferences | null;
  updatePreferences: (values: Partial<UserPreferences>) => Promise<void>;
  currentTab: number;
  setCurrentTab: (tab: number) => void;
}

const settingsContext = createContext<SettingsContext>({
  preferences: null,
  updatePreferences: async () => {},
  currentTab: 0,
  setCurrentTab: () => {},
});

export const useSettings = () => useContext(settingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [currentTab, setCurrentTab] = useState(0);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await invoke<UserPreferences>("get_user_preferences");
      setPreferences(prefs);
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const updatePreferences = useCallback(async (values: Partial<UserPreferences>) => {
    try {
      const updated = await invoke<UserPreferences>("update_user_preferences", {
        preferences: { ...preferences, ...values },
      });
      setPreferences(updated);
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
  }, [preferences]);

  return (
    <settingsContext.Provider value={{
      preferences,
      updatePreferences,
      currentTab,
      setCurrentTab,
    }}>
      {children}
    </settingsContext.Provider>
  );
}
```

---

## **📝 TODO CHECKLIST - SETTINGS IMPLEMENTATION**

- [ ] Create UserPreferences type in types/index.ts
- [ ] Implement preferences.rs backend (get/update commands)
- [ ] Create SettingsProvider context
- [ ] Build Settings.tsx main page with tab navigation
- [ ] Implement SettingsGeneral component
- [ ] Implement SettingsBehavior component
- [ ] Add file picker for downloads path
- [ ] Add language selector with i18next integration
- [ ] Implement auto-launch with tauri-plugin-autostart
- [ ] Create CheckboxField component
- [ ] Create SelectField component
- [ ] Create TextField component with rightContent
- [ ] Add Redux slice for preferences (optional, can use Context)
- [ ] Test persistence across app restarts
- [ ] Add default values for all preferences

---

**Key Takeaways:**

1. **LevelDB → JSON file** (Tauri doesn't have LevelDB, use JSON)
2. **IPC pattern sama**: Frontend → invoke() → Rust → File I/O
3. **Form pattern**: Local state + sync to backend on change
4. **Nested dependencies**: Use disabled prop untuk conditional fields
5. **i18next integration**: Update immediately saat language change

Mari implementasi di Chaos! 🚀

