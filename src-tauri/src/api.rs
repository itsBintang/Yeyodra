use serde::{Deserialize, Serialize};
use reqwest;
use scraper::{Html, Selector};
use std::sync::Mutex;
use rand::seq::SliceRandom;
use chrono::Datelike;

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

#[derive(Debug, Serialize, Deserialize)]
pub struct GameStats {
    #[serde(rename = "downloadCount")]
    pub download_count: i64,
    #[serde(rename = "playerCount")]
    pub player_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<ShopAssets>,
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

// Global state for random game selection (like Hydra)
static RANDOM_GAME_STATE: Mutex<Option<RandomGameState>> = Mutex::new(None);

struct RandomGameState {
    games: Vec<Steam250Game>,
    index: usize,
}

pub async fn fetch_catalogue(category: &str) -> Result<Vec<CatalogueGame>, String> {
    let url = format!("{}/catalogue/{}?take=12&skip=0", API_URL, category);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Chaos Launcher v0.1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch catalogue: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error status: {}", response.status()));
    }

    let games = response
        .json::<Vec<CatalogueGame>>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(games)
}

pub async fn fetch_trending_games() -> Result<Vec<TrendingGame>, String> {
    // Hydra uses /catalogue/featured endpoint with language param
    let url = format!("{}/catalogue/featured?language=en", API_URL);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Chaos Launcher v0.1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch trending games: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error status: {}", response.status()));
    }

    let mut games = response
        .json::<Vec<TrendingGame>>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Hydra returns only the first game for hero banner
    games.truncate(1);

    Ok(games)
}

// Scrape steam250.com like Hydra does
async fn scrape_steam250(path: &str) -> Result<Vec<Steam250Game>, String> {
    let url = format!("https://steam250.com{}", path);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Chaos Launcher v0.1.0")
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

pub async fn fetch_game_stats(object_id: &str, shop: &str) -> Result<GameStats, String> {
    let url = format!("{}/games/{}/{}/stats", API_URL, shop, object_id);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Chaos Launcher v0.1.0")
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
    
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("User-Agent", "Chaos Launcher v0.1.0")
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
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Chaos Launcher v0.1.0")
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
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Chaos Launcher v0.1.0")
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ReleaseDate {
    pub coming_soon: bool,
    pub date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentDescriptors {
    pub ids: Vec<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Screenshot {
    pub id: u32,
    pub path_thumbnail: String,
    pub path_full: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoSource {
    pub max: String,
    #[serde(rename = "480")]
    pub quality_480: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Movie {
    pub id: u32,
    pub name: String,
    pub thumbnail: String,
    pub highlight: bool,
    pub webm: VideoSource,
    pub mp4: VideoSource,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Genre {
    pub id: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Category {
    pub id: u32,
    pub description: String,
}

pub async fn fetch_steam_app_details(
    object_id: &str,
    language: &str,
) -> Result<SteamAppDetails, String> {
    let url = format!(
        "http://store.steampowered.com/api/appdetails?appids={}&l={}",
        object_id, language
    );
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Chaos Launcher v0.1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Steam app details: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error status: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Steam API returns: { "appid": { "success": true, "data": {...} } }
    if let Some(app_data) = json.get(object_id) {
        if app_data.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            if let Some(data) = app_data.get("data") {
                let details: SteamAppDetails = serde_json::from_value(data.clone())
                    .map_err(|e| format!("Failed to deserialize app details: {}", e))?;
                return Ok(details);
            }
        }
    }

    Err("Game not found or invalid response".to_string())
}

