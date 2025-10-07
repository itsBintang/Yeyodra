use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::api::ShopAssets;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryGame {
    pub id: String,
    pub title: String,
    #[serde(rename = "objectId", alias = "object_id")]
    pub object_id: String,
    pub shop: String,
    #[serde(rename = "iconUrl", alias = "icon_url")]
    pub icon_url: Option<String>,
    #[serde(rename = "coverImageUrl", alias = "cover_image_url")]
    pub cover_image_url: Option<String>,
    #[serde(rename = "libraryHeroImageUrl", alias = "library_hero_image_url")]
    pub library_hero_image_url: Option<String>,
    #[serde(rename = "logoImageUrl", alias = "logo_image_url")]
    pub logo_image_url: Option<String>,
    #[serde(rename = "playTimeInSeconds", alias = "play_time_in_seconds")]
    pub play_time_in_seconds: i64,
    #[serde(rename = "lastTimePlayed", alias = "last_time_played")]
    pub last_time_played: Option<String>,
    #[serde(rename = "isDeleted", alias = "is_deleted")]
    pub is_deleted: bool,
    pub favorite: bool,
    #[serde(rename = "isPinned", alias = "is_pinned")]
    pub is_pinned: bool,
    #[serde(rename = "executablePath", alias = "executable_path")]
    pub executable_path: Option<String>,
    #[serde(rename = "launchOptions", alias = "launch_options")]
    pub launch_options: Option<String>,
    #[serde(rename = "isInstalled", alias = "is_installed", default)]
    pub is_installed: bool,
}

fn get_library_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let library_dir = app_data_dir.join("library");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&library_dir)
        .map_err(|e| format!("Failed to create library directory: {}", e))?;
    
    Ok(library_dir)
}

fn get_assets_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let assets_dir = app_data_dir.join("shop_assets");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;
    
    Ok(assets_dir)
}

fn get_asset_file_path(app_handle: &AppHandle, shop: &str, object_id: &str) -> Result<PathBuf, String> {
    let assets_dir = get_assets_path(app_handle)?;
    let asset_id = format!("{}_{}", shop, object_id);
    Ok(assets_dir.join(format!("{}.json", asset_id)))
}

fn get_game_file_path(app_handle: &AppHandle, shop: &str, object_id: &str) -> Result<PathBuf, String> {
    let library_dir = get_library_path(app_handle)?;
    let game_id = format!("{}_{}", shop, object_id);
    Ok(library_dir.join(format!("{}.json", game_id)))
}

// Add a custom game to the library with executable path
pub fn add_custom_game_to_library(
    app_handle: &AppHandle,
    title: String,
    executable_path: String,
) -> Result<LibraryGame, String> {
    let shop = "custom".to_string();
    let object_id = uuid::Uuid::new_v4().to_string();
    
    // Check if game with same executable already exists
    let all_games = get_all_library_games(app_handle)?;
    if let Some(existing) = all_games.iter().find(|g| {
        g.executable_path.as_ref() == Some(&executable_path) && !g.is_deleted
    }) {
        return Err(format!("A game with this executable already exists: {}", existing.title));
    }
    
    let game_path = get_game_file_path(app_handle, &shop, &object_id)?;
    
    let id = format!("{}_{}", shop, object_id);
    
    // Create the game
    let game = LibraryGame {
        id,
        title: title.clone(),
        object_id: object_id.clone(),
        shop: shop.clone(),
        icon_url: None,
        cover_image_url: None,
        library_hero_image_url: None,
        logo_image_url: None,
        play_time_in_seconds: 0,
        last_time_played: None,
        is_deleted: false,
        favorite: false,
        is_pinned: false,
        executable_path: Some(executable_path),
        launch_options: None,
        is_installed: true, // Custom games are always "installed"
    };
    
    // Save the game
    let json = serde_json::to_string_pretty(&game)
        .map_err(|e| format!("Failed to serialize game: {}", e))?;
    
    std::fs::write(&game_path, json)
        .map_err(|e| format!("Failed to save game: {}", e))?;
    
    Ok(game)
}

pub fn add_game_to_library(
    app_handle: &AppHandle,
    shop: String,
    object_id: String,
    title: String,
) -> Result<LibraryGame, String> {
    let game_path = get_game_file_path(app_handle, &shop, &object_id)?;
    
    // Get shop assets if available, or fetch from API if not cached
    let mut game_assets = get_shop_assets(app_handle, &shop, &object_id).unwrap_or(None);
    
    // If assets not cached, try to fetch from API
    if game_assets.is_none() {
        use crate::api::fetch_game_stats_cached;
        use tokio::runtime::Runtime;
        
        let rt = Runtime::new().map_err(|e| format!("Failed to create runtime: {}", e))?;
        if let Ok(stats) = rt.block_on(fetch_game_stats_cached(app_handle, &object_id, &shop)) {
            if let Some(assets) = stats.assets {
                // Save assets for future use
                let _ = save_shop_assets(app_handle, shop.clone(), object_id.clone(), assets.clone());
                game_assets = Some(assets);
            }
        }
    }
    
    // Check if game already exists
    let game = if game_path.exists() {
        let contents = fs::read_to_string(&game_path)
            .map_err(|e| format!("Failed to read game file: {}", e))?;
        let mut existing_game: LibraryGame = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse game data: {}", e))?;
        
        // Restore if was deleted
        existing_game.is_deleted = false;
        existing_game
    } else {
        // Create new game entry with assets from shop
        let game_id = format!("{}_{}", shop, object_id);
        
        // Generate coverImageUrl from Steam's standard pattern if not in assets
        let cover_image_url = game_assets
            .as_ref()
            .and_then(|a| a.cover_image_url.clone())
            .or_else(|| {
                if shop == "steam" {
                    Some(format!(
                        "https://shared.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900.jpg",
                        object_id
                    ))
                } else {
                    None
                }
            });
        
        LibraryGame {
            id: game_id,
            title,
            object_id,
            shop,
            icon_url: game_assets.as_ref().and_then(|a| a.icon_url.clone()),
            cover_image_url,
            library_hero_image_url: game_assets.as_ref().and_then(|a| a.library_hero_image_url.clone()),
            logo_image_url: game_assets.as_ref().and_then(|a| a.logo_image_url.clone()),
            play_time_in_seconds: 0,
            last_time_played: None,
            is_deleted: false,
            favorite: false,
            is_pinned: false,
            executable_path: None,
            launch_options: None,
            is_installed: false,
        }
    };
    
    // Save game to file
    let json = serde_json::to_string_pretty(&game)
        .map_err(|e| format!("Failed to serialize game: {}", e))?;
    
    fs::write(&game_path, json)
        .map_err(|e| format!("Failed to write game file: {}", e))?;
    
    Ok(game)
}

pub fn get_game_from_library(
    app_handle: &AppHandle,
    shop: &str,
    object_id: &str,
) -> Result<Option<LibraryGame>, String> {
    let game_path = get_game_file_path(app_handle, shop, object_id)?;
    
    if !game_path.exists() {
        return Ok(None);
    }
    
    let contents = fs::read_to_string(&game_path)
        .map_err(|e| format!("Failed to read game file: {}", e))?;
    
    let game: LibraryGame = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse game data: {}", e))?;
    
    // Return None if game is deleted
    if game.is_deleted {
        return Ok(None);
    }
    
    Ok(Some(game))
}

pub fn get_all_library_games(app_handle: &AppHandle) -> Result<Vec<LibraryGame>, String> {
    let library_dir = get_library_path(app_handle)?;
    
    let mut games = Vec::new();
    
    let entries = fs::read_dir(&library_dir)
        .map_err(|e| format!("Failed to read library directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let contents = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read game file: {}", e))?;
            
            if let Ok(game) = serde_json::from_str::<LibraryGame>(&contents) {
                if !game.is_deleted {
                    games.push(game);
                }
            }
        }
    }
    
    Ok(games)
}

pub fn update_game_executable_path(
    app_handle: &AppHandle,
    shop: &str,
    object_id: &str,
    executable_path: Option<String>,
) -> Result<LibraryGame, String> {
    let game_path = get_game_file_path(app_handle, shop, object_id)?;
    
    if !game_path.exists() {
        return Err("Game not found in library".to_string());
    }
    
    let contents = fs::read_to_string(&game_path)
        .map_err(|e| format!("Failed to read game file: {}", e))?;
    
    let mut game: LibraryGame = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse game data: {}", e))?;
    
    game.executable_path = executable_path;
    
    let json = serde_json::to_string_pretty(&game)
        .map_err(|e| format!("Failed to serialize game: {}", e))?;
    
    fs::write(&game_path, json)
        .map_err(|e| format!("Failed to write game file: {}", e))?;
    
    Ok(game)
}

/// Mark game as installed after successful download
pub fn mark_game_as_installed(
    app_handle: &AppHandle,
    shop: &str,
    object_id: &str,
) -> Result<LibraryGame, String> {
    let game_path = get_game_file_path(app_handle, shop, object_id)?;
    
    if !game_path.exists() {
        return Err("Game not found in library".to_string());
    }
    
    let contents = fs::read_to_string(&game_path)
        .map_err(|e| format!("Failed to read game file: {}", e))?;
    
    let mut game: LibraryGame = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse game data: {}", e))?;
    
    game.is_installed = true;
    
    let json = serde_json::to_string_pretty(&game)
        .map_err(|e| format!("Failed to serialize game: {}", e))?;
    
    fs::write(&game_path, json)
        .map_err(|e| format!("Failed to write game file: {}", e))?;
    
    Ok(game)
}

pub fn remove_game_from_library(
    app_handle: &AppHandle,
    shop: &str,
    object_id: &str,
) -> Result<(), String> {
    let game_path = get_game_file_path(app_handle, shop, object_id)?;
    
    if game_path.exists() {
        let contents = fs::read_to_string(&game_path)
            .map_err(|e| format!("Failed to read game file: {}", e))?;
        
        let mut game: LibraryGame = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse game data: {}", e))?;
        
        // Mark as deleted instead of actually deleting
        game.is_deleted = true;
        
        let json = serde_json::to_string_pretty(&game)
            .map_err(|e| format!("Failed to serialize game: {}", e))?;
        
        fs::write(&game_path, json)
            .map_err(|e| format!("Failed to write game file: {}", e))?;
    }
    
    Ok(())
}

pub fn save_shop_assets(
    app_handle: &AppHandle,
    shop: String,
    object_id: String,
    assets: ShopAssets,
) -> Result<(), String> {
    let asset_path = get_asset_file_path(app_handle, &shop, &object_id)?;
    
    let json = serde_json::to_string_pretty(&assets)
        .map_err(|e| format!("Failed to serialize assets: {}", e))?;
    
    fs::write(&asset_path, json)
        .map_err(|e| format!("Failed to write assets file: {}", e))?;
    
    Ok(())
}

pub fn get_shop_assets(
    app_handle: &AppHandle,
    shop: &str,
    object_id: &str,
) -> Result<Option<ShopAssets>, String> {
    let asset_path = get_asset_file_path(app_handle, shop, object_id)?;
    
    if !asset_path.exists() {
        return Ok(None);
    }
    
    let contents = fs::read_to_string(&asset_path)
        .map_err(|e| format!("Failed to read assets file: {}", e))?;
    
    let assets: ShopAssets = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse assets data: {}", e))?;
    
    Ok(Some(assets))
}

