use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserPreferences {
    #[serde(rename = "downloadsPath", skip_serializing_if = "Option::is_none")]
    pub downloads_path: Option<String>,
    
    #[serde(rename = "steamPath", skip_serializing_if = "Option::is_none")]
    pub steam_path: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    
    #[serde(rename = "steamtoolsEnabled", default = "default_true")]
    pub steamtools_enabled: bool,
}

fn default_true() -> bool {
    true
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            downloads_path: None,
            steam_path: detect_steam_path(),
            language: Some("en".to_string()),
            steamtools_enabled: true,
        }
    }
}

/// Auto-detect Steam installation path from Windows Registry
#[cfg(target_os = "windows")]
fn detect_steam_path() -> Option<String> {
    // Try to read from HKEY_LOCAL_MACHINE first (64-bit)
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    if let Ok(steam_key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam") {
        if let Ok(install_path) = steam_key.get_value::<String, _>("InstallPath") {
            return Some(install_path);
        }
    }
    
    // Try 32-bit path
    if let Ok(steam_key) = hklm.open_subkey("SOFTWARE\\Valve\\Steam") {
        if let Ok(install_path) = steam_key.get_value::<String, _>("InstallPath") {
            return Some(install_path);
        }
    }
    
    // Try HKEY_CURRENT_USER
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(steam_key) = hkcu.open_subkey("Software\\Valve\\Steam") {
        if let Ok(install_path) = steam_key.get_value::<String, _>("SteamPath") {
            return Some(install_path);
        }
    }
    
    None
}

#[cfg(not(target_os = "windows"))]
fn detect_steam_path() -> Option<String> {
    // For Linux/Mac, check common Steam installation paths
    let possible_paths = vec![
        "~/.steam/steam",
        "~/.local/share/Steam",
        "/usr/local/share/Steam",
    ];
    
    for path in possible_paths {
        let expanded = shellexpand::tilde(path);
        if std::path::Path::new(expanded.as_ref()).exists() {
            return Some(expanded.to_string());
        }
    }
    
    None
}

fn get_preferences_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    Ok(app_data_dir.join("preferences.json"))
}

pub fn get_user_preferences(app_handle: &AppHandle) -> Result<UserPreferences, String> {
    let path = get_preferences_path(app_handle)?;
    
    if !path.exists() {
        return Ok(UserPreferences::default());
    }
    
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read preferences: {}", e))?;
    
    let preferences: UserPreferences = serde_json::from_str(&contents)
        .unwrap_or_else(|_| UserPreferences::default());
    
    Ok(preferences)
}

pub fn update_user_preferences(
    app_handle: &AppHandle,
    updates: UserPreferences,
) -> Result<UserPreferences, String> {
    let path = get_preferences_path(app_handle)?;
    
    // Read existing preferences
    let mut current = if path.exists() {
        let contents = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read preferences: {}", e))?;
        serde_json::from_str(&contents)
            .unwrap_or_else(|_| UserPreferences::default())
    } else {
        UserPreferences::default()
    };
    
    // Merge with new values (only update non-None fields)
    if updates.downloads_path.is_some() {
        current.downloads_path = updates.downloads_path;
    }
    if updates.steam_path.is_some() {
        current.steam_path = updates.steam_path;
    }
    if updates.language.is_some() {
        current.language = updates.language;
    }
    current.steamtools_enabled = updates.steamtools_enabled;
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create preferences directory: {}", e))?;
    }
    
    // Save to file
    let json = serde_json::to_string_pretty(&current)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;
    
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write preferences: {}", e))?;
    
    Ok(current)
}

