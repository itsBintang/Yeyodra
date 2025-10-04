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

