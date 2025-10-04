mod api;
mod library;

use api::{fetch_catalogue, fetch_trending_games, fetch_random_game, fetch_game_stats, search_games, fetch_developers, fetch_publishers, fetch_steam_app_details};
use api::{CatalogueGame, TrendingGame, Steam250Game, GameStats, CatalogueSearchPayload, CatalogueSearchResponse, SteamAppDetails};
use library::{LibraryGame, add_game_to_library as add_to_lib, get_game_from_library, get_all_library_games, remove_game_from_library, save_shop_assets, get_shop_assets};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            save_game_shop_assets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
