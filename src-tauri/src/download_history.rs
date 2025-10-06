use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletedDownload {
    #[serde(rename = "appId")]
    pub app_id: String,
    pub title: String,
    #[serde(rename = "downloadType")]
    pub download_type: String, // "SteamTools" or "Repack"
    #[serde(rename = "completedAt")]
    pub completed_at: i64, // Unix timestamp
    #[serde(rename = "iconUrl")]
    pub icon_url: Option<String>,
}

fn get_history_file_path() -> PathBuf {
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("chaos");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&app_dir).ok();
    
    app_dir.join("download_history.json")
}

pub fn save_completed_download(download: CompletedDownload) -> Result<()> {
    let file_path = get_history_file_path();
    println!("[DownloadHistory] File path: {:?}", file_path);
    
    // Read existing history
    let mut history = get_download_history()?;
    println!("[DownloadHistory] Current history count: {}", history.len());
    
    // Check if download already exists (by appId and downloadType)
    let exists = history.iter().any(|d| {
        d.app_id == download.app_id && d.download_type == download.download_type
    });
    
    if exists {
        println!("[DownloadHistory] Download already exists, skipping: {} ({})", download.title, download.app_id);
        return Ok(());
    }
    
    // Add new download
    println!("[DownloadHistory] Adding new download: {} ({})", download.title, download.app_id);
    history.push(download);
    
    // Sort by completed_at descending (newest first)
    history.sort_by(|a, b| b.completed_at.cmp(&a.completed_at));
    
    // Save to file
    let json = serde_json::to_string_pretty(&history)?;
    fs::write(&file_path, json)?;
    
    println!("[DownloadHistory] ✓ Saved successfully. New count: {}", history.len());
    
    Ok(())
}

pub fn get_download_history() -> Result<Vec<CompletedDownload>> {
    let file_path = get_history_file_path();
    
    if !file_path.exists() {
        return Ok(Vec::new());
    }
    
    let contents = fs::read_to_string(file_path)?;
    let history: Vec<CompletedDownload> = serde_json::from_str(&contents)?;
    
    Ok(history)
}

pub fn remove_from_history(app_id: &str, download_type: &str) -> Result<()> {
    let file_path = get_history_file_path();
    
    let mut history = get_download_history()?;
    history.retain(|d| !(d.app_id == app_id && d.download_type == download_type));
    
    let json = serde_json::to_string_pretty(&history)?;
    fs::write(file_path, json)?;
    
    Ok(())
}

pub fn clear_history() -> Result<()> {
    let file_path = get_history_file_path();
    
    if file_path.exists() {
        fs::remove_file(file_path)?;
    }
    
    Ok(())
}

