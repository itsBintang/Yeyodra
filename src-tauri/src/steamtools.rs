use anyhow::{anyhow, Result};
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tempfile::TempDir;
use walkdir::WalkDir;
use zip::ZipArchive;

#[cfg(target_os = "windows")]
use winreg::{enums::*, RegKey};

lazy_static::lazy_static! {
    static ref HTTP_CLIENT: Client = {
        Client::builder()
            .user_agent("chaos-launcher/1.0")
            .timeout(Duration::from_secs(60))
            .build()
            .expect("Failed to create HTTP client")
    };
}

#[derive(Debug, Clone)]
enum RepoType {
    Branch,      // GitHub branch zipball
    DirectZip,   // Direct .zip URL
    DirectUrl,   // Direct URL (may or may not be zip)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub message: String,
}

/// Find Steam config path
pub fn find_steam_config_path() -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        
        if let Ok(steam_key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam") {
            if let Ok(install_path) = steam_key.get_value::<String, _>("InstallPath") {
                let config_path = PathBuf::from(install_path).join("config");
                if config_path.exists() {
                    return Ok(config_path);
                }
            }
        }
        
        if let Ok(steam_key) = hklm.open_subkey("SOFTWARE\\Valve\\Steam") {
            if let Ok(install_path) = steam_key.get_value::<String, _>("InstallPath") {
                let config_path = PathBuf::from(install_path).join("config");
                if config_path.exists() {
                    return Ok(config_path);
                }
            }
        }
        
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(steam_key) = hkcu.open_subkey("Software\\Valve\\Steam") {
            if let Ok(steam_path) = steam_key.get_value::<String, _>("SteamPath") {
                let config_path = PathBuf::from(steam_path).join("config");
                if config_path.exists() {
                    return Ok(config_path);
                }
            }
        }
    }
    
    Err(anyhow!("Steam config directory not found"))
}

/// Update LUA files with new manifest IDs
fn update_lua_files(
    stplugin_dir: &Path,
    app_id: &str,
    manifest_map: &HashMap<String, String>,
) -> Result<()> {
    if let Some(lua_file) = find_lua_file_for_appid(stplugin_dir, app_id)? {
        println!("Updating LUA file: {:?}", lua_file);
        
        let original_content = fs::read_to_string(&lua_file)?;
        let mut updated_content = original_content.clone();
        let mut updated_count = 0;
        
        let re_replace = Regex::new(r#"setManifestid\s*\(\s*(\d+)\s*,\s*"(\d+)"\s*,\s*0\s*\)"#)?;
        updated_content = re_replace
            .replace_all(&updated_content, |caps: &regex::Captures| {
                let depot_id = caps.get(1).unwrap().as_str();
                let old_manifest_id = caps.get(2).unwrap().as_str();
                
                if let Some(new_manifest_id) = manifest_map.get(depot_id) {
                    if new_manifest_id != old_manifest_id {
                        updated_count += 1;
                        return format!(r#"setManifestid({}, "{}", 0)"#, depot_id, new_manifest_id);
                    }
                }
                caps.get(0).unwrap().as_str().to_string()
            })
            .to_string();
        
        let existing_depots: Vec<String> = re_replace
            .captures_iter(&original_content)
            .map(|cap| cap[1].to_string())
            .collect();
        
        let mut new_lines = Vec::new();
        for (depot_id, manifest_id) in manifest_map {
            if !existing_depots.contains(depot_id) {
                new_lines.push(format!(
                    r#"setManifestid({}, "{}", 0)"#,
                    depot_id, manifest_id
                ));
                updated_count += 1;
            }
        }
        
        if !new_lines.is_empty() {
            updated_content.push_str("\n-- Updated by Chaos --\n");
            updated_content.push_str(&new_lines.join("\n"));
            updated_content.push('\n');
        }
        
        if updated_count > 0 {
            fs::write(&lua_file, updated_content)?;
            println!("Updated {} manifest entries in LUA file", updated_count);
        }
    }
    
    Ok(())
}

/// Find LUA file for specific app ID
fn find_lua_file_for_appid(stplugin_dir: &Path, app_id: &str) -> Result<Option<PathBuf>> {
    for entry in WalkDir::new(stplugin_dir)
        .max_depth(1)
        .into_iter()
        .filter_map(Result::ok)
    {
        if entry.file_type().is_file() {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if ext == "lua" {
                    if let Some(stem) = path.file_stem() {
                        if stem.to_string_lossy() == app_id {
                            return Ok(Some(path.to_path_buf()));
                        }
                    }
                    
                    if let Ok(content) = fs::read_to_string(path) {
                        let re = Regex::new(&format!(r"addappid\s*\(\s*({})\s*\)", app_id))?;
                        if re.is_match(&content) {
                            return Ok(Some(path.to_path_buf()));
                        }
                    }
                }
            }
        }
    }
    
    Ok(None)
}

/// Process ZIP and install to Steam
async fn process_and_install_to_steam(
    zip_bytes: &[u8],
    app_id: &str,
) -> Result<String> {
    let temp_dir = TempDir::new()?;
    let mut archive = ZipArchive::new(Cursor::new(zip_bytes))?;
    
    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = temp_dir.path().join(file.name());
        
        if file.is_dir() {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut outfile = fs::File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
        }
    }
    
    let steam_config_path = find_steam_config_path()?;
    let stplugin_dir = steam_config_path.join("stplug-in");
    let depotcache_dir = steam_config_path.join("depotcache");
    let statsexport_dir = steam_config_path.join("StatsExport");
    
    fs::create_dir_all(&stplugin_dir)?;
    fs::create_dir_all(&depotcache_dir)?;
    fs::create_dir_all(&statsexport_dir)?;
    
    let mut lua_count = 0;
    let mut manifest_count = 0;
    let mut bin_count = 0;
    let mut manifest_map: HashMap<String, String> = HashMap::new();
    
    let manifest_regex = Regex::new(r"(\d+)_(\d+)\.manifest$")?;
    
    // Copy files to appropriate directories
    for entry in WalkDir::new(temp_dir.path())
        .into_iter()
        .filter_map(Result::ok)
    {
        if entry.file_type().is_file() {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                
                match ext_str.as_str() {
                    "lua" => {
                        let filename = path.file_name().unwrap();
                        let dest = stplugin_dir.join(filename);
                        fs::copy(path, dest)?;
                        lua_count += 1;
                    }
                    "manifest" => {
                        let filename = path.file_name().unwrap().to_string_lossy();
                        if let Some(caps) = manifest_regex.captures(&filename) {
                            let depot_id = caps[1].to_string();
                            let manifest_id = caps[2].to_string();
                            manifest_map.insert(depot_id, manifest_id);
                        }
                        let dest = depotcache_dir.join(path.file_name().unwrap());
                        fs::copy(path, dest)?;
                        manifest_count += 1;
                    }
                    "bin" => {
                        let dest = statsexport_dir.join(path.file_name().unwrap());
                        fs::copy(path, dest)?;
                        bin_count += 1;
                    }
                    _ => {}
                }
            }
        }
    }
    
    // Update LUA files with manifest IDs
    if !manifest_map.is_empty() {
        update_lua_files(&stplugin_dir, app_id, &manifest_map)?;
    }
    
    Ok(format!(
        "Installed {} LUA, {} manifest, {} BIN files",
        lua_count, manifest_count, bin_count
    ))
}

/// Download and install SteamTools for a game
pub async fn download_steamtools(app_id: &str) -> Result<DownloadResult> {
    println!("Downloading SteamTools for AppID: {}", app_id);
    
    // Define repositories in priority order
    let repos = vec![
        ("SteamAutoCracks/ManifestHub".to_string(), RepoType::Branch),
        (
            "https://raw.githubusercontent.com/sushi-dev55/sushitools-games-repo/refs/heads/main/".to_string(),
            RepoType::DirectZip,
        ),
        ("Fairyvmos/bruh-hub".to_string(), RepoType::Branch),
        ("itsBintang/ManifestHub".to_string(), RepoType::Branch),
        (
            "https://mellyiscoolaf.pythonanywhere.com/".to_string(),
            RepoType::DirectUrl,
        ),
        (
            "http://masss.pythonanywhere.com/storage?auth=IEOIJE54esfsipoE56GE4&appid=".to_string(),
            RepoType::DirectUrl,
        ),
    ];
    
    // Try each repository
    for (repo_name, repo_type) in &repos {
        println!("Trying repository: {}", repo_name);
        
        let download_url = match repo_type {
            RepoType::Branch => {
                format!("https://api.github.com/repos/{}/zipball/{}", repo_name, app_id)
            }
            RepoType::DirectZip => {
                format!("{}{}.zip", repo_name, app_id)
            }
            RepoType::DirectUrl => {
                format!("{}{}", repo_name, app_id)
            }
        };
        
        println!("Downloading from: {}", download_url);
        
        match HTTP_CLIENT.get(&download_url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    match response.bytes().await {
                        Ok(bytes) => {
                            match process_and_install_to_steam(&bytes, app_id).await {
                                Ok(install_info) => {
                                    return Ok(DownloadResult {
                                        success: true,
                                        message: format!(
                                            "Successfully installed SteamTools! {}",
                                            install_info
                                        ),
                                    });
                                }
                                Err(e) => {
                                    println!("Failed to install: {}", e);
                                    continue;
                                }
                            }
                        }
                        Err(e) => {
                            println!("Failed to read response: {}", e);
                            continue;
                        }
                    }
                } else {
                    println!("HTTP {} from {}", response.status(), repo_name);
                }
            }
            Err(e) => {
                println!("Error downloading from {}: {}", repo_name, e);
            }
        }
    }
    
    // All repositories failed
    Ok(DownloadResult {
        success: false,
        message: format!("No SteamTools data found for AppID: {}", app_id),
    })
}

/// Remove game files (SteamTools LUA, manifest, BIN files)
pub async fn remove_game_files(app_id: &str) -> Result<DownloadResult> {
    println!("Removing game files for AppID: {}", app_id);

    let steam_config_path = find_steam_config_path()?;

    // Define target directories
    let stplugin_dir = steam_config_path.join("stplug-in");
    let depotcache_dir = steam_config_path.join("depotcache");
    let statsexport_dir = steam_config_path.join("StatsExport");

    let mut removed_files = Vec::new();

    // Delete LUA file
    let lua_file = stplugin_dir.join(format!("{}.lua", app_id));
    if lua_file.exists() {
        fs::remove_file(&lua_file)
            .map_err(|e| anyhow!("Failed to delete LUA file: {}", e))?;
        removed_files.push("LUA");
    }

    // Delete manifest files (there might be multiple)
    if depotcache_dir.exists() {
        if let Ok(entries) = fs::read_dir(&depotcache_dir) {
            for entry in entries.filter_map(Result::ok) {
                let file_name = entry.file_name();
                let file_name_str = file_name.to_string_lossy();

                // Check if it's a manifest file for this app
                if file_name_str.contains(app_id) && file_name_str.ends_with(".manifest") {
                    if let Err(e) = fs::remove_file(entry.path()) {
                        println!("Warning: Failed to delete manifest file {}: {}", file_name_str, e);
                    } else {
                        removed_files.push("manifest");
                    }
                }
            }
        }
    }

    // Delete BIN files
    if statsexport_dir.exists() {
        if let Ok(entries) = fs::read_dir(&statsexport_dir) {
            for entry in entries.filter_map(Result::ok) {
                let file_name = entry.file_name();
                let file_name_str = file_name.to_string_lossy();

                // Check if it's a BIN file for this app
                if file_name_str.contains(app_id) && file_name_str.ends_with(".bin") {
                    if let Err(e) = fs::remove_file(entry.path()) {
                        println!("Warning: Failed to delete BIN file {}: {}", file_name_str, e);
                    } else {
                        removed_files.push("BIN");
                    }
                }
            }
        }
    }

    if removed_files.is_empty() {
        Ok(DownloadResult {
            success: false,
            message: "No game files found to remove".to_string(),
        })
    } else {
        Ok(DownloadResult {
            success: true,
            message: format!(
                "Removed {} files: {}",
                removed_files.len(),
                removed_files.join(", ")
            ),
        })
    }
}

// ============================================
// DLC MANAGER FUNCTIONS
// ============================================

use once_cell::sync::Lazy;

// Pre-compiled regex for better performance
static ADDAPPID_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"addappid\s*\(\s*(\d+)\s*\)").expect("Invalid regex pattern")
});

/// Get list of DLC IDs for a game from Steam API
pub async fn get_game_dlc_list(app_id: &str) -> Result<Vec<String>> {
    println!("Fetching DLC list for AppID: {}", app_id);
    
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}&l=english",
        app_id
    );
    
    let response = HTTP_CLIENT
        .get(&url)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to fetch from Steam API: {}", e))?;
    
    if !response.status().is_success() {
        return Err(anyhow!("Steam API returned status {}", response.status()));
    }
    
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| anyhow!("Failed to parse response: {}", e))?;
    
    // Extract DLC array from Steam API response
    let dlc_list = json
        .get(app_id)
        .and_then(|v| v.get("data"))
        .and_then(|v| v.get("dlc"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_u64())
                .map(|id| id.to_string())
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();
    
    println!("Found {} DLCs for AppID: {}", dlc_list.len(), app_id);
    
    Ok(dlc_list)
}

/// Get basic DLC info (name and image) from Steam API
pub async fn get_dlc_info(app_id: &str) -> Result<(String, String)> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}&l=english",
        app_id
    );
    
    let response = HTTP_CLIENT
        .get(&url)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to fetch DLC info: {}", e))?;
    
    if !response.status().is_success() {
        // Return default values if failed
        return Ok((
            format!("DLC {}", app_id),
            format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", app_id)
        ));
    }
    
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| anyhow!("Failed to parse response: {}", e))?;
    
    let name = json
        .get(app_id)
        .and_then(|v| v.get("data"))
        .and_then(|v| v.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or(&format!("DLC {}", app_id))
        .to_string();
    
    let header_image = json
        .get(app_id)
        .and_then(|v| v.get("data"))
        .and_then(|v| v.get("header_image"))
        .and_then(|v| v.as_str())
        .unwrap_or(&format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", app_id))
        .to_string();
    
    Ok((name, header_image))
}

/// Batch fetch DLC details (with rate limiting)
pub async fn batch_fetch_dlc_details(dlc_ids: Vec<String>) -> Result<Vec<(String, String, String)>> {
    use futures::stream::{self, StreamExt};
    
    println!("Batch fetching details for {} DLCs", dlc_ids.len());
    
    let results: Vec<_> = stream::iter(dlc_ids)
        .map(|app_id| async move {
            // Small delay to avoid rate limiting
            tokio::time::sleep(Duration::from_millis(200)).await;
            
            match get_dlc_info(&app_id).await {
                Ok((name, image)) => Some((app_id, name, image)),
                Err(e) => {
                    eprintln!("Failed to fetch DLC {}: {}", app_id, e);
                    // Return default values
                    Some((
                        app_id.clone(),
                        format!("DLC {}", app_id),
                        format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", app_id)
                    ))
                }
            }
        })
        .buffer_unordered(5) // Process 5 at a time
        .collect()
        .await;
    
    let dlc_details: Vec<_> = results.into_iter().flatten().collect();
    
    println!("Successfully fetched {} DLC details", dlc_details.len());
    
    Ok(dlc_details)
}

/// Get installed DLCs from .lua file
pub fn get_installed_dlcs(app_id: &str) -> Result<Vec<String>> {
    let steam_config_path = find_steam_config_path()?;
    let stplugin_dir = steam_config_path.join("stplug-in");
    let lua_file_path = stplugin_dir.join(format!("{}.lua", app_id));
    
    if !lua_file_path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(&lua_file_path)
        .map_err(|e| anyhow!("Failed to read lua file: {}", e))?;
    
    // Parse addappid() calls using pre-compiled regex
    let installed_dlcs: Vec<String> = ADDAPPID_REGEX
        .captures_iter(&content)
        .map(|cap| cap[1].to_string())
        .filter(|id| id != app_id) // Exclude main game ID
        .collect();
    
    Ok(installed_dlcs)
}

/// Sync DLC selection to .lua file
pub fn sync_dlcs_to_lua(
    main_app_id: &str,
    dlc_ids_to_set: Vec<String>,
) -> Result<String> {
    let steam_config_path = find_steam_config_path()?;
    let stplugin_dir = steam_config_path.join("stplug-in");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&stplugin_dir)
        .map_err(|e| anyhow!("Failed to create stplug-in directory: {}", e))?;
    
    let lua_file_path = stplugin_dir.join(format!("{}.lua", main_app_id));
    
    // Read existing content if file exists
    let old_dlcs = if lua_file_path.exists() {
        get_installed_dlcs(main_app_id).unwrap_or_default()
    } else {
        Vec::new()
    };
    
    // Calculate changes
    let added: Vec<_> = dlc_ids_to_set
        .iter()
        .filter(|id| !old_dlcs.contains(id))
        .collect();
    
    let removed: Vec<_> = old_dlcs
        .iter()
        .filter(|id| !dlc_ids_to_set.contains(id))
        .collect();
    
    // Build new content
    let mut new_content = String::with_capacity(50 + (dlc_ids_to_set.len() * 20));
    
    // Add main game ID
    new_content.push_str(&format!("addappid({})\n", main_app_id));
    
    // Add DLCs if any selected
    if !dlc_ids_to_set.is_empty() {
        new_content.push_str("\n-- DLCs managed by Chaos --\n");
        for dlc_id in &dlc_ids_to_set {
            new_content.push_str(&format!("addappid({})\n", dlc_id));
        }
    }
    
    // Write to file
    fs::write(&lua_file_path, new_content)
        .map_err(|e| anyhow!("Failed to write lua file: {}", e))?;
    
    // Generate success message
    let message = match (added.len(), removed.len()) {
        (0, 0) => "No changes made to DLCs".to_string(),
        (added, 0) if added > 0 => format!(
            "Successfully unlocked {} DLC{}",
            added,
            if added == 1 { "" } else { "s" }
        ),
        (0, removed) if removed > 0 => format!(
            "Successfully removed {} DLC{}",
            removed,
            if removed == 1 { "" } else { "s" }
        ),
        (added, removed) => format!(
            "Successfully unlocked {} and removed {} DLC{}",
            added,
            removed,
            if added + removed == 1 { "" } else { "s" }
        ),
    };
    
    println!("DLC sync completed for game {}: {}", main_app_id, message);
    
    Ok(message)
}

