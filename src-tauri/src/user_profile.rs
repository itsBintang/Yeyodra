use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "profileImageUrl", skip_serializing_if = "Option::is_none")]
    pub profile_image_url: Option<String>,
    #[serde(rename = "backgroundImageUrl", skip_serializing_if = "Option::is_none")]
    pub background_image_url: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

impl Default for UserProfile {
    fn default() -> Self {
        Self {
            id: "local-user".to_string(),
            display_name: "Yeyodra User".to_string(),
            profile_image_url: None,
            background_image_url: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

fn get_user_profile_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    Ok(app_data_dir.join("user_profile.json"))
}

pub fn get_user_profile(app_handle: &AppHandle) -> Result<UserProfile, String> {
    let path = get_user_profile_path(app_handle)?;
    
    if !path.exists() {
        // Create default profile
        let default_profile = UserProfile::default();
        save_user_profile(app_handle, default_profile.clone())?;
        return Ok(default_profile);
    }
    
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read user profile: {}", e))?;
    
    let profile: UserProfile = serde_json::from_str(&contents)
        .unwrap_or_else(|_| UserProfile::default());
    
    Ok(profile)
}

pub fn save_user_profile(
    app_handle: &AppHandle,
    profile: UserProfile,
) -> Result<UserProfile, String> {
    let path = get_user_profile_path(app_handle)?;
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create profile directory: {}", e))?;
    }
    
    // Save to file
    let json = serde_json::to_string_pretty(&profile)
        .map_err(|e| format!("Failed to serialize profile: {}", e))?;
    
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write profile: {}", e))?;
    
    Ok(profile)
}

pub fn update_user_profile(
    app_handle: &AppHandle,
    updates: UserProfile,
) -> Result<UserProfile, String> {
    // For simplicity, just save the entire profile
    // Could be more granular if needed
    save_user_profile(app_handle, updates)
}

