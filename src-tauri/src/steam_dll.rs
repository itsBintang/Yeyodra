use anyhow::Result;
use std::fs;
use std::path::PathBuf;

// ✅ EMBED STEAM API DLL AT COMPILE TIME
#[cfg(windows)]
const STEAM_API_DLL: &[u8] = include_bytes!("../../steam-binaries/steam_api64.dll");

/// Initialize Steam API DLL by extracting it to the same directory as the EXE
/// 
/// **CRITICAL**: Steam API requires the DLL to be in the SAME folder as the executable!
/// This is different from Ludusavi which can be in AppData.
pub fn init_steam_dll() -> Result<PathBuf> {
    #[cfg(not(windows))]
    {
        return Err(anyhow::anyhow!("Steam DLL initialization only needed on Windows"));
    }

    #[cfg(windows)]
    {
        println!("[Steam DLL] Initializing...");
        
        // Get the directory where yeyodra.exe is located
        let exe_path = std::env::current_exe()?;
        let exe_dir = exe_path
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Failed to get executable directory"))?;
        
        let dll_path = exe_dir.join("steam_api64.dll");
        
        println!("[Steam DLL] EXE directory: {:?}", exe_dir);
        println!("[Steam DLL] Target DLL path: {:?}", dll_path);
        
        // Extract embedded DLL if it doesn't exist
        if !dll_path.exists() {
            println!(
                "[Steam DLL] Extracting embedded DLL ({} bytes)...",
                STEAM_API_DLL.len()
            );
            fs::write(&dll_path, STEAM_API_DLL)?;
            println!("[Steam DLL] ✓ DLL extracted successfully");
        } else {
            println!("[Steam DLL] DLL already exists");
        }
        
        println!("[Steam DLL] ✓ Initialization complete");
        Ok(dll_path)
    }
}

/// Check if Steam API DLL exists in the correct location
pub fn is_steam_dll_present() -> bool {
    #[cfg(not(windows))]
    {
        return false;
    }

    #[cfg(windows)]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let dll_path = exe_dir.join("steam_api64.dll");
                return dll_path.exists();
            }
        }
        false
    }
}

