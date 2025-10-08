use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

/// Scanned game info from SteamTools
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScannedGame {
    pub app_id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub is_already_in_library: bool,
}

/// Scan result
#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub games: Vec<ScannedGame>,
    pub total_found: usize,
    pub already_in_library: usize,
}

/// Fetch game name from Steam Store API
async fn fetch_game_name(app_id: &str) -> Result<String> {
    let url = format!("https://store.steampowered.com/api/appdetails?appids={}", app_id);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;
    
    let response = client.get(&url).send().await?;
    let json: serde_json::Value = response.json().await?;
    
    if let Some(data) = json.get(app_id).and_then(|v| v.get("data")) {
        if let Some(name) = data.get("name").and_then(|v| v.as_str()) {
            return Ok(name.to_string());
        }
    }
    
    // Fallback: use App ID as name
    Ok(format!("Game {}", app_id))
}

/// Scan SteamTools folder for installed games (sync version - just collect App IDs)
pub fn scan_steam_library(app_handle: &AppHandle, custom_path: Option<String>) -> Result<ScanResult> {
    // Use custom path if provided, otherwise use default
    let steamtools_path = if let Some(path) = custom_path {
        PathBuf::from(path)
    } else {
        PathBuf::from(r"C:\Program Files (x86)\Steam\config\stplug-in")
    };
    
    if !steamtools_path.exists() {
        return Err(anyhow!("SteamTools folder not found at: {:?}", steamtools_path));
    }
    
    println!("[LibraryScanner] Scanning: {:?}", steamtools_path);
    
    let mut app_ids = Vec::new();
    
    // Read all files in the folder
    let entries = fs::read_dir(&steamtools_path)?;
    
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        
        // Only process *.lua files (e.g., 208650.lua, 239140.lua)
        if path.is_file() {
            if let Some(extension) = path.extension().and_then(|s| s.to_str()) {
                if extension == "lua" {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        // Only process numeric app IDs (skip files like "Steamtools.lua")
                        if stem.chars().all(|c| c.is_ascii_digit()) {
                            app_ids.push(stem.to_string());
                            println!("[LibraryScanner] Found AppID: {}", stem);
                        } else {
                            println!("[LibraryScanner] Skipping non-numeric file: {}", stem);
                        }
                    }
                }
            }
        }
    }
    
    println!("[LibraryScanner] ✓ Found {} App IDs", app_ids.len());
    
    // NOTE: Game names will be fetched async in frontend using fetch_game_names command
    // For now, return App IDs with placeholder names
    let mut scanned_games = Vec::new();
    
    for app_id in app_ids {
        let is_in_library = check_game_in_library(app_handle, &app_id);
        
        scanned_games.push(ScannedGame {
            app_id: app_id.clone(),
            title: format!("Game {}", app_id), // Placeholder - will be fetched async
            install_path: None,
            is_already_in_library: is_in_library,
        });
    }
    
    let already_in_library = scanned_games.iter().filter(|g| g.is_already_in_library).count();
    
    println!("[LibraryScanner] ✓ Scan complete: {} games found, {} already in library", 
        scanned_games.len(), already_in_library);
    
    Ok(ScanResult {
        total_found: scanned_games.len(),
        already_in_library,
        games: scanned_games,
    })
}

/// Check if game exists in library
fn check_game_in_library(app_handle: &AppHandle, app_id: &str) -> bool {
    use crate::library::get_game_from_library;
    
    match get_game_from_library(app_handle, "steam", app_id) {
        Ok(Some(_)) => true,  // Game exists
        _ => false,           // Game not found or error
    }
}

/// Fetch game names from Steam API (async batch operation)
pub async fn fetch_game_names_batch(app_ids: Vec<String>) -> Result<Vec<(String, String)>> {
    println!("[LibraryScanner] Fetching names for {} games", app_ids.len());
    
    let mut results = Vec::new();
    
    for app_id in app_ids {
        match fetch_game_name(&app_id).await {
            Ok(name) => {
                println!("[LibraryScanner] ✓ {}: {}", app_id, name);
                results.push((app_id, name));
            }
            Err(e) => {
                eprintln!("[LibraryScanner] ✗ Failed to fetch name for {}: {}", app_id, e);
                results.push((app_id.clone(), format!("Game {}", app_id)));
            }
        }
        
        // Small delay to avoid rate limiting
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    
    println!("[LibraryScanner] ✓ Fetched {} game names", results.len());
    Ok(results)
}

/// Import selected games to library
pub fn import_games_to_library(
    app_handle: &AppHandle,
    games: Vec<ScannedGame>,
) -> Result<usize> {
    use crate::library::{add_game_to_library, mark_game_as_installed};
    
    let mut imported_count = 0;
    
    for game in games {
        // Skip if already in library
        if game.is_already_in_library {
            println!("[LibraryScanner] Skipping (already in library): {}", game.title);
            continue;
        }
        
        println!("[LibraryScanner] Importing: {} (AppID: {})", game.title, game.app_id);
        
        match add_game_to_library(
            app_handle,
            "steam".to_string(),
            game.app_id.clone(),
            game.title.clone(),
        ) {
            Ok(_) => {
                // Mark as installed since it's from SteamTools
                if let Err(e) = mark_game_as_installed(app_handle, "steam", &game.app_id) {
                    eprintln!("[LibraryScanner] ⚠ Failed to mark as installed: {}", e);
                }
                
                imported_count += 1;
                println!("[LibraryScanner] ✓ Imported & marked as installed: {}", game.title);
            }
            Err(e) => {
                eprintln!("[LibraryScanner] ✗ Failed to import {}: {}", game.title, e);
            }
        }
    }
    
    println!("[LibraryScanner] ✓ Import complete: {} games imported", imported_count);
    Ok(imported_count)
}

