use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::api::{SteamAchievement, UnlockedAchievement, UserAchievement, fetch_game_achievements};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameAchievementData {
    pub achievements: Vec<SteamAchievement>,
    #[serde(rename = "unlockedAchievements")]
    pub unlocked_achievements: Vec<UnlockedAchievement>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64, // Unix timestamp
}

impl Default for GameAchievementData {
    fn default() -> Self {
        Self {
            achievements: Vec::new(),
            unlocked_achievements: Vec::new(),
            updated_at: 0,
        }
    }
}

fn get_achievement_file_path(app_handle: &AppHandle, shop: &str, object_id: &str) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let achievements_dir = app_data_dir.join("achievements");
    
    // Create directory if it doesn't exist
    if !achievements_dir.exists() {
        fs::create_dir_all(&achievements_dir)
            .map_err(|e| format!("Failed to create achievements directory: {}", e))?;
    }
    
    Ok(achievements_dir.join(format!("{}_{}.json", shop, object_id)))
}

/// Get achievement data from local storage
pub fn get_cached_achievement_data(app_handle: &AppHandle, shop: &str, object_id: &str) -> Result<Option<GameAchievementData>, String> {
    let file_path = get_achievement_file_path(app_handle, shop, object_id)?;
    
    if !file_path.exists() {
        return Ok(None);
    }
    
    let contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read achievement file: {}", e))?;
    
    let data: GameAchievementData = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse achievement data: {}", e))?;
    
    Ok(Some(data))
}

/// Save achievement data to local storage
pub fn save_achievement_data(
    app_handle: &AppHandle,
    shop: &str,
    object_id: &str,
    data: GameAchievementData,
) -> Result<(), String> {
    let file_path = get_achievement_file_path(app_handle, shop, object_id)?;
    
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize achievement data: {}", e))?;
    
    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write achievement file: {}", e))?;
    
    Ok(())
}

/// Fetch and merge achievements with local unlocked data
pub async fn get_game_achievements(
    app_handle: AppHandle,
    shop: String,
    object_id: String,
    language: String,
) -> Result<Vec<UserAchievement>, String> {
    const CACHE_EXPIRATION: i64 = 3600; // 1 hour in seconds
    
    let now = chrono::Utc::now().timestamp();
    
    // Try to get cached data
    let cached_data = get_cached_achievement_data(&app_handle, &shop, &object_id)?;
    
    // Check if we need to fetch new data
    let should_fetch = match &cached_data {
        None => true,
        Some(data) => (now - data.updated_at) > CACHE_EXPIRATION,
    };
    
    let achievements_data = if should_fetch {
        // Fetch fresh achievements from API
        let achievements = fetch_game_achievements(&object_id, &shop, &language).await?;
        
        // Preserve unlocked achievements from cache
        let unlocked = cached_data
            .as_ref()
            .map(|d| d.unlocked_achievements.clone())
            .unwrap_or_default();
        
        let new_data = GameAchievementData {
            achievements,
            unlocked_achievements: unlocked,
            updated_at: now,
        };
        
        // Save to cache
        save_achievement_data(&app_handle, &shop, &object_id, new_data.clone())?;
        
        new_data
    } else {
        cached_data.unwrap()
    };
    
    // Merge achievements with unlocked data
    let user_achievements = merge_achievements(achievements_data);
    
    Ok(user_achievements)
}

/// Merge achievements with unlocked data
fn merge_achievements(data: GameAchievementData) -> Vec<UserAchievement> {
    let mut user_achievements: Vec<UserAchievement> = data
        .achievements
        .into_iter()
        .map(|achievement| {
            let unlocked_data = data
                .unlocked_achievements
                .iter()
                .find(|u| u.name.eq_ignore_ascii_case(&achievement.name));
            
            if let Some(unlocked) = unlocked_data {
                UserAchievement {
                    name: achievement.name,
                    display_name: achievement.display_name,
                    description: achievement.description,
                    icon: achievement.icon,
                    icongray: achievement.icongray,
                    hidden: achievement.hidden,
                    points: achievement.points,
                    unlocked: true,
                    unlock_time: Some(unlocked.unlock_time),
                }
            } else {
                UserAchievement {
                    name: achievement.name,
                    display_name: achievement.display_name,
                    description: achievement.description,
                    icon: achievement.icon.clone(),
                    icongray: achievement.icongray,
                    hidden: achievement.hidden,
                    points: achievement.points,
                    unlocked: false,
                    unlock_time: None,
                }
            }
        })
        .collect();
    
    // Sort: unlocked first (by unlock time desc), then locked (hidden last)
    user_achievements.sort_by(|a, b| {
        match (a.unlocked, b.unlocked) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            (true, true) => {
                // Both unlocked: sort by unlock time descending
                b.unlock_time.cmp(&a.unlock_time)
            }
            (false, false) => {
                // Both locked: hidden achievements last
                a.hidden.cmp(&b.hidden)
            }
        }
    });
    
    user_achievements
}

/// Unlock an achievement (for future use when we track game progress)
pub fn unlock_achievement(
    app_handle: &AppHandle,
    shop: &str,
    object_id: &str,
    achievement_name: &str,
) -> Result<(), String> {
    let mut data = get_cached_achievement_data(app_handle, shop, object_id)?
        .unwrap_or_default();
    
    // Check if already unlocked
    let already_unlocked = data
        .unlocked_achievements
        .iter()
        .any(|a| a.name.eq_ignore_ascii_case(achievement_name));
    
    if !already_unlocked {
        let now = chrono::Utc::now().timestamp();
        data.unlocked_achievements.push(UnlockedAchievement {
            name: achievement_name.to_string(),
            unlock_time: now,
        });
        
        save_achievement_data(app_handle, shop, object_id, data)?;
    }
    
    Ok(())
}

