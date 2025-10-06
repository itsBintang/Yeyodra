# Behavior Tab - System Startup Implementation Analysis

## Overview
Analisis fundamental dari implementasi fitur "Launch on system start-up" di halaman Settings tab Behavior, berdasarkan referensi Hydra dan kebutuhan Chaos Launcher.

---

## 📋 Fitur yang Akan Diimplementasi

### Tab Behavior - System Startup Section
Berdasarkan gambar UI yang diberikan dan referensi Hydra:

```
☐ Don't hide Hydra when closing
☐ Launch Hydra on system start-up
  ☐ Launch Hydra minimized          (nested, disabled if parent unchecked)
☐ Disable NSFW alert
☐ Seed after download complete
☐ Show hidden achievements description before unlocking them
☐ Show download speed in megabytes per second
☑ Extract files by default after download
☐ Enable search for Steam achievements
```

---

## 🎯 Focus: Launch on System Start-up

### Frontend Requirements

#### 1. **UI Components**
- **Parent Checkbox**: "Launch Hydra on system start-up"
  - Controls autostart functionality
  - Calls backend command to enable/disable autostart
  
- **Nested Checkbox**: "Launch Hydra minimized"
  - Only enabled when parent is checked
  - Determines if app starts in system tray or visible window
  - Nested indentation untuk visual hierarchy

#### 2. **State Management**
```typescript
// User preferences state
interface UserPreferences {
  runAtStartup?: boolean;        // Enable/disable autostart
  startMinimized?: boolean;      // Start in tray vs normal window
}
```

#### 3. **Component Structure**
```typescript
// SettingsBehavior.tsx
export function SettingsBehavior() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  
  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);
  
  const loadPreferences = async () => {
    const prefs = await invoke<UserPreferences>("get_user_preferences");
    setPreferences(prefs);
  };
  
  const handleRunAtStartup = async (enabled: boolean) => {
    // Update backend preferences
    await invoke("update_user_preferences", {
      preferences: { runAtStartup: enabled }
    });
    
    // Configure OS autostart
    await invoke("configure_autostart", { 
      enabled, 
      minimized: preferences?.startMinimized ?? false 
    });
    
    setPreferences(prev => ({ ...prev, runAtStartup: enabled }));
  };
  
  const handleStartMinimized = async (minimized: boolean) => {
    await invoke("update_user_preferences", {
      preferences: { startMinimized: minimized }
    });
    
    // Reconfigure autostart with new minimized setting
    await invoke("configure_autostart", { 
      enabled: preferences?.runAtStartup ?? false, 
      minimized 
    });
    
    setPreferences(prev => ({ ...prev, startMinimized: minimized }));
  };
  
  return (
    <div className="settings-behavior">
      <CheckboxField
        label="Launch Hydra on system start-up"
        checked={preferences?.runAtStartup ?? false}
        onChange={handleRunAtStartup}
      />
      
      {/* Nested checkbox with indentation */}
      <div className="settings-behavior__nested">
        <CheckboxField
          label="Launch Hydra minimized"
          checked={preferences?.runAtStartup && preferences?.startMinimized}
          disabled={!preferences?.runAtStartup}
          onChange={handleStartMinimized}
        />
      </div>
    </div>
  );
}
```

#### 4. **SCSS Styling**
```scss
.settings-behavior {
  &__nested {
    margin-left: 2rem; // Indentation untuk nested checkbox
    opacity: 0.7;
    
    // Highlight when parent is active
    &:has(input:not(:disabled)) {
      opacity: 1;
    }
  }
}
```

---

## 🔧 Backend Requirements (Rust/Tauri)

### 1. **UserPreferences Struct Extension**

**File**: `src-tauri/src/preferences.rs`

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserPreferences {
    #[serde(rename = "downloadsPath", skip_serializing_if = "Option::is_none")]
    pub downloads_path: Option<String>,
    
    #[serde(rename = "steamPath", skip_serializing_if = "Option::is_none")]
    pub steam_path: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    
    #[serde(rename = "steamtoolsEnabled", default = "default_true")]
    pub steamtools_enabled: bool,
    
    // NEW: Behavior settings
    #[serde(rename = "runAtStartup", default)]
    pub run_at_startup: bool,
    
    #[serde(rename = "startMinimized", default)]
    pub start_minimized: bool,
    
    #[serde(rename = "preferQuitInsteadOfHiding", default)]
    pub prefer_quit_instead_of_hiding: bool,
    
    #[serde(rename = "disableNsfwAlert", default)]
    pub disable_nsfw_alert: bool,
    
    #[serde(rename = "seedAfterDownloadComplete", default)]
    pub seed_after_download_complete: bool,
    
    #[serde(rename = "extractFilesByDefault", default = "default_true")]
    pub extract_files_by_default: bool,
    
    #[serde(rename = "showDownloadSpeedInMegabytes", default)]
    pub show_download_speed_in_megabytes: bool,
    
    #[serde(rename = "enableSteamAchievements", default)]
    pub enable_steam_achievements: bool,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            downloads_path: None,
            steam_path: detect_steam_path(),
            language: Some("en".to_string()),
            steamtools_enabled: true,
            run_at_startup: false,
            start_minimized: false,
            prefer_quit_instead_of_hiding: false,
            disable_nsfw_alert: false,
            seed_after_download_complete: false,
            extract_files_by_default: true,  // Default enabled
            show_download_speed_in_megabytes: false,
            enable_steam_achievements: false,
        }
    }
}
```

### 2. **Autostart Module**

**File**: `src-tauri/src/autostart.rs` (NEW FILE)

```rust
use tauri::AppHandle;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

/// Configure application to run on system startup
/// 
/// On Windows: Uses Registry (HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run)
/// On Linux: Creates .desktop file in ~/.config/autostart/
/// On macOS: Creates LaunchAgent plist in ~/Library/LaunchAgents/
pub fn configure_autostart(
    app_handle: &AppHandle,
    enabled: bool,
    minimized: bool,
) -> Result<(), String> {
    let app_name = "Chaos Launcher";
    
    #[cfg(target_os = "windows")]
    {
        configure_autostart_windows(app_name, enabled, minimized)
    }
    
    #[cfg(target_os = "linux")]
    {
        configure_autostart_linux(app_handle, app_name, enabled, minimized)
    }
    
    #[cfg(target_os = "macos")]
    {
        configure_autostart_macos(app_handle, app_name, enabled, minimized)
    }
}

#[cfg(target_os = "windows")]
fn configure_autostart_windows(
    app_name: &str,
    enabled: bool,
    minimized: bool,
) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = hkcu
        .open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_ALL_ACCESS,
        )
        .map_err(|e| format!("Failed to open Run registry key: {}", e))?;
    
    if enabled {
        // Get current executable path
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        
        // Build command with optional --hidden flag
        let mut command = format!("\"{}\"", exe_path.display());
        if minimized {
            command.push_str(" --hidden");
        }
        
        // Set registry value
        run_key
            .set_value(app_name, &command)
            .map_err(|e| format!("Failed to set registry value: {}", e))?;
        
        println!("✓ Autostart enabled (minimized: {})", minimized);
    } else {
        // Remove from startup
        match run_key.delete_value(app_name) {
            Ok(_) => println!("✓ Autostart disabled"),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // Key doesn't exist, that's fine
                println!("✓ Autostart was already disabled");
            }
            Err(e) => return Err(format!("Failed to remove autostart: {}", e)),
        }
    }
    
    Ok(())
}

#[cfg(target_os = "linux")]
fn configure_autostart_linux(
    app_handle: &AppHandle,
    app_name: &str,
    enabled: bool,
    minimized: bool,
) -> Result<(), String> {
    let home_dir = std::env::var("HOME")
        .map_err(|_| "Failed to get HOME directory".to_string())?;
    
    let autostart_dir = PathBuf::from(&home_dir)
        .join(".config")
        .join("autostart");
    
    let desktop_file = autostart_dir.join(format!("{}.desktop", app_name.replace(" ", "-").to_lowercase()));
    
    if enabled {
        // Create autostart directory if it doesn't exist
        std::fs::create_dir_all(&autostart_dir)
            .map_err(|e| format!("Failed to create autostart directory: {}", e))?;
        
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        
        let mut exec_command = exe_path.display().to_string();
        if minimized {
            exec_command.push_str(" --hidden");
        }
        
        // Create .desktop file
        let desktop_content = format!(
            "[Desktop Entry]\n\
             Type=Application\n\
             Name={}\n\
             Exec={}\n\
             Terminal=false\n\
             X-GNOME-Autostart-enabled=true\n",
            app_name, exec_command
        );
        
        std::fs::write(&desktop_file, desktop_content)
            .map_err(|e| format!("Failed to write desktop file: {}", e))?;
        
        println!("✓ Autostart enabled (minimized: {})", minimized);
    } else {
        // Remove desktop file
        if desktop_file.exists() {
            std::fs::remove_file(&desktop_file)
                .map_err(|e| format!("Failed to remove desktop file: {}", e))?;
            println!("✓ Autostart disabled");
        }
    }
    
    Ok(())
}

#[cfg(target_os = "macos")]
fn configure_autostart_macos(
    app_handle: &AppHandle,
    app_name: &str,
    enabled: bool,
    minimized: bool,
) -> Result<(), String> {
    let home_dir = std::env::var("HOME")
        .map_err(|_| "Failed to get HOME directory".to_string())?;
    
    let launch_agents_dir = PathBuf::from(&home_dir)
        .join("Library")
        .join("LaunchAgents");
    
    let plist_name = format!("com.{}.plist", app_name.replace(" ", "").to_lowercase());
    let plist_file = launch_agents_dir.join(&plist_name);
    
    if enabled {
        // Create LaunchAgents directory if it doesn't exist
        std::fs::create_dir_all(&launch_agents_dir)
            .map_err(|e| format!("Failed to create LaunchAgents directory: {}", e))?;
        
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        
        let args = if minimized {
            format!("<string>--hidden</string>")
        } else {
            String::new()
        };
        
        // Create plist file
        let plist_content = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
             <plist version=\"1.0\">\n\
             <dict>\n\
                 <key>Label</key>\n\
                 <string>{}</string>\n\
                 <key>ProgramArguments</key>\n\
                 <array>\n\
                     <string>{}</string>\n\
                     {}\n\
                 </array>\n\
                 <key>RunAtLoad</key>\n\
                 <true/>\n\
             </dict>\n\
             </plist>\n",
            plist_name.trim_end_matches(".plist"),
            exe_path.display(),
            args
        );
        
        std::fs::write(&plist_file, plist_content)
            .map_err(|e| format!("Failed to write plist file: {}", e))?;
        
        println!("✓ Autostart enabled (minimized: {})", minimized);
    } else {
        // Remove plist file
        if plist_file.exists() {
            std::fs::remove_file(&plist_file)
                .map_err(|e| format!("Failed to remove plist file: {}", e))?;
            println!("✓ Autostart disabled");
        }
    }
    
    Ok(())
}

/// Check if autostart is currently enabled
pub fn is_autostart_enabled() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let app_name = "Chaos Launcher";
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags(
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                KEY_READ,
            )
            .map_err(|e| format!("Failed to open Run registry key: {}", e))?;
        
        match run_key.get_value::<String, _>(app_name) {
            Ok(_) => Ok(true),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(format!("Failed to read registry: {}", e)),
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // Linux/macOS implementation
        Ok(false)
    }
}
```

### 3. **Tauri Commands**

**File**: `src-tauri/src/lib.rs`

```rust
use crate::autostart;

#[tauri::command]
fn configure_autostart(
    app_handle: AppHandle,
    enabled: bool,
    minimized: bool,
) -> Result<(), String> {
    autostart::configure_autostart(&app_handle, enabled, minimized)
}

#[tauri::command]
fn is_autostart_enabled() -> Result<bool, String> {
    autostart::is_autostart_enabled()
}

// In tauri::Builder::default()
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    configure_autostart,
    is_autostart_enabled,
])
```

### 4. **Handle --hidden Flag on Startup**

**File**: `src-tauri/src/main.rs`

```rust
fn main() {
    // Check if launched with --hidden flag
    let args: Vec<String> = std::env::args().collect();
    let start_minimized = args.contains(&"--hidden".to_string());
    
    chaos_lib::run();
}
```

**File**: `src-tauri/src/lib.rs` (dalam setup function)

```rust
.setup(|app| {
    // Check if started with --hidden flag
    let args: Vec<String> = std::env::args().collect();
    let start_minimized = args.contains(&"--hidden".to_string());
    
    if start_minimized {
        // Hide window on startup
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
    }
    
    // Initialize app state
    if let Err(e) = setup::initialize_app(app.handle()) {
        eprintln!("Failed to initialize app: {}", e);
    }
    
    Ok(())
})
```

### 5. **Update preferences.rs merge logic**

**File**: `src-tauri/src/preferences.rs`

```rust
pub fn update_user_preferences(
    app_handle: &AppHandle,
    updates: UserPreferences,
) -> Result<UserPreferences, String> {
    let path = get_preferences_path(app_handle)?;
    
    // Read existing preferences
    let mut current = if path.exists() {
        let contents = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read preferences: {}", e))?;
        serde_json::from_str(&contents)
            .unwrap_or_else(|_| UserPreferences::default())
    } else {
        UserPreferences::default()
    };
    
    // Merge with new values
    if updates.downloads_path.is_some() {
        current.downloads_path = updates.downloads_path;
    }
    if updates.steam_path.is_some() {
        current.steam_path = updates.steam_path;
    }
    if updates.language.is_some() {
        current.language = updates.language;
    }
    
    // Boolean fields - always update (can't use is_some for bool)
    // We need to track which fields were actually sent by the frontend
    // For now, we'll update all boolean fields
    current.steamtools_enabled = updates.steamtools_enabled;
    current.run_at_startup = updates.run_at_startup;
    current.start_minimized = updates.start_minimized;
    current.prefer_quit_instead_of_hiding = updates.prefer_quit_instead_of_hiding;
    current.disable_nsfw_alert = updates.disable_nsfw_alert;
    current.seed_after_download_complete = updates.seed_after_download_complete;
    current.extract_files_by_default = updates.extract_files_by_default;
    current.show_download_speed_in_megabytes = updates.show_download_speed_in_megabytes;
    current.enable_steam_achievements = updates.enable_steam_achievements;
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create preferences directory: {}", e))?;
    }
    
    // Save to file
    let json = serde_json::to_string_pretty(&current)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;
    
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write preferences: {}", e))?;
    
    Ok(current)
}
```

---

## 🔄 Flow Diagram

### User Enables Autostart

```
User clicks checkbox "Launch on system start-up"
    ↓
[Frontend] SettingsBehavior.tsx
    ↓
handleRunAtStartup(true)
    ↓
[Invoke] update_user_preferences({ runAtStartup: true })
    ↓
[Backend] preferences.rs → Save to preferences.json
    ↓
[Invoke] configure_autostart({ enabled: true, minimized: false })
    ↓
[Backend] autostart.rs → Write to Windows Registry
    HKCU\Software\Microsoft\Windows\CurrentVersion\Run
    Value: "Chaos Launcher" = "C:\Path\To\Chaos.exe"
    ↓
[Success] User sees checkbox checked
    ↓
Next Windows startup: Chaos launches automatically
```

### User Enables "Start Minimized"

```
User clicks nested checkbox "Launch minimized"
    ↓
[Check] Is parent checkbox enabled? (runAtStartup must be true)
    ↓
[Frontend] handleStartMinimized(true)
    ↓
[Invoke] update_user_preferences({ startMinimized: true })
    ↓
[Backend] Save to preferences.json
    ↓
[Invoke] configure_autostart({ enabled: true, minimized: true })
    ↓
[Backend] Update Registry with --hidden flag
    Value: "Chaos Launcher" = "C:\Path\To\Chaos.exe --hidden"
    ↓
[Success] Both checkboxes checked
    ↓
Next Windows startup: Chaos launches hidden to system tray
```

---

## 📦 Dependencies to Add

### Cargo.toml
```toml
[dependencies]
# Already exists
winreg = "0.52"  # Windows Registry access
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = ["tray-icon"] }

# No new dependencies needed for autostart
```

### package.json
```json
{
  "dependencies": {
    // Already exists from Settings implementation
    "@tauri-apps/api": "^2.x.x",
    "@tauri-apps/plugin-dialog": "^2.x.x"
  }
}
```

---

## 🎨 UI/UX Considerations

### 1. **Visual Hierarchy**
- Parent checkbox at default indentation
- Nested checkbox indented 2rem (32px) to show dependency
- Nested checkbox disabled (grayed out) when parent unchecked

### 2. **User Feedback**
- Toast notification on successful configuration:
  - "Autostart enabled. Chaos will launch on next system startup."
  - "Autostart disabled."
- Error handling for registry permission issues

### 3. **State Persistence**
- Preferences saved to JSON immediately
- Registry updated atomically
- Checkbox state reflects actual system configuration

### 4. **Edge Cases**
- If registry write fails, revert checkbox state
- Show error message if insufficient permissions
- Detect manual registry changes (optional)

---

## 🧪 Testing Checklist

### Frontend Tests
- [ ] Checkbox toggles correctly
- [ ] Nested checkbox only enabled when parent checked
- [ ] Nested checkbox automatically unchecks when parent unchecked
- [ ] State persists across page navigation
- [ ] Loading state displays correctly

### Backend Tests
- [ ] Registry key created correctly
- [ ] Registry key removed on disable
- [ ] --hidden flag added correctly when minimized enabled
- [ ] Preferences.json updated correctly
- [ ] Cross-platform paths work (Linux/macOS)

### Integration Tests
- [ ] Enable autostart → Restart Windows → App launches
- [ ] Enable minimized → Restart → App launches hidden
- [ ] Disable autostart → Restart → App doesn't launch
- [ ] Change minimized while enabled → Registry updates correctly
- [ ] Uninstall app → Registry key cleaned up (optional)

### Manual Testing
1. Enable autostart → Check Registry Editor
2. Restart Windows → Verify app launches
3. Enable minimized → Restart → Verify app in system tray
4. Disable autostart → Restart → Verify app doesn't launch

---

## 🔐 Security Considerations

### 1. **Registry Permissions**
- Write to `HKEY_CURRENT_USER` (no admin required)
- Don't write to `HKEY_LOCAL_MACHINE` (requires elevation)

### 2. **Executable Path**
- Use `std::env::current_exe()` for accurate path
- Quote path in registry (handles spaces in path)
- Validate exe exists before writing

### 3. **Malware Concerns**
- Clearly label feature in UI
- Easy to disable
- Standard Windows autostart mechanism (not hidden)

---

## 📁 File Structure Summary

```
src/
  pages/
    Settings/
      Settings.tsx              # Tab navigation (existing)
      SettingsGeneral.tsx       # General tab (existing)
      SettingsBehavior.tsx      # NEW: Behavior tab
      SettingsBehavior.scss     # NEW: Behavior styles
      SettingsDownloadSources.tsx  # Download sources tab (existing)
      
src-tauri/
  src/
    preferences.rs              # MODIFIED: Add behavior fields
    autostart.rs                # NEW: Autostart logic
    lib.rs                      # MODIFIED: Add autostart commands
    main.rs                     # MODIFIED: Handle --hidden flag
    
src/locales/
  en/
    translation.json            # MODIFIED: Add behavior strings
  id/
    translation.json            # MODIFIED: Add Indonesian translations
```

---

## 🌐 Translations

### English (en/translation.json)
```json
{
  "settings": {
    "behavior": "Behavior",
    "app_behavior": "App Behavior",
    "dont_hide_when_closing": "Don't hide Hydra when closing",
    "run_at_startup": "Launch Hydra on system start-up",
    "start_minimized": "Launch Hydra minimized",
    "disable_nsfw_alert": "Disable NSFW alert",
    "seed_after_download": "Seed after download complete",
    "show_hidden_achievements": "Show hidden achievements description before unlocking them",
    "show_download_speed_megabytes": "Show download speed in megabytes per second",
    "extract_files_default": "Extract files by default after download",
    "enable_steam_achievements": "Enable search for Steam achievements"
  }
}
```

### Indonesian (id/translation.json)
```json
{
  "settings": {
    "behavior": "Perilaku",
    "app_behavior": "Perilaku Aplikasi",
    "dont_hide_when_closing": "Jangan sembunyikan Hydra saat ditutup",
    "run_at_startup": "Jalankan Hydra saat sistem dimulai",
    "start_minimized": "Jalankan Hydra diminimalkan",
    "disable_nsfw_alert": "Nonaktifkan peringatan NSFW",
    "seed_after_download": "Lanjutkan seed setelah download selesai",
    "show_hidden_achievements": "Tampilkan deskripsi achievement tersembunyi sebelum dibuka",
    "show_download_speed_megabytes": "Tampilkan kecepatan download dalam megabyte per detik",
    "extract_files_default": "Ekstrak file secara otomatis setelah download",
    "enable_steam_achievements": "Aktifkan pencarian untuk achievement Steam"
  }
}
```

---

## 🚀 Implementation Steps

### Phase 1: Backend (Rust)
1. ✅ Create `src-tauri/src/autostart.rs`
2. ✅ Add autostart functions (Windows, Linux, macOS)
3. ✅ Update `UserPreferences` struct in `preferences.rs`
4. ✅ Add Tauri commands in `lib.rs`
5. ✅ Handle `--hidden` flag in `main.rs` and `lib.rs`

### Phase 2: Frontend (TypeScript/React)
1. ✅ Create `src/pages/Settings/SettingsBehavior.tsx`
2. ✅ Create `src/pages/Settings/SettingsBehavior.scss`
3. ✅ Update `Settings.tsx` to add Behavior tab
4. ✅ Add translations to locale files
5. ✅ Update `src/types/index.ts` with new preference fields

### Phase 3: Testing
1. ✅ Test checkbox interactions
2. ✅ Test registry writes (Windows)
3. ✅ Test app launch with --hidden flag
4. ✅ Test preference persistence
5. ✅ Test system restart behavior

### Phase 4: Polish
1. ✅ Add toast notifications
2. ✅ Error handling for registry failures
3. ✅ Loading states
4. ✅ Documentation

---

## 🎯 Success Criteria

✅ **Must Have:**
- [x] Checkbox enables/disables autostart
- [x] Registry correctly updated on Windows
- [x] App launches on system startup when enabled
- [x] Nested checkbox controls minimized behavior
- [x] --hidden flag hides window on startup
- [x] Preferences persist across sessions

✅ **Nice to Have:**
- [ ] Cross-platform support (Linux/macOS)
- [ ] Detect manual registry changes
- [ ] System tray integration
- [ ] Notification on first launch after autostart

---

## 🔍 Debugging Tips

### Check Registry (Windows)
```cmd
# Open Registry Editor
regedit

# Navigate to:
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run

# Look for "Chaos Launcher" key
```

### Test --hidden Flag
```powershell
# Launch manually with --hidden flag
.\Chaos.exe --hidden

# Check if window is hidden
# Should only show in system tray
```

### Check Preferences File
```powershell
# Location: 
%APPDATA%\com.chaos.launcher\preferences.json

# View contents
cat "$env:APPDATA\com.chaos.launcher\preferences.json"
```

---

## 📚 References

### Hydra Implementation
- **File**: `C:\Users\Nazril\Documents\hydra\src\renderer\pages\settings\settings-behavior.tsx`
- **Backend**: `C:\Users\Nazril\Documents\hydra\src\main\events\user-preferences\auto-launch.ts`
- **Library**: `auto-launch` npm package (Electron-based)

### Windows Registry Documentation
- [MSDN: Run and RunOnce Registry Keys](https://docs.microsoft.com/en-us/windows/win32/setupapi/run-and-runonce-registry-keys)

### Tauri Documentation
- [Tauri v2 API](https://tauri.app/v2/reference/js-api/)
- [Tauri System Tray](https://tauri.app/v2/reference/js-api/@tauri-apps/api/tray/)

---

## ✅ Summary

Implementasi "Launch on system start-up" melibatkan:

1. **Frontend**: 
   - Behavior tab dengan nested checkboxes
   - State management untuk runAtStartup dan startMinimized
   - Invoke Tauri commands untuk configure autostart

2. **Backend**:
   - Windows Registry manipulation (HKEY_CURRENT_USER\Run)
   - Handle --hidden CLI flag
   - Cross-platform support (Linux .desktop, macOS LaunchAgent)

3. **Flow**:
   - User toggles checkbox → Save to preferences.json
   - Call configure_autostart → Write to Registry
   - Next boot → OS launches app automatically
   - If minimized enabled → App starts hidden to tray

4. **Key Files**:
   - `src-tauri/src/autostart.rs` (NEW)
   - `src/pages/Settings/SettingsBehavior.tsx` (NEW)
   - `src-tauri/src/preferences.rs` (MODIFIED)
   - `src-tauri/src/lib.rs` (MODIFIED)
   - `src-tauri/src/main.rs` (MODIFIED)





