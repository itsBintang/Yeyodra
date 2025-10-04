# SteamTools Resource Downloader Implementation Plan

## Overview
Implementasi sistem download resources SteamTools dari multiple sources (GitHub, direct URLs) dan inject ke Steam folder, terinspirasi dari Zenith.

## 🎯 Konsep Zenith

### How It Works
1. **Multiple Sources** - Try download dari beberapa repo/URLs (priority order)
2. **Download ZIP** - Download dari GitHub branches atau direct URLs
3. **Extract & Inject** - Extract ZIP dan copy files ke Steam folders:
   - `*.lua` → `Steam/config/stplug-in/`
   - `*.manifest` → `Steam/config/depotcache/`
   - `*.bin` → `Steam/config/StatsExport/`
4. **Update LUA** - Update manifest IDs di LUA files
5. **No Local Storage** - Process in-memory, tidak save ZIP ke disk

### Sources Priority (Zenith)
```rust
1. SteamAutoCracks/ManifestHub (GitHub Branch)
2. sushitools-games-repo (Direct ZIP)
3. Fairyvmos/bruh-hub (GitHub Branch)
4. itsBintang/ManifestHub (GitHub Branch)
5. mellyiscoolaf.pythonanywhere.com (Direct URL)
6. masss.pythonanywhere.com (Direct URL)
```

### File Structure
```
Steam/
  └── config/
      ├── stplug-in/          # LUA files (app configs)
      │   ├── {appid}.lua
      │   └── Steamtools.lua
      ├── depotcache/         # Manifest files (depot data)
      │   └── {depotid}_{manifestid}.manifest
      └── StatsExport/        # Achievement/stats data
          └── {appid}.bin
```

## 🚀 Implementation for Chaos

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CHAOS FRONTEND                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Game Details Page                                       │
│    ↓                                                     │
│  [Inject SteamTools] Button                             │
│    ↓                                                     │
│  invoke('inject_steamtools', { appId, gameName })       │
│                                                          │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                  CHAOS BACKEND (Rust)                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Try Multiple Sources (in priority order)            │
│     ├── GitHub Repos (branches)                         │
│     ├── Direct ZIP URLs                                 │
│     └── Direct URLs                                     │
│                                                          │
│  2. Download ZIP (in-memory)                            │
│     └── reqwest → bytes                                 │
│                                                          │
│  3. Extract ZIP (temp directory)                        │
│     └── zip crate                                       │
│                                                          │
│  4. Inject to Steam Folders                             │
│     ├── *.lua → stplug-in/                              │
│     ├── *.manifest → depotcache/                        │
│     └── *.bin → StatsExport/                            │
│                                                          │
│  5. Update LUA manifest IDs                             │
│     └── Regex replace in LUA files                      │
│                                                          │
│  6. Cleanup temp files                                  │
│     └── Drop temp_dir                                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Backend Implementation

#### 1. Module Structure
```
src-tauri/src/
  ├── steamtools/
  │   ├── mod.rs              # Main module
  │   ├── downloader.rs       # Download from multiple sources
  │   ├── injector.rs         # Extract & inject to Steam
  │   ├── sources.rs          # Source configurations
  │   └── types.rs            # Types & enums
  └── steam_utils.rs          # Already exists (Steam path detection)
```

#### 2. Source Configuration
```rust
pub enum SourceType {
    GitHubBranch,      // GitHub repo branch as ZIP
    DirectZip,         // Direct ZIP file URL
    DirectUrl,         // Direct URL with appid parameter
}

pub struct Source {
    name: String,
    url_template: String,
    source_type: SourceType,
}

// Priority-ordered sources
pub fn get_sources() -> Vec<Source> {
    vec![
        Source {
            name: "SteamAutoCracks/ManifestHub".to_string(),
            url_template: "https://api.github.com/repos/SteamAutoCracks/ManifestHub/zipball/{appid}".to_string(),
            source_type: SourceType::GitHubBranch,
        },
        Source {
            name: "sushitools-games-repo".to_string(),
            url_template: "https://raw.githubusercontent.com/sushi-dev55/sushitools-games-repo/refs/heads/main/{appid}.zip".to_string(),
            source_type: SourceType::DirectZip,
        },
        // Add more sources...
    ]
}
```

#### 3. Downloader
```rust
pub async fn download_from_sources(
    app_id: &str,
    sources: &[Source],
) -> Result<Vec<u8>, String> {
    for source in sources {
        println!("Trying source: {}", source.name);
        
        match download_from_source(app_id, source).await {
            Ok(bytes) => {
                println!("✅ Downloaded from: {}", source.name);
                return Ok(bytes);
            }
            Err(e) => {
                println!("❌ Failed from {}: {}", source.name, e);
                continue;
            }
        }
    }
    
    Err("All sources failed".to_string())
}

async fn download_from_source(
    app_id: &str,
    source: &Source,
) -> Result<Vec<u8>, String> {
    let url = source.url_template.replace("{appid}", app_id);
    
    let response = HTTP_CLIENT
        .get(&url)
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    
    let bytes = response.bytes().await
        .map_err(|e| e.to_string())?;
    
    Ok(bytes.to_vec())
}
```

#### 4. Injector
```rust
pub fn inject_to_steam(
    zip_bytes: &[u8],
    app_id: &str,
    steam_config_path: &Path,
) -> Result<InjectionResult, String> {
    // Create temp directory
    let temp_dir = TempDir::new()
        .map_err(|e| e.to_string())?;
    
    // Extract ZIP
    let mut archive = ZipArchive::new(Cursor::new(zip_bytes))
        .map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| e.to_string())?;
        
        let outpath = temp_dir.path().join(file.name());
        
        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)
                .map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                fs::create_dir_all(p)
                    .map_err(|e| e.to_string())?;
            }
            let mut outfile = File::create(&outpath)
                .map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| e.to_string())?;
        }
    }
    
    // Inject files to Steam folders
    inject_files(temp_dir.path(), app_id, steam_config_path)
}

fn inject_files(
    extracted_path: &Path,
    app_id: &str,
    steam_config_path: &Path,
) -> Result<InjectionResult, String> {
    let stplugin_dir = steam_config_path.join("stplug-in");
    let depotcache_dir = steam_config_path.join("depotcache");
    let statsexport_dir = steam_config_path.join("StatsExport");
    
    // Create directories if not exist
    fs::create_dir_all(&stplugin_dir)
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&depotcache_dir)
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&statsexport_dir)
        .map_err(|e| e.to_string())?;
    
    let mut result = InjectionResult {
        lua_count: 0,
        manifest_count: 0,
        bin_count: 0,
        manifest_map: HashMap::new(),
    };
    
    // Walk through extracted files
    for entry in WalkDir::new(extracted_path)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() {
            continue;
        }
        
        let path = entry.path();
        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        match path.extension().and_then(|e| e.to_str()) {
            Some("lua") => {
                let target = stplugin_dir.join(file_name);
                fs::copy(path, &target)
                    .map_err(|e| e.to_string())?;
                result.lua_count += 1;
            }
            Some("manifest") => {
                let target = depotcache_dir.join(file_name);
                fs::copy(path, &target)
                    .map_err(|e| e.to_string())?;
                result.manifest_count += 1;
                
                // Extract depot ID and manifest ID
                if let Some((depot_id, manifest_id)) = 
                    parse_manifest_filename(file_name) 
                {
                    result.manifest_map.insert(depot_id, manifest_id);
                }
            }
            Some("bin") => {
                let target = statsexport_dir.join(file_name);
                fs::copy(path, &target)
                    .map_err(|e| e.to_string())?;
                result.bin_count += 1;
            }
            _ => {}
        }
    }
    
    // Update LUA files with manifest IDs
    if !result.manifest_map.is_empty() {
        update_lua_manifest_ids(
            &stplugin_dir,
            app_id,
            &result.manifest_map
        )?;
    }
    
    Ok(result)
}

fn parse_manifest_filename(filename: &str) -> Option<(String, String)> {
    let re = Regex::new(r"(\d+)_(\d+)\.manifest").ok()?;
    let caps = re.captures(filename)?;
    
    let depot_id = caps.get(1)?.as_str().to_string();
    let manifest_id = caps.get(2)?.as_str().to_string();
    
    Some((depot_id, manifest_id))
}
```

#### 5. Tauri Command
```rust
#[tauri::command]
async fn inject_steamtools(
    app_id: String,
    game_name: String,
) -> Result<InjectionResult, String> {
    println!("Injecting SteamTools for: {} ({})", game_name, app_id);
    
    // Get Steam config path
    let steam_config_path = find_steam_config_path()
        .map_err(|e| e.to_string())?;
    
    // Get sources
    let sources = steamtools::get_sources();
    
    // Download from sources
    let zip_bytes = steamtools::download_from_sources(&app_id, &sources)
        .await?;
    
    // Inject to Steam
    let result = steamtools::inject_to_steam(
        &zip_bytes,
        &app_id,
        &steam_config_path,
    )?;
    
    println!(
        "✅ Injection complete: {} LUA, {} manifests, {} BIN",
        result.lua_count,
        result.manifest_count,
        result.bin_count
    );
    
    Ok(result)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InjectionResult {
    pub lua_count: usize,
    pub manifest_count: usize,
    pub bin_count: usize,
    pub manifest_map: HashMap<String, String>,
}
```

### Frontend Implementation

#### Button in Game Details
```typescript
// In GameDetails.tsx or HeroPanel.tsx
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

function SteamToolsButton({ appId, gameName }: { appId: string; gameName: string }) {
  const [isInjecting, setIsInjecting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleInject = async () => {
    setIsInjecting(true);
    setResult(null);

    try {
      const result = await invoke<InjectionResult>('inject_steamtools', {
        appId,
        gameName,
      });

      setResult(
        `Successfully injected! ${result.luaCount} LUA, ${result.manifestCount} manifests, ${result.binCount} BIN files`
      );
    } catch (error) {
      setResult(`Failed: ${error}`);
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleInject}
        disabled={isInjecting}
        className="steamtools-inject-button"
      >
        {isInjecting ? "Injecting..." : "Inject SteamTools"}
      </button>
      {result && <p>{result}</p>}
    </div>
  );
}
```

## 📋 Dependencies

### Cargo.toml
```toml
[dependencies]
# Already have these:
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }

# Need to add:
zip = "0.6"              # ZIP extraction
tempfile = "3.8"         # Temporary directories
walkdir = "2.4"          # Directory traversal
regex = "1.10"           # Manifest filename parsing
```

## 🎨 UI/UX

### Button Placement
Add "Inject SteamTools" button next to Download button in Game Details:

```
┌────────────────────────────────────┐
│  Game Details Hero                 │
│  ┌──────────────────────────────┐  │
│  │  Game Logo                   │  │
│  │  ┌──────────┐ ┌────────────┐│  │
│  │  │ Download │ │ SteamTools ││  │
│  │  └──────────┘ └────────────┘│  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### States
- **Idle**: "Inject SteamTools" button
- **Injecting**: "Injecting..." (disabled, spinner)
- **Success**: Toast notification + checkmark
- **Error**: Toast notification with error message

## 🔧 Configuration

### Customizable Sources
Allow users to add custom sources in Settings:

```typescript
interface CustomSource {
  name: string;
  urlTemplate: string; // Use {appid} placeholder
  type: 'github_branch' | 'direct_zip' | 'direct_url';
  enabled: boolean;
}
```

## ⚠️ Important Notes

1. **Steam Must Be Closed**: Injecting while Steam is running may not work
2. **Backup**: Warn users to backup their Steam config
3. **Verification**: Check if files already exist before overwrite
4. **Permissions**: May require admin rights on some systems
5. **Antivirus**: Some AVs may flag file injection

## 🚀 Benefits

1. **Multiple Sources**: Fallback if one source is down
2. **No Manual Work**: Automated file placement
3. **In-Memory**: Fast, no disk clutter
4. **Type-Safe**: Full Rust type safety
5. **Error Handling**: Graceful fallback and error messages

## 📝 Next Steps

1. ✅ Create `steamtools` module structure
2. ✅ Implement downloader with multiple sources
3. ✅ Implement injector (extract & copy files)
4. ✅ Add Tauri command
5. ✅ Create frontend button component
6. ✅ Add to Game Details page
7. ✅ Test with real Steam installation
8. ✅ Add error handling & user feedback
9. ✅ Add configuration UI in Settings

Implementasi ini lebih robust dan maintainable daripada JSON-based approach! 🎊

