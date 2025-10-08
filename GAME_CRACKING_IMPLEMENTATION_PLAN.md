# 🎮 Game Cracking Feature - Implementation Plan

**Date**: 2025-10-08  
**Feature**: Steam Game Cracking (Steamless + Goldberg)  
**Inspiration**: BetterSteamAutoCracker

---

## 📋 Overview

Implementasi fitur cracking game Steam untuk memungkinkan game dimainkan offline tanpa Steam client. Fitur ini akan muncul di game detail page sebagai button/toggle di samping DLC Unlocker dan Cloud Save.

---

## 🏗️ Architecture

### **Pipeline Cracking:**

```
USER ACTION
    ↓
[Click "Crack Game" button]
    ↓
[Show Cracking Modal with progress]
    ↓
STEP 1: STEAMLESS (0-50%)
├─ Scan folder game untuk .exe files
├─ Detect SteamStub DRM
├─ Backup original .exe → .exe.svrn
├─ Run Steamless CLI
└─ Generate unpacked executable
    ↓
STEP 2: GOLDBERG (50-100%)
├─ Fetch game data from Steam API
│  ├─ DLCs
│  ├─ Achievements
│  └─ Languages
├─ Replace steam_api.dll/steam_api64.dll
│  ├─ Backup original → .dll.svrn
│  └─ Copy Goldberg emulator DLLs
├─ Generate config files:
│  ├─ steam_appid.txt
│  ├─ DLC.txt
│  ├─ steam_settings/achievement.json
│  ├─ steam_settings/supported_languages.txt
│  └─ steam_settings/configs.main.ini
└─ Create backup → Goldberg.zip
    ↓
[Emit progress: 100%]
    ↓
[Show success notification]
    ↓
DONE! Game ready to play offline
```

---

## 📁 File Structure

```
src-tauri/src/
├─ cracker/
│  ├─ mod.rs              # Main orchestrator
│  ├─ steamless.rs        # Steamless DRM removal
│  ├─ goldberg.rs         # Goldberg emulator
│  ├─ config.rs           # Config generator
│  ├─ backup.rs           # Backup management
│  └─ dependencies.rs     # Auto-download DLLs/Steamless

src/components/
├─ GameCrackingModal/
│  ├─ GameCrackingModal.tsx
│  └─ GameCrackingModal.scss

src/pages/
└─ GameDetails.tsx        # Add crack button

%APPDATA%/com.chaoslauncher.dev/
└─ cracker/
   ├─ steam_api.dll       # Goldberg 32-bit
   ├─ steam_api64.dll     # Goldberg 64-bit
   ├─ steamclient.dll     # 32-bit
   ├─ steamclient64.dll   # 64-bit
   ├─ steamless/
   │  └─ Steamless.CLI.exe
   └─ overlay_achievement_notification.wav
```

---

## 🔧 Implementation Steps

### **1. Backend (Rust)**

#### **A. Dependencies Setup Module** (`dependencies.rs`)

```rust
// Auto-download cracking dependencies
pub async fn setup_cracker_dependencies() -> Result<()> {
    let cache_dir = get_app_data_dir()?.join("cracker");
    
    download_files(&[
        ("goldberg/x32/steam_api.dll", "steam_api.dll"),
        ("goldberg/x64/steam_api64.dll", "steam_api64.dll"),
        ("goldberg/x32/steamclient.dll", "steamclient.dll"),
        ("goldberg/x64/steamclient64.dll", "steamclient64.dll"),
        ("steamless/Steamless.CLI.exe.zip", "steamless.zip"),
        ("overlay_achievement_notification.wav", "notification.wav"),
    ]).await?;
    
    extract_steamless_zip(&cache_dir).await?;
    Ok(())
}
```

#### **B. Steamless Module** (`steamless.rs`)

```rust
pub async fn apply_steamless(
    app_handle: &AppHandle,
    game_path: &Path,
) -> Result<()> {
    // 1. Scan for .exe files
    let executables = scan_pe_files(game_path)?;
    
    // 2. Backup originals
    for exe in &executables {
        backup_file(exe, &exe.with_extension("exe.svrn"))?;
    }
    
    // 3. Run Steamless CLI
    for exe in executables {
        emit_progress(app_handle, 25, "Removing DRM...")?;
        run_steamless_cli(&exe).await?;
    }
    
    Ok(())
}

async fn run_steamless_cli(exe_path: &Path) -> Result<()> {
    let steamless_exe = get_app_data_dir()?
        .join("cracker/steamless/Steamless.CLI.exe");
    
    Command::new(steamless_exe)
        .arg(exe_path)
        .output()
        .await?;
    
    Ok(())
}
```

#### **C. Goldberg Module** (`goldberg.rs`)

```rust
pub async fn apply_goldberg(
    app_handle: &AppHandle,
    game_path: &Path,
    app_id: &str,
) -> Result<()> {
    emit_progress(app_handle, 50, "Fetching game data...")?;
    
    // 1. Fetch data from Steam API
    let dlcs = fetch_dlcs(app_id).await?;
    let achievements = fetch_achievements(app_id).await?;
    let languages = fetch_languages(app_id).await?;
    
    emit_progress(app_handle, 60, "Replacing Steam DLLs...")?;
    
    // 2. Replace steam_api.dll
    replace_steam_dlls(game_path).await?;
    
    emit_progress(app_handle, 80, "Generating configs...")?;
    
    // 3. Generate config files
    generate_configs(game_path, app_id, &dlcs, &achievements, &languages).await?;
    
    emit_progress(app_handle, 90, "Creating backup...")?;
    
    // 4. Create backup zip
    create_goldberg_backup(game_path).await?;
    
    Ok(())
}

async fn replace_steam_dlls(game_path: &Path) -> Result<()> {
    let cache_dir = get_app_data_dir()?.join("cracker");
    
    // Find steam_api.dll
    for entry in WalkDir::new(game_path) {
        let entry = entry?;
        let file_name = entry.file_name().to_string_lossy();
        
        if file_name == "steam_api.dll" {
            backup_file(&entry.path(), &entry.path().with_extension("dll.svrn"))?;
            fs::copy(cache_dir.join("steam_api.dll"), entry.path())?;
        }
        
        if file_name == "steam_api64.dll" {
            backup_file(&entry.path(), &entry.path().with_extension("dll.svrn"))?;
            fs::copy(cache_dir.join("steam_api64.dll"), entry.path())?;
        }
    }
    
    Ok(())
}
```

#### **D. Config Generator** (`config.rs`)

```rust
pub async fn generate_configs(
    game_path: &Path,
    app_id: &str,
    dlcs: &[Dlc],
    achievements: &[Achievement],
    languages: &[String],
) -> Result<()> {
    let settings_dir = game_path.join("steam_settings");
    fs::create_dir_all(&settings_dir)?;
    
    // 1. steam_appid.txt
    fs::write(game_path.join("steam_appid.txt"), app_id)?;
    
    // 2. DLC.txt
    let dlc_content = dlcs.iter()
        .map(|d| d.id.to_string())
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(settings_dir.join("DLC.txt"), dlc_content)?;
    
    // 3. achievement.json
    let achi_json = serde_json::to_string_pretty(&achievements)?;
    fs::write(settings_dir.join("achievement.json"), achi_json)?;
    
    // 4. supported_languages.txt
    fs::write(
        settings_dir.join("supported_languages.txt"),
        languages.join("\n")
    )?;
    
    // 5. configs.main.ini
    let ini_content = format!("[main]\nAppId={}\n", app_id);
    fs::write(settings_dir.join("configs.main.ini"), ini_content)?;
    
    Ok(())
}
```

#### **E. Main Orchestrator** (`mod.rs`)

```rust
#[tauri::command]
pub async fn crack_game(
    app_handle: AppHandle,
    game_path: String,
    app_id: String,
) -> Result<String, String> {
    // Ensure dependencies downloaded
    setup_cracker_dependencies()
        .await
        .map_err(|e| e.to_string())?;
    
    let game_path = PathBuf::from(&game_path);
    
    // Step 1: Steamless (0-50%)
    app_handle.emit("crack-progress", json!({
        "progress": 0,
        "message": "Starting DRM removal..."
    })).map_err(|e| e.to_string())?;
    
    steamless::apply_steamless(&app_handle, &game_path)
        .await
        .map_err(|e| e.to_string())?;
    
    // Step 2: Goldberg (50-100%)
    app_handle.emit("crack-progress", json!({
        "progress": 50,
        "message": "Starting Steam emulation..."
    })).map_err(|e| e.to_string())?;
    
    goldberg::apply_goldberg(&app_handle, &game_path, &app_id)
        .await
        .map_err(|e| e.to_string())?;
    
    app_handle.emit("crack-progress", json!({
        "progress": 100,
        "message": "Cracking complete!"
    })).map_err(|e| e.to_string())?;
    
    Ok("Game cracked successfully!".to_string())
}
```

---

### **2. Frontend (React/TypeScript)**

#### **A. Cracking Modal** (`GameCrackingModal.tsx`)

```typescript
interface GameCrackingModalProps {
  visible: boolean;
  onClose: () => void;
  gamePath: string;
  appId: string;
  gameName: string;
}

export function GameCrackingModal({
  visible,
  onClose,
  gamePath,
  appId,
  gameName
}: GameCrackingModalProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [isCracking, setIsCracking] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    const unlisten = listen<{progress: number; message: string}>(
      "crack-progress",
      (event) => {
        setProgress(event.payload.progress);
        setStatus(event.payload.message);
      }
    );
    
    return () => { unlisten.then(fn => fn()); };
  }, []);
  
  const handleStartCrack = async () => {
    setIsCracking(true);
    setError("");
    
    try {
      await invoke("crack_game", {
        gamePath,
        appId
      });
      
      // Success - show completion
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCracking(false);
    }
  };
  
  return (
    <Modal visible={visible} onClose={onClose}>
      <h2>🔓 Crack Game: {gameName}</h2>
      
      {!isCracking ? (
        <div>
          <p>This will:</p>
          <ul>
            <li>Remove Steam DRM (Steamless)</li>
            <li>Apply Steam emulator (Goldberg)</li>
            <li>Backup original files (.svrn)</li>
            <li>Enable offline play</li>
          </ul>
          
          <Button onClick={handleStartCrack}>
            Start Cracking
          </Button>
        </div>
      ) : (
        <div>
          <ProgressBar value={progress} />
          <p>{status}</p>
        </div>
      )}
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Modal>
  );
}
```

#### **B. Add Button to GameDetails.tsx**

```typescript
// Add state
const [showCrackingModal, setShowCrackingModal] = useState(false);

// Add handler
const handleCrackGame = () => {
  setShowCrackingModal(true);
};

// Add button (line ~178, after DLC button)
{game && game.executablePath && (
  <button
    type="button"
    className="game-details__crack-button"
    onClick={handleCrackGame}
  >
    <LockIcon size={20} />
    Crack Game
  </button>
)}

// Add modal (line ~296, after CloudSyncFilesModal)
{game && (
  <GameCrackingModal
    visible={showCrackingModal}
    onClose={() => setShowCrackingModal(false)}
    gamePath={game.executablePath || ""}
    appId={objectId || ""}
    gameName={gameTitle}
  />
)}
```

---

## 🎨 UI Design

### **Button Style** (similar to DLC/Cloud Save)

```scss
.game-details__crack-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #FF6B6B 0%, #C92A2A 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
  }
}
```

---

## ⚠️ Important Notes

### **Security & Legal**
- Add disclaimer modal before first crack
- Store user consent in app settings
- Show warning about Steam ToS violation

### **Technical Considerations**
1. **Windows Only** - Steamless only works on Windows
2. **File Permissions** - May need admin rights
3. **Antivirus** - May flag Goldberg DLLs
4. **Backup Critical** - Always backup before modification

### **Dependencies Download**
- Use S3/CDN for hosting binaries
- Goldberg DLLs (~500KB total)
- Steamless CLI (~2MB compressed)
- Total: ~3MB download on first use

---

## 📊 Progress Tracking

```
0%  → Starting
10% → Scanning executables
25% → Removing DRM (Steamless)
50% → Fetching game data
60% → Replacing Steam DLLs
80% → Generating configs
90% → Creating backups
100% → Complete!
```

---

## ✅ Success Criteria

- [ ] Dependencies auto-download on first use
- [ ] Steamless successfully removes DRM
- [ ] Goldberg replaces Steam API
- [ ] Config files generated correctly
- [ ] Backups created (.svrn + zip)
- [ ] Game launches offline without Steam
- [ ] Progress updates in real-time
- [ ] Error handling for all edge cases

---

## 🚀 Future Enhancements

1. **Denuvo Detection** - Warn if game has Denuvo
2. **Multi-threaded Processing** - Parallel DLL replacement
3. **Crack History** - Track cracked games
4. **Restore Feature** - Restore from .svrn backups
5. **Custom Config** - Advanced Goldberg settings

---

**Status**: Ready for Implementation  
**Estimated Time**: 8-12 hours  
**Priority**: High

