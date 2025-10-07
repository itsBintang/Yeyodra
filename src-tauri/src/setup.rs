use tauri::AppHandle;
use crate::preferences::get_user_preferences;
use crate::aria2;
use crate::ludasavi::Ludasavi;
use crate::lock::AppLock;

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
            // This runs async so it won't block app startup
            let ludasavi_clone = Ludasavi::new(app_handle.clone());
            tauri::async_runtime::spawn(async move {
                println!("[Ludasavi] Starting background manifest update...");
                match ludasavi_clone.update_manifest_database() {
                    Ok(_) => println!("[Ludasavi] ✓ Manifest database updated successfully"),
                    Err(e) => eprintln!("[Ludasavi] ⚠ Warning: Failed to update manifest: {}", e),
                }
            });
        }
        Err(e) => {
            eprintln!("[Setup] ⚠ Warning: Failed to initialize Ludusavi: {}", e);
            eprintln!("[Setup] ⚠ Cloud save features may not work");
            // Don't fail app startup if ludusavi fails
        }
    }
    
    // TODO: Future enhancements (similar to Hydra)
    // - Acquire lock file (prevent multiple instances)
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

