mod api;
mod library;
mod preferences;
mod aria2;
mod steamtools;
mod download_history;
mod steam_restart;
mod setup;
mod user_profile;
mod achievements;
mod dlc_cache;
mod game_launcher;
mod ludasavi;
mod cloud_sync;
mod lock;
mod cache;

use api::{fetch_catalogue, fetch_trending_games, fetch_random_game, fetch_game_stats_cached, search_games, fetch_developers, fetch_publishers, fetch_steam_app_details_cached, UserAchievement};
use api::{CatalogueGame, TrendingGame, Steam250Game, GameStats, CatalogueSearchPayload, CatalogueSearchResponse, SteamAppDetails};
use library::{LibraryGame, add_game_to_library as add_to_lib, add_custom_game_to_library as add_custom_to_lib, get_game_from_library, get_all_library_games, remove_game_from_library, save_shop_assets, update_game_executable_path, mark_game_as_installed};
use preferences::{UserPreferences, get_user_preferences as get_prefs, update_user_preferences as update_prefs};
use user_profile::{UserProfile, get_user_profile as get_profile, save_user_profile as save_profile, update_user_profile as update_profile};
use aria2::{Aria2Client, DownloadStatus, GlobalStat};
use steamtools::{download_steamtools, enable_game_update, disable_game_update, DownloadResult};
use download_history::{CompletedDownload, save_completed_download, get_download_history, remove_from_history, clear_history};
use steam_restart::restart_steam;
use achievements::get_game_achievements as get_achievements;
use dlc_cache::{DlcInfo, DlcCacheData, get_cached_dlc_data, save_dlc_cache_data, is_dlc_cache_valid};
use game_launcher::launch_game;
use ludasavi::{Ludasavi, LudusaviBackup};
use cloud_sync::{CloudSync};
use cache::{GameShopCache, GameStatsCache, CacheStats};
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_catalogue(category: String) -> Result<Vec<CatalogueGame>, String> {
    fetch_catalogue(&category).await
}

#[tauri::command]
async fn get_trending_games() -> Result<Vec<TrendingGame>, String> {
    fetch_trending_games().await
}

#[tauri::command]
async fn get_random_game() -> Result<Steam250Game, String> {
    fetch_random_game().await
}

#[tauri::command]
async fn get_game_stats(
    app_handle: tauri::AppHandle,
    object_id: String,
    shop: String,
) -> Result<GameStats, String> {
    fetch_game_stats_cached(&app_handle, &object_id, &shop).await
}

#[tauri::command]
async fn search_catalogue(
    payload: CatalogueSearchPayload,
    take: i32,
    skip: i32,
) -> Result<CatalogueSearchResponse, String> {
    search_games(payload, take, skip).await
}

#[tauri::command]
async fn get_developers() -> Result<Vec<String>, String> {
    fetch_developers().await
}

#[tauri::command]
async fn get_publishers() -> Result<Vec<String>, String> {
    fetch_publishers().await
}

#[tauri::command]
async fn get_game_shop_details(
    app_handle: tauri::AppHandle,
    object_id: String,
    language: String,
) -> Result<SteamAppDetails, String> {
    fetch_steam_app_details_cached(&app_handle, &object_id, &language).await
}

#[tauri::command]
fn add_game_to_library(
    app_handle: tauri::AppHandle,
    shop: String,
    object_id: String,
    title: String,
) -> Result<LibraryGame, String> {
    add_to_lib(&app_handle, shop, object_id, title)
}

#[tauri::command]
fn add_custom_game_to_library(
    app_handle: tauri::AppHandle,
    title: String,
    executable_path: String,
) -> Result<LibraryGame, String> {
    add_custom_to_lib(&app_handle, title, executable_path)
}

#[tauri::command]
fn get_library_game(
    app_handle: tauri::AppHandle,
    shop: String,
    object_id: String,
) -> Result<Option<LibraryGame>, String> {
    get_game_from_library(&app_handle, &shop, &object_id)
}

#[tauri::command]
fn get_library_games(app_handle: tauri::AppHandle) -> Result<Vec<LibraryGame>, String> {
    get_all_library_games(&app_handle)
}

#[tauri::command]
fn remove_library_game(
    app_handle: tauri::AppHandle,
    shop: String,
    object_id: String,
) -> Result<(), String> {
    remove_game_from_library(&app_handle, &shop, &object_id)
}

#[tauri::command]
fn save_game_shop_assets(
    app_handle: tauri::AppHandle,
    shop: String,
    object_id: String,
    assets: api::ShopAssets,
) -> Result<(), String> {
    save_shop_assets(&app_handle, shop, object_id, assets)
}

#[tauri::command]
fn get_user_preferences(app_handle: tauri::AppHandle) -> Result<UserPreferences, String> {
    get_prefs(&app_handle)
}

#[tauri::command]
fn update_user_preferences(
    app_handle: tauri::AppHandle,
    preferences: UserPreferences,
) -> Result<UserPreferences, String> {
    update_prefs(&app_handle, preferences)
}

#[tauri::command]
fn update_library_game_executable(
    app_handle: tauri::AppHandle,
    shop: String,
    object_id: String,
    executable_path: Option<String>,
) -> Result<LibraryGame, String> {
    update_game_executable_path(&app_handle, &shop, &object_id, executable_path)
}

// Aria2c Download Manager Commands
#[tauri::command]
async fn start_download(url: String, save_path: String, filename: Option<String>) -> Result<String, String> {
    let client = Aria2Client::new()?;
    
    let mut options = serde_json::Map::new();
    options.insert("dir".to_string(), serde_json::json!(save_path));
    
    if let Some(fname) = filename {
        options.insert("out".to_string(), serde_json::json!(fname));
    }
    
    let gid = client.add_uri(vec![url], Some(serde_json::Value::Object(options))).await?;
    Ok(gid)
}

#[tauri::command]
async fn pause_download(gid: String) -> Result<String, String> {
    let client = Aria2Client::new()?;
    client.pause(&gid).await
}

#[tauri::command]
async fn resume_download(gid: String) -> Result<String, String> {
    let client = Aria2Client::new()?;
    client.unpause(&gid).await
}

#[tauri::command]
async fn cancel_download(gid: String) -> Result<String, String> {
    let client = Aria2Client::new()?;
    client.remove(&gid).await
}

#[tauri::command]
async fn get_download_status(gid: String) -> Result<DownloadStatus, String> {
    let client = Aria2Client::new()?;
    client.tell_status(&gid).await
}

#[tauri::command]
async fn get_global_download_stat() -> Result<GlobalStat, String> {
    let client = Aria2Client::new()?;
    client.get_global_stat().await
}

// SteamTools Download Command
#[tauri::command]
async fn download_game_steamtools(
    app_handle: tauri::AppHandle,
    app_id: String,
    game_title: String,
    icon_url: Option<String>,
) -> Result<DownloadResult, String> {
    // Check if steamtools is enabled in preferences
    let prefs = get_prefs(&app_handle)?;
    
    if !prefs.steamtools_enabled {
        return Ok(DownloadResult {
            success: false,
            message: "SteamTools is disabled in settings".to_string(),
        });
    }
    
    let result = download_steamtools(&app_id).await.map_err(|e| e.to_string())?;
    
    // If successful, AUTO-ADD to library, save to download history, AND mark game as installed
    if result.success {
        println!("[DownloadHistory] Saving download for AppID: {}", app_id);
        
        let completed_download = CompletedDownload {
            app_id: app_id.clone(),
            title: game_title.clone(),
            download_type: "SteamTools".to_string(),
            completed_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            icon_url: icon_url.clone(),
        };
        
        match save_completed_download(completed_download) {
            Ok(_) => {
                println!("[DownloadHistory] ✓ Successfully saved to history: {}", game_title);
            }
            Err(e) => {
                eprintln!("[DownloadHistory] ✗ Failed to save download history: {}", e);
                // Continue anyway, don't fail the download
            }
        }
        
        // AUTO-ADD to library if not already there
        let game_in_library = match get_game_from_library(&app_handle, "steam", &app_id) {
            Ok(Some(_)) => true,  // Game exists and not deleted
            Ok(None) => false,     // Game not in library or is deleted
            Err(_) => false,       // Error reading library
        };
        
        if !game_in_library {
            println!("[Library] Game not in library, auto-adding: {}", game_title);
            
            // Add game to library
            match add_to_lib(&app_handle, "steam".to_string(), app_id.clone(), game_title.clone()) {
                Ok(_) => {
                    println!("[Library] ✓ Auto-added game to library: {}", game_title);
                    
                    // Try to fetch and save shop assets for better UI
                    match fetch_steam_app_details_cached(&app_handle, &app_id, "english").await {
                        Ok(shop_details) => {
                            let assets = api::ShopAssets {
                                object_id: app_id.clone(),
                                shop: "steam".to_string(),
                                title: game_title.clone(),
                                icon_url: shop_details.capsule_image.clone(),
                                library_hero_image_url: shop_details.header_image.clone(),
                                library_image_url: shop_details.header_image.clone(),
                                logo_image_url: None,
                                logo_position: None,
                                cover_image_url: None,
                            };
                            
                            if let Err(e) = save_shop_assets(&app_handle, "steam".to_string(), app_id.clone(), assets) {
                                eprintln!("[Library] ✗ Failed to save shop assets: {}", e);
                            } else {
                                println!("[Library] ✓ Saved shop assets for: {}", game_title);
                            }
                        }
                        Err(e) => {
                            eprintln!("[Library] ✗ Failed to fetch shop details for assets: {}", e);
                            // Fallback: use icon_url from download if available
                            if let Some(icon) = icon_url.clone() {
                                let fallback_assets = api::ShopAssets {
                                    object_id: app_id.clone(),
                                    shop: "steam".to_string(),
                                    title: game_title.clone(),
                                    icon_url: Some(icon),
                                    library_hero_image_url: None,
                                    library_image_url: None,
                                    logo_image_url: None,
                                    logo_position: None,
                                    cover_image_url: None,
                                };
                                let _ = save_shop_assets(&app_handle, "steam".to_string(), app_id.clone(), fallback_assets);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[Library] ✗ Failed to auto-add game to library: {}", e);
                    // Continue anyway
                }
            }
        } else {
            println!("[Library] Game already in library: {}", game_title);
        }
        
        // Mark game as installed
        match mark_game_as_installed(&app_handle, "steam", &app_id) {
            Ok(_) => {
                println!("[Library] ✓ Marked game as installed: {}", game_title);
            }
            Err(e) => {
                eprintln!("[Library] ✗ Failed to mark game as installed: {}", e);
                // Don't fail the download, just log the error
            }
        }
    }
    
    Ok(result)
}

// Download History Commands
#[tauri::command]
fn get_completed_downloads() -> Result<Vec<CompletedDownload>, String> {
    get_download_history().map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_completed_download(app_id: String, download_type: String) -> Result<(), String> {
    remove_from_history(&app_id, &download_type).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_download_history() -> Result<(), String> {
    clear_history().map_err(|e| e.to_string())
}

// Game Update Commands
#[tauri::command]
fn enable_update_for_game(app_id: String) -> Result<String, String> {
    enable_game_update(&app_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn disable_update_for_game(app_id: String) -> Result<String, String> {
    disable_game_update(&app_id).map_err(|e| e.to_string())
}

// Game Launcher Command
#[tauri::command]
fn launch_game_executable(executable_path: String) -> Result<String, String> {
    launch_game(&executable_path).map_err(|e| e.to_string())
}

// Steam Restart Command
#[tauri::command]
async fn restart_steam_command() -> Result<String, String> {
    restart_steam().await.map_err(|e| e.to_string())
}

// Aria2c Restart Command (for switching connection modes)
#[tauri::command]
async fn restart_aria2c(app_handle: tauri::AppHandle) -> Result<String, String> {
    let prefs = get_prefs(&app_handle)?;
    let max_connections = if prefs.low_connection_mode { 4 } else { 16 };
    
    aria2::restart_with_connections(max_connections)
        .map_err(|e| e.to_string())?;
    
    Ok(format!("Aria2c restarted with {} connections", max_connections))
}

// Cloud Save / Ludasavi Commands
#[tauri::command]
async fn get_game_backup_preview(
    app_handle: tauri::AppHandle,
    object_id: String,
    _shop: String,
) -> Result<LudusaviBackup, String> {
    // Run Ludusavi backup preview in background thread to prevent UI freeze
    let result = tauri::async_runtime::spawn_blocking(move || {
        let ludasavi = Ludasavi::new(app_handle.clone());
        
        // Get wine prefix from game if on Linux
        let wine_prefix: Option<String> = None; // TODO: Get from library game
        
        ludasavi.get_backup_preview(&object_id, wine_prefix.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?;
    
    result.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_ludusavi_manifest(
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Update manifest in background thread (network operation)
    let result = tauri::async_runtime::spawn_blocking(move || {
        let ludasavi = Ludasavi::new(app_handle.clone());
        ludasavi.update_manifest_database()
    })
    .await
    .map_err(|e| e.to_string())?;
    
    result.map_err(|e| e.to_string())?;
    Ok("Ludusavi manifest database updated successfully".to_string())
}

#[tauri::command]
async fn upload_save_game(
    app_handle: tauri::AppHandle,
    object_id: String,
    shop: String,
    download_option_title: Option<String>,
    label: Option<String>,
) -> Result<String, String> {
    let cloud_sync = CloudSync::new(app_handle.clone());
    
    // Get wine prefix from game if on Linux
    let wine_prefix: Option<String> = None; // TODO: Get from library game
    
    // Generate label if not provided
    let backup_label = label.or_else(|| Some(CloudSync::get_backup_label(false)));
    
    cloud_sync.upload_save_game(
        &object_id,
        &shop,
        download_option_title.as_deref(),
        backup_label.as_deref(),
        wine_prefix.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;
    
    Ok("Backup uploaded successfully".to_string())
}

#[tauri::command]
async fn download_game_artifact(
    app_handle: tauri::AppHandle,
    object_id: String,
    shop: String,
    game_artifact_id: String,
) -> Result<String, String> {
    // LOCAL-ONLY MODE: Restore from local backup
    let cloud_sync = CloudSync::new(app_handle);
    
    cloud_sync.restore_from_local_backup(&game_artifact_id, &object_id, &shop)
        .map_err(|e| e.to_string())?;
    
    Ok("Backup restored successfully".to_string())
}

#[tauri::command]
async fn get_game_artifacts(
    app_handle: tauri::AppHandle,
    object_id: String,
    shop: String,
) -> Result<Vec<cloud_sync::LocalBackup>, String> {
    // LOCAL-ONLY MODE: Return local backups instead of API artifacts
    let cloud_sync = CloudSync::new(app_handle.clone());
    
    cloud_sync.list_local_backups(&object_id, &shop)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn select_game_backup_path(
    app_handle: tauri::AppHandle,
    _shop: String,
    object_id: String,
    backup_path: Option<String>,
) -> Result<String, String> {
    let ludasavi = Ludasavi::new(app_handle);
    
    ludasavi.add_custom_game(&object_id, backup_path.as_deref())
        .map_err(|e| e.to_string())?;
    
    Ok("Custom backup path set successfully".to_string())
}

#[tauri::command]
async fn delete_game_artifact(
    app_handle: tauri::AppHandle,
    game_artifact_id: String,
) -> Result<String, String> {
    // LOCAL-ONLY MODE: Delete local backup
    let cloud_sync = CloudSync::new(app_handle);
    
    cloud_sync.delete_local_backup(&game_artifact_id)
        .map_err(|e| e.to_string())?;
    
    Ok("Backup deleted successfully".to_string())
}

#[tauri::command]
async fn copy_backup_to_path(
    app_handle: tauri::AppHandle,
    backup_id: String,
    destination_path: String,
) -> Result<String, String> {
    let cloud_sync = CloudSync::new(app_handle);
    
    cloud_sync.copy_backup_to_path(&backup_id, &destination_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_artifact_freeze(
    _app_handle: tauri::AppHandle,
    game_artifact_id: String,
    freeze: bool,
) -> Result<String, String> {
    // TODO: Implement API call to toggle freeze
    Ok(format!("Artifact {} freeze status: {}", game_artifact_id, freeze))
}

#[tauri::command]
async fn rename_game_artifact(
    _app_handle: tauri::AppHandle,
    game_artifact_id: String,
    label: String,
) -> Result<String, String> {
    // TODO: Implement API call to rename artifact
    Ok(format!("Artifact {} renamed to {}", game_artifact_id, label))
}

#[tauri::command]
async fn import_backup_file(
    app_handle: tauri::AppHandle,
    source_file_path: String,
    object_id: String,
) -> Result<String, String> {
    let cloud_sync = CloudSync::new(app_handle);
    
    let backup_id = cloud_sync.import_backup_file(&source_file_path, &object_id)
        .map_err(|e| e.to_string())?;
    
    Ok(backup_id)
}

// Remove Game Command (removes SteamTools files AND marks game as not installed)
#[tauri::command]
async fn remove_game(app_handle: tauri::AppHandle, app_id: String) -> Result<DownloadResult, String> {
    let result = steamtools::remove_game_files(&app_id).await.map_err(|e| e.to_string())?;
    
    // If removal was successful, mark game as not installed in library
    if result.success {
        // Try to get the game from library and mark as not installed
        if let Ok(Some(mut game)) = get_game_from_library(&app_handle, "steam", &app_id) {
            game.is_installed = false;
            
            // Save updated game back to library
            let game_path = app_handle
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data directory: {}", e))?
                .join("library")
                .join(format!("{}_{}.json", game.shop, game.object_id));
            
            let json = serde_json::to_string_pretty(&game)
                .map_err(|e| format!("Failed to serialize game: {}", e))?;
            
            std::fs::write(&game_path, json)
                .map_err(|e| format!("Failed to write game file: {}", e))?;
        }
    }
    
    Ok(result)
}

// User Profile Commands
#[tauri::command]
fn get_user_profile(app_handle: tauri::AppHandle) -> Result<UserProfile, String> {
    get_profile(&app_handle)
}

#[tauri::command]
fn save_user_profile_data(
    app_handle: tauri::AppHandle,
    profile: UserProfile,
) -> Result<UserProfile, String> {
    save_profile(&app_handle, profile)
}

#[tauri::command]
fn update_user_profile_data(
    app_handle: tauri::AppHandle,
    profile: UserProfile,
) -> Result<UserProfile, String> {
    update_profile(&app_handle, profile)
}

// Achievement Commands
#[tauri::command]
async fn get_game_achievements_command(
    app_handle: tauri::AppHandle,
    shop: String,
    object_id: String,
    language: String,
) -> Result<Vec<UserAchievement>, String> {
    get_achievements(app_handle, shop, object_id, language).await
}

// DLC Commands
#[tauri::command]
async fn get_game_dlcs_with_cache(
    app_handle: tauri::AppHandle,
    app_id: String,
) -> Result<Vec<DlcInfo>, String> {
    // Try to get cached data first
    if let Ok(Some(cache_data)) = get_cached_dlc_data(&app_handle, &app_id) {
        if is_dlc_cache_valid(&cache_data) {
            println!("Using cached DLC data for AppID: {}", app_id);
            return Ok(cache_data.dlc_list);
        }
    }
    
    // Cache miss or expired - fetch from API
    println!("Fetching fresh DLC data for AppID: {}", app_id);
    
    // Get DLC IDs from Steam API
    let dlc_ids = steamtools::get_game_dlc_list(&app_id)
        .await
        .map_err(|e| e.to_string())?;
    
    if dlc_ids.is_empty() {
        return Ok(Vec::new());
    }
    
    // Batch fetch DLC details
    let dlc_details = steamtools::batch_fetch_dlc_details(dlc_ids)
        .await
        .map_err(|e| e.to_string())?;
    
    // Convert to DlcInfo format
    let dlc_list: Vec<DlcInfo> = dlc_details
        .into_iter()
        .map(|(app_id, name, header_image)| DlcInfo {
            app_id,
            name,
            header_image,
        })
        .collect();
    
    // Save to cache
    let cache_data = DlcCacheData {
        main_app_id: app_id.clone(),
        dlc_list: dlc_list.clone(),
        updated_at: chrono::Utc::now().timestamp(),
    };
    
    if let Err(e) = save_dlc_cache_data(&app_handle, &app_id, cache_data) {
        eprintln!("Failed to save DLC cache: {}", e);
        // Don't fail the request, just log the error
    }
    
    Ok(dlc_list)
}

#[tauri::command]
fn get_installed_dlc_list(app_id: String) -> Result<Vec<String>, String> {
    steamtools::get_installed_dlcs(&app_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn sync_dlc_selection(
    app_id: String,
    selected_dlc_ids: Vec<String>,
) -> Result<String, String> {
    steamtools::sync_dlcs_to_lua(&app_id, selected_dlc_ids).map_err(|e| e.to_string())
}

// Cache Management Commands (following Hydra's pattern)
#[tauri::command]
fn clear_shop_details_cache(app_handle: tauri::AppHandle) -> Result<String, String> {
    let cache = GameShopCache::new(&app_handle)
        .map_err(|e| e.to_string())?;
    
    cache.clear_all()
        .map_err(|e| e.to_string())?;
    
    Ok("Shop details cache cleared successfully".to_string())
}

#[tauri::command]
fn clear_game_stats_cache(app_handle: tauri::AppHandle) -> Result<String, String> {
    let cache = GameStatsCache::new(&app_handle)
        .map_err(|e| e.to_string())?;
    
    cache.clear_all()
        .map_err(|e| e.to_string())?;
    
    Ok("Game stats cache cleared successfully".to_string())
}

#[tauri::command]
fn get_cache_stats(app_handle: tauri::AppHandle) -> Result<CacheStats, String> {
    let cache = GameShopCache::new(&app_handle)
        .map_err(|e| e.to_string())?;
    
    cache.get_stats()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_all_caches(app_handle: tauri::AppHandle) -> Result<String, String> {
    // Clear shop details cache
    if let Ok(shop_cache) = GameShopCache::new(&app_handle) {
        let _ = shop_cache.clear_all();
    }
    
    // Clear stats cache
    if let Ok(stats_cache) = GameStatsCache::new(&app_handle) {
        let _ = stats_cache.clear_all();
    }
    
    Ok("All caches cleared successfully".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_catalogue,
            get_trending_games,
            get_random_game,
            get_game_stats,
            search_catalogue,
            get_developers,
            get_publishers,
            get_game_shop_details,
            add_game_to_library,
            add_custom_game_to_library,
            get_library_game,
            get_library_games,
            remove_library_game,
            save_game_shop_assets,
            get_user_preferences,
            update_user_preferences,
            update_library_game_executable,
            start_download,
            pause_download,
            resume_download,
            cancel_download,
            get_download_status,
            get_global_download_stat,
            download_game_steamtools,
            get_completed_downloads,
            remove_completed_download,
            clear_download_history,
            restart_steam_command,
            remove_game,
            get_user_profile,
            save_user_profile_data,
            update_user_profile_data,
            get_game_achievements_command,
            get_game_dlcs_with_cache,
            get_installed_dlc_list,
            sync_dlc_selection,
            enable_update_for_game,
            disable_update_for_game,
            launch_game_executable,
            restart_aria2c,
            get_game_backup_preview,
            upload_save_game,
            download_game_artifact,
            get_game_artifacts,
            select_game_backup_path,
            delete_game_artifact,
            copy_backup_to_path,
            toggle_artifact_freeze,
            rename_game_artifact,
            import_backup_file,
            clear_shop_details_cache,
            clear_game_stats_cache,
            get_cache_stats,
            clear_all_caches,
            update_ludusavi_manifest
        ])
        .setup(|app| {
            // Initialize app state (similar to Hydra's loadState)
            if let Err(e) = setup::initialize_app(app.handle()) {
                eprintln!("Failed to initialize app: {}", e);
                // Don't prevent app from starting, just log the error
            }
            Ok(())
        })
        .on_window_event(|_window, event| {
            // Handle window close event for cleanup
            if let tauri::WindowEvent::Destroyed = event {
                if let Err(e) = setup::cleanup_app() {
                    eprintln!("Failed to cleanup app: {}", e);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
