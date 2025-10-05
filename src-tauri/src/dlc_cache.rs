use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DlcInfo {
    #[serde(rename = "appId")]
    pub app_id: String,
    pub name: String,
    #[serde(rename = "headerImage")]
    pub header_image: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DlcCacheData {
    #[serde(rename = "mainAppId")]
    pub main_app_id: String,
    #[serde(rename = "dlcList")]
    pub dlc_list: Vec<DlcInfo>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

// Cache expires after 24 hours (DLC lists rarely change)
const DLC_CACHE_EXPIRATION: i64 = 86400;

/// Get DLC cache directory path
fn get_dlc_cache_dir(app_handle: &AppHandle) -> Result<PathBuf> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
    
    let dlc_dir = app_data_dir.join("dlc");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&dlc_dir)
        .map_err(|e| anyhow::anyhow!("Failed to create DLC cache directory: {}", e))?;
    
    Ok(dlc_dir)
}

/// Get DLC cache file path
fn get_dlc_cache_file_path(app_handle: &AppHandle, app_id: &str) -> Result<PathBuf> {
    let dlc_dir = get_dlc_cache_dir(app_handle)?;
    Ok(dlc_dir.join(format!("{}.json", app_id)))
}

/// Get cached DLC data
pub fn get_cached_dlc_data(
    app_handle: &AppHandle,
    app_id: &str,
) -> Result<Option<DlcCacheData>> {
    let file_path = get_dlc_cache_file_path(app_handle, app_id)?;
    
    if !file_path.exists() {
        return Ok(None);
    }
    
    let contents = fs::read_to_string(&file_path)
        .map_err(|e| anyhow::anyhow!("Failed to read DLC cache file: {}", e))?;
    
    let data: DlcCacheData = serde_json::from_str(&contents)
        .map_err(|e| anyhow::anyhow!("Failed to parse DLC cache data: {}", e))?;
    
    Ok(Some(data))
}

/// Save DLC data to cache
pub fn save_dlc_cache_data(
    app_handle: &AppHandle,
    app_id: &str,
    data: DlcCacheData,
) -> Result<()> {
    let file_path = get_dlc_cache_file_path(app_handle, app_id)?;
    
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| anyhow::anyhow!("Failed to serialize DLC cache data: {}", e))?;
    
    fs::write(&file_path, json)
        .map_err(|e| anyhow::anyhow!("Failed to write DLC cache file: {}", e))?;
    
    Ok(())
}

/// Check if DLC cache is valid (not expired)
pub fn is_dlc_cache_valid(cache_data: &DlcCacheData) -> bool {
    let now = chrono::Utc::now().timestamp();
    (now - cache_data.updated_at) < DLC_CACHE_EXPIRATION
}

/// Invalidate DLC cache (delete cache file)
pub fn invalidate_dlc_cache(app_handle: &AppHandle, app_id: &str) -> Result<()> {
    let file_path = get_dlc_cache_file_path(app_handle, app_id)?;
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| anyhow::anyhow!("Failed to delete DLC cache file: {}", e))?;
    }
    
    Ok(())
}

