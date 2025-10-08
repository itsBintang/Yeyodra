use tauri::AppHandle;
use crate::preferences::get_user_preferences;
use crate::aria2;
use crate::ludasavi::Ludasavi;
use crate::lock::AppLock;
use crate::steam_dll;

/// Initialize the application state on startup
/// Similar to Hydra's loadState() function
/// 
/// IMPORTANT: This runs on the main thread during app setup.
/// Heavy operations should be made non-blocking to prevent UI freeze.
pub fn initialize_app(app_handle: &AppHandle) -> Result<(), String> {
    println!("[Setup] Initializing Yeyodra Launcher...");
    
    // 0. Acquire application lock to prevent multiple instances
    match AppLock::acquire() {
        Ok(_lock) => {
            println!("[Setup] ✓ Application lock acquired");
            // Lock will be automatically released when _lock is dropped
            // We need to store it somewhere persistent - for now just leak it
            // In production, store in app state
            std::mem::forget(_lock);
        }
        Err(e) => {
            eprintln!("[Setup] ⚠ Warning: Could not acquire lock: {}", e);
            eprintln!("[Setup] ⚠ Another instance might be running");
            // Don't fail initialization - just warn the user
        }
    }
    
    // 1. Load user preferences first (lightweight, needed for config)
    let prefs = get_user_preferences(app_handle).unwrap_or_default();
    println!("[Setup] ✓ User preferences loaded");
    
    if let Some(path) = &prefs.downloads_path {
        println!("[Setup]   - Downloads path: {}", path);
    }
    println!("[Setup]   - SteamTools: {}", if prefs.steamtools_enabled { "enabled" } else { "disabled" });
    println!("[Setup]   - Low Connection Mode: {}", prefs.low_connection_mode);
    
    // 2. Initialize aria2c download manager with adaptive connection count
    // NOTE: Made non-blocking to prevent app crash if aria2c fails
    let max_connections = if prefs.low_connection_mode {
        println!("[Setup] Low Connection Mode enabled - using 4 connections");
        4
    } else {
        16
    };
    
    // Try to initialize aria2c, but don't crash the app if it fails
    // It will be lazy-initialized on first download attempt
    match aria2::init_with_connections(max_connections) {
        Ok(_) => {
            println!("[Setup] ✓ Aria2c initialized with {} connections", max_connections);
        }
        Err(e) => {
            eprintln!("[Setup] ⚠ Warning: Failed to initialize aria2c: {}", e);
            eprintln!("[Setup] ⚠ Aria2c will be initialized on first download");
            // Don't return error - let app continue
        }
    }
    
    // 3. Initialize Ludusavi (copy binary and config to user data)
    // Also non-blocking - only needed for cloud save feature
    let ludasavi = Ludasavi::new(app_handle.clone());
    match ludasavi.init() {
        Ok(_) => {
            println!("[Setup] ✓ Ludusavi initialized successfully");
            
            // CRITICAL: Update manifest in background to enable cloud save
            // Use spawn_blocking for CPU-bound/blocking operations
            let ludasavi_clone = Ludasavi::new(app_handle.clone());
            tauri::async_runtime::spawn(async move {
                println!("[Ludasavi] Starting background manifest update...");
                println!("[Ludasavi] This may take 5-10 seconds on first run...");
                
                // Retry logic: Try up to 3 times with 2 second delay
                let mut attempts = 0;
                let max_attempts = 3;
                
                while attempts < max_attempts {
                    attempts += 1;
                    
                    // Run blocking operation in spawn_blocking
                    let ludasavi_ref = Ludasavi::new(ludasavi_clone.app_handle.clone());
                    match tauri::async_runtime::spawn_blocking(move || {
                        ludasavi_ref.update_manifest_database()
                    }).await {
                        Ok(Ok(_)) => {
                            println!("[Ludasavi] ✓ Manifest database updated successfully");
                            println!("[Ludasavi] ✓ Cloud save feature is now ready");
                            break;
                        }
                        Ok(Err(e)) => {
                            if attempts < max_attempts {
                                eprintln!("[Ludasavi] ⚠ Attempt {}/{} failed: {}", attempts, max_attempts, e);
                                eprintln!("[Ludasavi] ⚠ Retrying in 2 seconds...");
                                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                            } else {
                                eprintln!("[Ludasavi] ✗ Failed to update manifest after {} attempts: {}", max_attempts, e);
                                eprintln!("[Ludasavi] ✗ Cloud save may not detect new games");
                                eprintln!("[Ludasavi] → Please update manually from Settings > Cloud Save > Update Game Database");
                            }
                        }
                        Err(e) => {
                            eprintln!("[Ludasavi] ✗ Task join error: {}", e);
                            break;
                        }
                    }
                }
            });
        }
        Err(e) => {
            eprintln!("[Setup] ⚠ Warning: Failed to initialize Ludusavi: {}", e);
            eprintln!("[Setup] ⚠ Cloud save features may not work");
            // Don't fail app startup if ludusavi fails
        }
    }
    
    // 4. Initialize Steam API DLL (extract to EXE directory)
    // CRITICAL: Steam API DLL must be in same folder as EXE!
    #[cfg(windows)]
    {
        match steam_dll::init_steam_dll() {
            Ok(dll_path) => {
                println!("[Setup] ✓ Steam API DLL initialized at {:?}", dll_path);
            }
            Err(e) => {
                eprintln!("[Setup] ⚠ Warning: Failed to initialize Steam API DLL: {}", e);
                eprintln!("[Setup] ⚠ Steam achievement features may not work");
                // Don't fail app startup if Steam DLL fails
            }
        }
    }
    
    // TODO: Future enhancements (similar to Hydra)
    // - Resume queued downloads
    // - Clean up extracting status
    // - Seed completed torrents
    // - Check system paths availability
    // - Download common redistributables
    
    println!("[Setup] ✓ Yeyodra Launcher initialized successfully");
    println!("[Setup] Ready for use!");
    Ok(())
}

/// Cleanup function to run before app shutdown
pub fn cleanup_app() -> Result<(), String> {
    println!("Shutting down Yeyodra Launcher...");
    
    // Shutdown aria2c
    if let Err(e) = aria2::shutdown() {
        eprintln!("Failed to shutdown aria2c: {}", e);
        return Err(format!("Failed to shutdown aria2c: {}", e));
    }
    println!("✓ Aria2c shut down");
    
    // TODO: Future enhancements
    // - Save current playtime
    // - Disconnect from download sources
    // - Save application state
    
    println!("✓ Yeyodra Launcher shut down successfully");
    Ok(())
}

