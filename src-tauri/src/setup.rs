use tauri::AppHandle;
use crate::preferences::get_user_preferences;
use crate::aria2;

/// Initialize the application state on startup
/// Similar to Hydra's loadState() function
pub fn initialize_app(app_handle: &AppHandle) -> Result<(), String> {
    println!("Initializing Chaos Launcher...");
    
    // 1. Initialize aria2c download manager with adaptive connection count
    let prefs = get_user_preferences(app_handle).unwrap_or_default();
    let max_connections = if prefs.low_connection_mode {
        println!("Low Connection Mode enabled - using 4 connections");
        4
    } else {
        16
    };
    
    if let Err(e) = aria2::init_with_connections(max_connections) {
        eprintln!("Failed to initialize aria2c: {}", e);
        return Err(format!("Failed to initialize aria2c: {}", e));
    }
    println!("✓ Aria2c initialized with {} connections", max_connections);
    
    // 2. Load user preferences to validate configuration
    match get_user_preferences(app_handle) {
        Ok(prefs) => {
            println!("✓ User preferences loaded");
            if let Some(path) = &prefs.downloads_path {
                println!("  - Downloads path: {}", path);
            }
            println!("  - SteamTools: {}", if prefs.steamtools_enabled { "enabled" } else { "disabled" });
        }
        Err(e) => {
            eprintln!("Warning: Failed to load preferences: {}", e);
            // Don't fail initialization if preferences can't be loaded
            // They will be created with defaults on first access
        }
    }
    
    // TODO: Future enhancements (similar to Hydra)
    // - Resume queued downloads
    // - Clean up extracting status
    // - Seed completed torrents
    // - Check system paths availability
    
    println!("✓ Chaos Launcher initialized successfully");
    Ok(())
}

/// Cleanup function to run before app shutdown
pub fn cleanup_app() -> Result<(), String> {
    println!("Shutting down Chaos Launcher...");
    
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
    
    println!("✓ Chaos Launcher shut down successfully");
    Ok(())
}

