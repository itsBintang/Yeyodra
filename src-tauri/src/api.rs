use serde::{Deserialize, Serialize};
use reqwest;
use scraper::{Html, Selector};
use std::sync::{Mutex, OnceLock};
use rand::seq::SliceRandom;
use chrono::Datelike;
use std::time::Duration;
use crate::cache::{GameShopCache, GameStatsCache};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CatalogueGame {
    #[serde(rename = "objectId")]
    pub object_id: String,
    pub shop: String,
    pub title: String,
    #[serde(rename = "libraryImageUrl")]
    pub library_image_url: Option<String>,
    #[serde(rename = "backgroundImageUrl")]
    pub background_image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrendingGame {
    pub uri: String,
    #[serde(rename = "libraryHeroImageUrl", alias = "library_hero_image_url")]
    pub library_hero_image_url: String,
    #[serde(rename = "logoImageUrl", alias = "logo_image_url")]
    pub logo_image_url: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Steam250Game {
    #[serde(rename = "objectId")]
    pub object_id: String,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShopAssets {
    #[serde(rename = "objectId")]
    pub object_id: String,
    pub shop: String,
    pub title: String,
    #[serde(rename = "iconUrl")]
    pub icon_url: Option<String>,
    #[serde(rename = "libraryHeroImageUrl")]
    pub library_hero_image_url: Option<String>,
    #[serde(rename = "libraryImageUrl")]
    pub library_image_url: Option<String>,
    #[serde(rename = "logoImageUrl")]
    pub logo_image_url: Option<String>,
    #[serde(rename = "logoPosition")]
    pub logo_position: Option<String>,
    #[serde(rename = "coverImageUrl")]
    pub cover_image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameStats {
    #[serde(rename = "downloadCount", alias = "download_count")]
    pub download_count: i64,
    #[serde(rename = "playerCount", alias = "player_count")]
    pub player_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<ShopAssets>,
}

// Achievement Types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SteamAchievement {
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub icon: String,
    pub icongray: String,
    pub hidden: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub points: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnlockedAchievement {
    pub name: String,
    #[serde(rename = "unlockTime")]
    pub unlock_time: i64, // Unix timestamp in seconds
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAchievement {
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub icon: String,
    pub icongray: String,
    pub hidden: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub points: Option<i32>,
    pub unlocked: bool,
    #[serde(rename = "unlockTime")]
    pub unlock_time: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogueSearchPayload {
    pub title: String,
    #[serde(rename = "downloadSourceFingerprints")]
    pub download_source_fingerprints: Vec<String>,
    pub tags: Vec<i32>,
    pub publishers: Vec<String>,
    pub genres: Vec<String>,
    pub developers: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogueSearchResult {
    pub id: String,
    #[serde(rename = "objectId")]
    pub object_id: String,
    pub title: String,
    pub shop: String,
    pub genres: Vec<String>,
    #[serde(rename = "libraryImageUrl")]
    pub library_image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogueSearchResponse {
    pub edges: Vec<CatalogueSearchResult>,
    pub count: i64,
}

// API Base URL from environment or hardcoded
const API_URL: &str = "https://hydra-api-us-east-1.losbroxas.org";

// Shared HTTP client with timeout configuration (like Hydra)
// Using OnceLock for thread-safe lazy initialization
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(45)) // Increased to 45 seconds
            .connect_timeout(Duration::from_secs(15)) // Increased to 15 seconds
            .pool_max_idle_per_host(0) // Disable connection pooling to avoid keep-alive issues
            .tcp_keepalive(Duration::from_secs(60))
            .user_agent("Yeyodra Launcher v0.1.0")
            .build()
            .expect("Failed to create HTTP client")
    })
}

/// Helper function to retry requests with exponential backoff
async fn fetch_with_retry<T: for<'de> serde::de::Deserialize<'de>>(
    url: &str,
    max_retries: u32,
) -> Result<T, String> {
    let client = get_http_client();
    let mut last_error = String::new();
    
    for attempt in 0..=max_retries {
        if attempt > 0 {
            let delay = Duration::from_millis(500 * (2_u64.pow(attempt - 1)));
            println!("Retrying request to {} (attempt {}/{}), waiting {:?}", url, attempt + 1, max_retries + 1, delay);
            tokio::time::sleep(delay).await;
        }
        
        match client.get(url).send().await {
            Ok(response) => {
                match response.json::<T>().await {
                    Ok(data) => return Ok(data),
                    Err(e) => {
                        last_error = format!("Failed to parse response: {}", e);
                        if attempt == max_retries {
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                last_error = format!("Request failed: {}", e);
                // Don't retry on client errors (4xx), only on network/server errors
                if e.is_timeout() || e.is_connect() || e.status().map_or(true, |s| s.is_server_error()) {
                    if attempt == max_retries {
                        break;
                    }
                    continue;
                } else {
                    break;
                }
            }
        }
    }
    
    Err(last_error)
}

// Global state for random game selection (like Hydra)
static RANDOM_GAME_STATE: Mutex<Option<RandomGameState>> = Mutex::new(None);

struct RandomGameState {
    games: Vec<Steam250Game>,
    index: usize,
}

pub async fn fetch_catalogue(category: &str) -> Result<Vec<CatalogueGame>, String> {
    let url = format!("{}/catalogue/{}?take=12&skip=0", API_URL, category);
    fetch_with_retry::<Vec<CatalogueGame>>(&url, 2)
        .await
        .map_err(|e| format!("Failed to fetch catalogue: {}", e))
}

pub async fn fetch_trending_games() -> Result<Vec<TrendingGame>, String> {
    // Hydra uses /catalogue/featured endpoint with language param
    let url = format!("{}/catalogue/featured?language=en", API_URL);
    
    let mut games = fetch_with_retry::<Vec<TrendingGame>>(&url, 2)
        .await
        .map_err(|e| format!("Failed to fetch trending games: {}", e))?;

    // Hydra returns only the first game for hero banner
    games.truncate(1);

    Ok(games)
}

// Scrape steam250.com like Hydra does
async fn scrape_steam250(path: &str) -> Result<Vec<Steam250Game>, String> {
    let url = format!("https://steam250.com{}", path);
    
    let client = get_http_client();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch steam250: {}", e))?;

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let document = Html::parse_document(&html);
    let selector = Selector::parse("a[data-title]").unwrap();

    let games: Vec<Steam250Game> = document
        .select(&selector)
        .filter_map(|element| {
            let title = element.inner_html();
            let href = element.value().attr("href")?;
            
            // Extract Steam app ID from URL like "/app/123456"
            let parts: Vec<&str> = href.split('/').collect();
            let object_id = parts.last()?.to_string();

            Some(Steam250Game {
                object_id,
                title,
            })
        })
        .collect();

    Ok(games)
}

async fn get_steam250_list() -> Result<Vec<Steam250Game>, String> {
    // Same paths as Hydra
    let current_year = chrono::Utc::now().year();
    let paths = vec![
        "/hidden_gems".to_string(),
        format!("/{}", current_year),
        "/top250".to_string(),
        "/most_played".to_string(),
    ];

    let mut all_games = Vec::new();
    
    // Fetch all paths in parallel
    let results = futures::future::join_all(
        paths.iter().map(|path| scrape_steam250(path))
    ).await;

    for result in results {
        if let Ok(games) = result {
            all_games.extend(games);
        }
    }

    // Remove duplicates by objectId
    let mut unique_games = std::collections::HashMap::new();
    for game in all_games {
        unique_games.insert(game.object_id.clone(), game);
    }

    Ok(unique_games.into_values().collect())
}

pub async fn fetch_random_game() -> Result<Steam250Game, String> {
    // Check if we need to fetch games (release lock before await)
    let needs_fetch = {
        let state_lock = RANDOM_GAME_STATE.lock().unwrap();
        state_lock.is_none() || state_lock.as_ref().unwrap().games.is_empty()
    };
    
    // If games list is empty, fetch from steam250 (outside of lock)
    if needs_fetch {
        let games = get_steam250_list().await?;
        
        if games.is_empty() {
            return Err("No games found on steam250".to_string());
        }

        let mut shuffled_games = games;
        shuffled_games.shuffle(&mut rand::thread_rng());

        // Now acquire lock to update state
        let mut state_lock = RANDOM_GAME_STATE.lock().unwrap();
        *state_lock = Some(RandomGameState {
            games: shuffled_games,
            index: 0,
        });
    }

    // Get next game (acquire lock again)
    let mut state_lock = RANDOM_GAME_STATE.lock().unwrap();
    let state = state_lock.as_mut().unwrap();
    
    // Increment index
    state.index += 1;

    // Reset and reshuffle if we've gone through all games
    if state.index >= state.games.len() {
        state.index = 0;
        state.games.shuffle(&mut rand::thread_rng());
    }

    let game = state.games[state.index].clone();
    
    // Release lock before returning
    drop(state_lock);
    
    Ok(game)
}

/// Fetch game stats with caching (following Hydra's pattern)
pub async fn fetch_game_stats_cached(
    app_handle: &tauri::AppHandle,
    object_id: &str,
    shop: &str,
) -> Result<GameStats, String> {
    // Initialize cache
    let cache = GameStatsCache::new(app_handle)
        .map_err(|e| format!("Failed to initialize stats cache: {}", e))?;
    
    // Generate cache key for request deduplication
    let cache_key = format!("{}:{}", shop, object_id);
    
    // ZENITH PATTERN: Check if request already in progress
    let _request_lock = cache.get_or_create_request_lock(&cache_key).await;
    let _guard = _request_lock.lock().await;
    
    // HYDRA PATTERN: Try cache first (instant load)
    if let Ok(cached_stats) = cache.get::<GameStats>(shop, object_id) {
        // Cache hit - silent (too spammy if logged every time)
        
        // Remove lock before spawning background task
        drop(_guard);
        cache.remove_request_lock(&cache_key).await;
        
        // Background refresh (optional, like Hydra)
        let app_handle_clone = app_handle.clone();
        let object_id_clone = object_id.to_string();
        let shop_clone = shop.to_string();
        
        tokio::spawn(async move {
            // Silent background refresh
            if let Ok(cache) = GameStatsCache::new(&app_handle_clone) {
                // ZENITH: Throttle background refresh
                cache.throttle_request().await;
                
                if let Ok(fresh_stats) = fetch_game_stats_from_api(&object_id_clone, &shop_clone).await {
                    cache.reset_error_count().await;
                    let _ = cache.put(&shop_clone, &object_id_clone, fresh_stats);
                } else {
                    cache.record_error().await;
                }
            }
        });
        
        return Ok(cached_stats);
    }
    
    // ZENITH PATTERN: Check circuit breaker
    if cache.is_circuit_breaker_open().await {
        cache.remove_request_lock(&cache_key).await;
        return Err("Circuit breaker is open - too many consecutive errors. Please try again later.".to_string());
    }
    
    // ZENITH PATTERN: Throttle request
    cache.throttle_request().await;
    
    // CACHE MISS: Fetch from API
    let result = fetch_game_stats_from_api(object_id, shop).await;
    
    // ZENITH PATTERN: Handle result for circuit breaker
    match result {
        Ok(stats) => {
            cache.reset_error_count().await;
            
            // Save to cache (silent - too spammy)
            let _ = cache.put(shop, object_id, stats.clone());
            
            cache.remove_request_lock(&cache_key).await;
            Ok(stats)
        }
        Err(e) => {
            cache.record_error().await;
            cache.remove_request_lock(&cache_key).await;
            Err(e)
        }
    }
}

/// Internal function to fetch game stats from Hydra API
async fn fetch_game_stats_from_api(object_id: &str, shop: &str) -> Result<GameStats, String> {
    let url = format!("{}/games/{}/{}/stats", API_URL, shop, object_id);
    
    let client = get_http_client();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch game stats: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error status: {}", response.status()));
    }

    let stats = response
        .json::<GameStats>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(stats)
}

// Fetch achievements from Hydra API
pub async fn fetch_game_achievements(object_id: &str, shop: &str, language: &str) -> Result<Vec<SteamAchievement>, String> {
    let url = format!("{}/games/{}/{}/achievements?language={}", API_URL, shop, object_id, language);
    
    let client = get_http_client();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch game achievements: {}", e))?;

    if !response.status().is_success() {
        // If not found or error, return empty list instead of failing
        return Ok(Vec::new());
    }

    let achievements = response
        .json::<Vec<SteamAchievement>>()
        .await
        .map_err(|e| format!("Failed to parse achievements response: {}", e))?;

    Ok(achievements)
}

pub async fn search_games(
    payload: CatalogueSearchPayload,
    take: i32,
    skip: i32,
) -> Result<CatalogueSearchResponse, String> {
    let url = format!("{}/catalogue/search", API_URL);
    
    #[derive(Serialize)]
    struct SearchRequest {
        title: String,
        #[serde(rename = "downloadSourceFingerprints")]
        download_source_fingerprints: Vec<String>,
        tags: Vec<i32>,
        publishers: Vec<String>,
        genres: Vec<String>,
        developers: Vec<String>,
        take: i32,
        skip: i32,
    }
    
    let request_body = SearchRequest {
        title: payload.title,
        download_source_fingerprints: payload.download_source_fingerprints,
        tags: payload.tags,
        publishers: payload.publishers,
        genres: payload.genres,
        developers: payload.developers,
        take,
        skip,
    };
    
    let client = get_http_client();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to search games: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error status: {}", response.status()));
    }

    let search_response = response
        .json::<CatalogueSearchResponse>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(search_response)
}

pub async fn fetch_developers() -> Result<Vec<String>, String> {
    let url = format!("{}/catalogue/developers", API_URL);
    
    let client = get_http_client();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch developers: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error status: {}", response.status()));
    }

    let developers = response
        .json::<Vec<String>>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(developers)
}

pub async fn fetch_publishers() -> Result<Vec<String>, String> {
    let url = format!("{}/catalogue/publishers", API_URL);
    
    let client = get_http_client();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch publishers: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error status: {}", response.status()));
    }

    let publishers = response
        .json::<Vec<String>>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(publishers)
}

// Game Details Types - Minimal like Hydra
#[derive(Debug, Serialize, Deserialize)]
#[derive(Clone)]
pub struct SteamAppDetails {
    pub name: String,
    #[serde(rename = "steam_appid")]
    pub steam_app_id: u32,
    pub detailed_description: String,
    pub about_the_game: String,
    pub short_description: String,
    pub supported_languages: String,
    #[serde(default)]
    pub publishers: Vec<String>,
    #[serde(default)]
    pub genres: Vec<Genre>,
    #[serde(default)]
    pub screenshots: Vec<Screenshot>,
    #[serde(default)]
    pub movies: Vec<Movie>,
    #[serde(default)]
    pub header_image: Option<String>,
    #[serde(default)]
    pub capsule_image: Option<String>,
    #[serde(default)]
    pub pc_requirements: Requirements,
    #[serde(default)]
    pub mac_requirements: Requirements,
    #[serde(default)]
    pub linux_requirements: Requirements,
    pub release_date: ReleaseDate,
    pub content_descriptors: ContentDescriptors,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct Requirements {
    #[serde(default)]
    pub minimum: String,
    #[serde(default)]
    pub recommended: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseDate {
    pub coming_soon: bool,
    pub date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContentDescriptors {
    pub ids: Vec<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Screenshot {
    pub id: u32,
    pub path_thumbnail: String,
    pub path_full: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoSource {
    pub max: String,
    #[serde(rename = "480")]
    pub quality_480: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Movie {
    pub id: u32,
    pub name: String,
    pub thumbnail: String,
    pub highlight: bool,
    pub webm: VideoSource,
    pub mp4: VideoSource,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Genre {
    pub id: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Category {
    pub id: u32,
    pub description: String,
}

/// Fetch Steam app details with caching (following Hydra's pattern)
/// This is called from Tauri commands and needs app_handle for cache access
pub async fn fetch_steam_app_details_cached(
    app_handle: &tauri::AppHandle,
    object_id: &str,
    language: &str,
) -> Result<SteamAppDetails, String> {
    // Initialize cache
    let cache = GameShopCache::new(app_handle)
        .map_err(|e| format!("Failed to initialize cache: {}", e))?;
    
    // Generate cache key for request deduplication
    let cache_key = format!("steam:{}:{}", object_id, language);
    
    // ZENITH PATTERN: Check if request already in progress (request deduplication)
    let _request_lock = cache.get_or_create_request_lock(&cache_key).await;
    let _guard = _request_lock.lock().await; // Wait if another request is in progress
    
    // HYDRA PATTERN: Try cache first (instant load)
    if let Ok(cached_data) = cache.get::<SteamAppDetails>("steam", object_id, language) {
        // Cache hit - silent (too spammy if logged every time)
        
        // Remove lock before spawning background task
        drop(_guard);
        cache.remove_request_lock(&cache_key).await;
        
        // Spawn background task to refresh cache (optional, like Hydra)
        let app_handle_clone = app_handle.clone();
        let object_id_clone = object_id.to_string();
        let language_clone = language.to_string();
        
        tokio::spawn(async move {
            // Silent background refresh
            if let Ok(cache) = GameShopCache::new(&app_handle_clone) {
                // ZENITH: Throttle background refresh
                cache.throttle_request().await;
                
                if let Ok(fresh_data) = fetch_steam_app_details_from_api(&object_id_clone, &language_clone).await {
                    cache.reset_error_count().await;
                    let _ = cache.put("steam", &object_id_clone, &language_clone, fresh_data);
                } else {
                    cache.record_error().await;
                }
            }
        });
        
        return Ok(cached_data);
    }
    
    // ZENITH PATTERN: Check circuit breaker before making API call
    if cache.is_circuit_breaker_open().await {
        cache.remove_request_lock(&cache_key).await;
        return Err("Circuit breaker is open - too many consecutive errors. Please try again later.".to_string());
    }
    
    // ZENITH PATTERN: Throttle request to prevent rate limiting
    cache.throttle_request().await;
    
    // CACHE MISS: Fetch from API
    let result = fetch_steam_app_details_from_api(object_id, language).await;
    
    // ZENITH PATTERN: Handle result for circuit breaker
    match result {
        Ok(details) => {
            // Success: Reset error count
            cache.reset_error_count().await;
            
            // Save to cache for future use (silent - too spammy)
            let _ = cache.put("steam", object_id, language, details.clone());
            
            cache.remove_request_lock(&cache_key).await;
            Ok(details)
        }
        Err(e) => {
            // Error: Record for circuit breaker
            cache.record_error().await;
            cache.remove_request_lock(&cache_key).await;
            Err(e)
        }
    }
}

/// Internal function to fetch from Steam API (with retry logic)
async fn fetch_steam_app_details_from_api(
    object_id: &str,
    language: &str,
) -> Result<SteamAppDetails, String> {
    let url = format!(
        "http://store.steampowered.com/api/appdetails?appids={}&l={}",
        object_id, language
    );
    
    // Retry logic for Steam API (up to 3 attempts)
    let max_retries = 3;
    let client = get_http_client();
    let mut last_error = String::new();
    
    for attempt in 0..max_retries {
        if attempt > 0 {
            let delay = Duration::from_secs(2_u64.pow(attempt));
            println!("[API] Retrying Steam API (attempt {}/{}) after {:?}...", attempt + 1, max_retries, delay);
            tokio::time::sleep(delay).await;
        }
        
        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                
                // ZENITH PATTERN: Handle 429 Rate Limit
                if status.as_u16() == 429 {
                    last_error = format!("Rate limited by Steam API (429). Too many requests. Circuit breaker will activate.");
                    println!("[API] ⚠️ Steam API rate limit 429 (attempt {}/{})", attempt + 1, max_retries);
                    
                    // Don't retry immediately on 429 - let circuit breaker handle it
                    break;
                }
                
                // Handle 503 Service Unavailable - Steam API is down
                if status.as_u16() == 503 {
                    last_error = format!("Steam Store API is temporarily unavailable (503). This is a Steam server issue, not your connection. Please try again in a few minutes.");
                    println!("[API] Steam API returned 503 (attempt {}/{})", attempt + 1, max_retries);
                    
                    // Don't retry on 503 after first attempt - likely server maintenance
                    if attempt >= 1 {
                        break;
                    }
                    continue;
                }
                
                if !status.is_success() {
                    last_error = format!("Steam API returned error status: {} ({})", status.as_u16(), status.canonical_reason().unwrap_or("Unknown"));
                    continue;
                }
                
                match response.json::<serde_json::Value>().await {
                    Ok(json) => {
                        // Steam API returns: { "appid": { "success": true, "data": {...} } }
                        if let Some(app_data) = json.get(object_id) {
                            if app_data.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                                if let Some(data) = app_data.get("data") {
                                    match serde_json::from_value(data.clone()) {
                                        Ok(details) => return Ok(details),
                                        Err(e) => {
                                            last_error = format!("Failed to parse Steam app details: {}", e);
                                            continue;
                                        }
                                    }
                                }
                            }
                        }
                        last_error = "Game not found or invalid response from Steam".to_string();
                    }
                    Err(e) => {
                        last_error = format!("Failed to parse Steam API response: {}", e);
                        continue;
                    }
                }
            }
            Err(e) => {
                last_error = format!("Network error connecting to Steam API: {}", e);
                continue;
            }
        }
    }
    
    Err(last_error)
}

