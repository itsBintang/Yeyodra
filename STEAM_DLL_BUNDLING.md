# Steam API DLL Bundling Implementation

## 🎯 Problem
Steam API DLL (`steam_api64.dll`) **MUST** be in the **SAME DIRECTORY** as the executable (`yeyodra.exe`) for Steam features (achievements, stats, etc.) to work. 

This is different from other binaries like Ludusavi which can be stored in AppData.

## ✅ Solution: Embedded Binary Extraction

Similar to Ludusavi bundling, we:
1. **Embed DLL at compile time** using `include_bytes!`
2. **Extract to EXE directory** on first run
3. **No resources folder dependency** - fully portable

## 📁 File Structure

```
Chaos/
├── steam-binaries/           # Source (not bundled in installer)
│   └── steam_api64.dll      # Original DLL from steamworks-rs
├── src-tauri/
│   └── src/
│       ├── steam_dll.rs     # NEW: DLL management module
│       ├── setup.rs         # Calls init_steam_dll() on startup
│       └── lib.rs           # Registers steam_dll module
```

## 🔧 Implementation Details

### 1. `src-tauri/src/steam_dll.rs`
```rust
// Embed DLL at compile time
const STEAM_API_DLL: &[u8] = include_bytes!("../../steam-binaries/steam_api64.dll");

pub fn init_steam_dll() -> Result<PathBuf> {
    // Get directory where yeyodra.exe is located
    let exe_path = std::env::current_exe()?;
    let exe_dir = exe_path.parent().unwrap();
    
    let dll_path = exe_dir.join("steam_api64.dll");
    
    // Extract embedded DLL if not exists
    if !dll_path.exists() {
        fs::write(&dll_path, STEAM_API_DLL)?;
    }
    
    Ok(dll_path)
}
```

### 2. `src-tauri/src/setup.rs`
Called during app initialization:
```rust
#[cfg(windows)]
{
    match steam_dll::init_steam_dll() {
        Ok(dll_path) => {
            println!("[Setup] ✓ Steam API DLL initialized at {:?}", dll_path);
        }
        Err(e) => {
            eprintln!("[Setup] ⚠ Warning: Failed to initialize Steam API DLL: {}", e);
        }
    }
}
```

## 📦 Build Result

After building, the installer will contain:
```
yeyodra.exe         # Main executable (with embedded DLL)
                    # On first run, extracts steam_api64.dll to same folder
```

Fresh installation directory after first run:
```
C:\Users\...\AppData\Local\Yeyodra\
├── yeyodra.exe
├── steam_api64.dll    # ✅ Extracted by init_steam_dll()
├── aria2c.exe
├── 7z.exe
└── 7z.dll
```

## 🎮 Steam Features That Need This

When implementing Steam achievements/stats:
1. Add `steamworks` dependency to `Cargo.toml`
2. Call `Client::init()` - it will automatically find `steam_api64.dll` in EXE dir
3. No additional configuration needed!

## 📝 Source DLL Location

Copied from:
```
C:\Users\Nazril\Documents\Projek\steamworks-rs\
    steamworks-sys\lib\steam\redistributable_bin\win64\steam_api64.dll
```

## ⚠️ Important Notes

1. **EXE directory vs AppData**:
   - Ludusavi binary → AppData (doesn't need to be with EXE)
   - Steam API DLL → **MUST be with EXE** (Windows DLL search path)

2. **Platform specific**:
   - Windows: `steam_api64.dll`
   - Linux: `libsteam_api.so`
   - macOS: `libsteam_api.dylib`

3. **No resources folder**:
   - Unlike previous approach, we don't use `tauri.conf.json` resources
   - DLL is embedded directly in the Rust binary
   - More reliable than Tauri's resource bundling

## ✅ Testing

1. **Dev mode**: Run `npm run tauri dev`
   - Check logs: `[Setup] ✓ Steam API DLL initialized at ...`
   - Verify DLL exists in dev build folder

2. **Build mode**: Run `npm run tauri build`
   - Fresh install on clean machine
   - Check `%LOCALAPPDATA%\Yeyodra\` for `steam_api64.dll`
   - Verify Steam features work

## 🚀 Next Steps

When implementing Steam achievements feature:
1. Add to `Cargo.toml`:
   ```toml
   [dependencies]
   steamworks = "0.12.0"
   ```

2. Create `src-tauri/src/steam_achievements.rs`:
   ```rust
   use steamworks::Client;
   
   pub fn unlock_achievement(app_id: u32, name: &str) -> Result<()> {
       let client = Client::init_app(app_id)?;
       let achievement = client.user_stats().achievement(name);
       achievement.set()?;
       Ok(())
   }
   ```

3. DLL is already in place - no additional setup needed!

## 📚 References

- Samira project: `C:\Users\Nazril\Documents\Projek\Samira`
- steamworks-rs: `C:\Users\Nazril\Documents\Projek\steamworks-rs`
- Hydra (Electron equivalent): Uses `electron-builder.yml` extraResources

