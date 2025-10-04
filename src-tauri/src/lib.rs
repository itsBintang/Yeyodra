mod api;
mod library;
mod preferences;
mod aria2;
mod steamtools;
mod download_history;
mod steam_restart;

use api::{fetch_catalogue, fetch_trending_games, fetch_random_game, fetch_game_stats, search_games, fetch_developers, fetch_publishers, fetch_steam_app_details};
use api::{CatalogueGame, TrendingGame, Steam250Game, GameStats, CatalogueSearchPayload, CatalogueSearchResponse, SteamAppDetails};
use library::{LibraryGame, add_game_to_library as add_to_lib, get_game_from_library, get_all_library_games, remove_game_from_library, save_shop_assets, update_game_executable_path};
use preferences::{UserPreferences, get_user_preferences as get_prefs, update_user_preferences as update_prefs};
use aria2::{Aria2Client, DownloadStatus, GlobalStat};
use steamtools::{download_steamtools, DownloadResult};
use download_history::{CompletedDownload, save_completed_download, get_download_history, remove_from_history, clear_history};
use steam_restart::restart_steam;

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
async fn get_game_stats(object_id: String, shop: String) -> Result<GameStats, String> {
    fetch_game_stats(&object_id, &shop).await
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
async fn get_game_shop_details(object_id: String, language: String) -> Result<SteamAppDetails, String> {
    fetch_steam_app_details(&object_id, &language).await
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
    
    // If successful, save to download history
    if result.success {
        let completed_download = CompletedDownload {
            app_id: app_id.clone(),
            title: game_title,
            download_type: "SteamTools".to_string(),
            completed_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            icon_url,
        };
        
        if let Err(e) = save_completed_download(completed_download) {
            eprintln!("Failed to save download history: {}", e);
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

// Steam Restart Command
#[tauri::command]
async fn restart_steam_command() -> Result<String, String> {
    restart_steam().await.map_err(|e| e.to_string())
}

// Remove Game Command (removes SteamTools files)
#[tauri::command]
async fn remove_game(app_id: String) -> Result<DownloadResult, String> {
    steamtools::remove_game_files(&app_id).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize aria2c on app startup
    if let Err(e) = aria2::init() {
        eprintln!("Failed to initialize aria2c: {}", e);
    }

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
            remove_game
        ])
        .setup(|_app| {
            // Aria2 is already initialized above
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Cleanup: Shutdown aria2c when app exits
    if let Err(e) = aria2::shutdown() {
        eprintln!("Failed to shutdown aria2c: {}", e);
    }
}
