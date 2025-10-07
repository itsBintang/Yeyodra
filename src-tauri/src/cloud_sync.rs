use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::ludasavi::{Ludasavi, LudusaviMapping};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameArtifact {
    pub id: String,
    #[serde(rename = "objectId")]
    pub object_id: String,
    pub shop: String,
    pub label: Option<String>,
    pub hostname: String,
    #[serde(rename = "downloadOptionTitle")]
    pub download_option_title: Option<String>,
    #[serde(rename = "artifactLengthInBytes")]
    pub artifact_length_in_bytes: u64,
    #[serde(rename = "winePrefixPath")]
    pub wine_prefix_path: Option<String>,
    pub platform: String,
    #[serde(rename = "isFrozen")]
    pub is_frozen: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadArtifactPayload {
    #[serde(rename = "artifactLengthInBytes")]
    pub artifact_length_in_bytes: u64,
    pub shop: String,
    #[serde(rename = "objectId")]
    pub object_id: String,
    pub hostname: String,
    #[serde(rename = "winePrefixPath")]
    pub wine_prefix_path: Option<String>,
    #[serde(rename = "homeDir")]
    pub home_dir: String,
    #[serde(rename = "downloadOptionTitle")]
    pub download_option_title: Option<String>,
    pub platform: String,
    pub label: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadUrlResponse {
    pub id: String,
    #[serde(rename = "uploadUrl")]
    pub upload_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadArtifactResponse {
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    #[serde(rename = "objectKey")]
    pub object_key: String,
    #[serde(rename = "homeDir")]
    pub home_dir: String,
    #[serde(rename = "winePrefixPath")]
    pub wine_prefix_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalBackup {
    pub id: String,              // tar filename
    #[serde(rename = "objectId")]
    pub object_id: String,
    pub label: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,      // from mapping.yaml "when"
    #[serde(rename = "sizeInBytes")]
    pub size_in_bytes: u64,
    #[serde(rename = "fileCount")]
    pub file_count: usize,
    pub platform: String,        // from mapping.yaml "os"
}

pub struct CloudSync {
    app_handle: AppHandle,
    ludasavi: Ludasavi,
}

impl CloudSync {
    pub fn new(app_handle: AppHandle) -> Self {
        let ludasavi = Ludasavi::new(app_handle.clone());
        Self {
            app_handle,
            ludasavi,
        }
    }

    /// Get backups directory path
    fn get_backups_path(&self) -> Result<PathBuf> {
        let app_data_dir = self.app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
        
        Ok(app_data_dir.join("backups"))
    }

    /// Get Windows-like user profile path (cross-platform compatible)
    #[allow(unused_variables)] // wine_prefix_path not used on Windows
    pub fn get_windows_like_user_profile_path(
        wine_prefix_path: Option<&str>,
    ) -> Result<String> {
        #[cfg(target_os = "linux")]
        {
            if let Some(prefix) = wine_prefix_path {
                // Read user.reg to get USERPROFILE path
                let user_reg_path = PathBuf::from(prefix).join("user.reg");
                if user_reg_path.exists() {
                    let content = fs::read_to_string(user_reg_path)?;
                    
                    // Parse for USERPROFILE value
                    for line in content.lines() {
                        if line.contains("USERPROFILE") {
                            if let Some(value) = line.split('"').nth(3) {
                                return Ok(Self::normalize_path(value));
                            }
                        }
                    }
                }
                
                return Err(anyhow::anyhow!("Could not find USERPROFILE in user.reg"));
            }
        }
        
        // On Windows or if no wine prefix, use home directory
        let home = dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?;
        
        Ok(Self::normalize_path(&home.to_string_lossy()))
    }

    /// Normalize path to use forward slashes
    fn normalize_path(path: &str) -> String {
        path.replace('\\', "/")
    }

    /// Get backup label with timestamp
    pub fn get_backup_label(automatic: bool) -> String {
        let now = chrono::Local::now();
        let date = now.format("%Y-%m-%d %H:%M:%S").to_string();
        
        if automatic {
            format!("Automatic backup from {}", date)
        } else {
            format!("Backup from {}", date)
        }
    }

    /// Bundle backup into tar.gz archive
    fn bundle_backup(
        &self,
        shop: &str,
        object_id: &str,
        wine_prefix: Option<&str>,
    ) -> Result<PathBuf> {
        let backups_dir = self.get_backups_path()?;
        let backup_path = backups_dir.join(format!("{}-{}", shop, object_id));
        
        // Remove existing backup directory if it exists
        if backup_path.exists() {
            fs::remove_dir_all(&backup_path)?;
        }

        // Create backup using ludusavi (with object_id which is Steam App ID)
        self.ludasavi.backup_game(
            object_id,
            Some(&backup_path.to_string_lossy()),
            wine_prefix,
            false,
        )?;

        // Create tar.gz archive
        let tar_filename = format!("{}.tar", Uuid::new_v4());
        let tar_location = backups_dir.join(tar_filename);

        // Ensure backups directory exists
        fs::create_dir_all(&backups_dir)?;

        // Create tar archive
        let tar_file = File::create(&tar_location)?;
        let mut tar_builder = tar::Builder::new(tar_file);

        // Add all files from backup directory to tar
        tar_builder.append_dir_all(".", &backup_path)?;
        tar_builder.finish()?;

        Ok(tar_location)
    }

    /// Upload save game to cloud
    pub async fn upload_save_game(
        &self,
        object_id: &str,
        shop: &str,
        _download_option_title: Option<&str>,
        _label: Option<&str>,
        wine_prefix: Option<&str>,
    ) -> Result<()> {
        // Bundle backup
        let tar_location = self.bundle_backup(shop, object_id, wine_prefix)?;
        
        // Get file size
        let metadata = fs::metadata(&tar_location)?;
        let file_size = metadata.len();

        println!("[CloudSync] ✓ Backup created successfully!");
        println!("[CloudSync]   Location: {:?}", tar_location);
        println!("[CloudSync]   Size: {} bytes ({:.2} MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
        
        // TODO: LOCAL-ONLY MODE - Skip API upload for now
        // When API is ready, uncomment the code below:
        
        /*
        // Get hostname
        let hostname = hostname::get()
            .unwrap_or_else(|_| std::ffi::OsString::from("unknown"))
            .to_string_lossy()
            .to_string();

        // Get platform
        let platform = std::env::consts::OS.to_string();

        // Get home directory
        let home_dir = Self::get_windows_like_user_profile_path(wine_prefix)?;

        // Prepare upload payload
        let payload = UploadArtifactPayload {
            artifact_length_in_bytes: file_size,
            shop: shop.to_string(),
            object_id: object_id.to_string(),
            hostname,
            wine_prefix_path: wine_prefix.map(String::from),
            home_dir,
            download_option_title: download_option_title.map(String::from),
            platform,
            label: label.map(String::from),
        };

        // TODO: Replace with actual API endpoint
        let api_url = "https://api.yourdomain.com/profile/games/artifacts";
        
        // Request upload URL from API
        let client = reqwest::Client::new();
        let response = client
            .post(api_url)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to get upload URL: {:?}", response.status()));
        }

        let upload_response: UploadUrlResponse = response.json().await?;

        // Upload file to presigned URL
        let file_content = fs::read(&tar_location)?;
        let upload_response = client
            .put(&upload_response.upload_url)
            .header("Content-Type", "application/x-tar")
            .body(file_content)
            .send()
            .await?;

        if !upload_response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to upload file: {:?}", upload_response.status()));
        }

        // Cleanup tar file
        fs::remove_file(&tar_location)?;
        */
        
        // LOCAL-ONLY MODE: Just keep the backup file, don't upload to cloud
        println!("[CloudSync] ✓ Backup saved locally (cloud upload disabled)");
        
        Ok(())
    }

    /// Download and restore game artifact
    pub async fn download_game_artifact(
        &self,
        object_id: &str,
        shop: &str,
        game_artifact_id: &str,
    ) -> Result<()> {
        // TODO: Replace with actual API endpoint
        let api_url = format!(
            "https://api.yourdomain.com/profile/games/artifacts/{}/download",
            game_artifact_id
        );

        // Request download URL from API
        let client = reqwest::Client::new();
        let response = client
            .post(&api_url)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to get download URL: {:?}", response.status()));
        }

        let download_response: DownloadArtifactResponse = response.json().await?;

        // Download tar file
        let tar_content = client
            .get(&download_response.download_url)
            .send()
            .await?
            .bytes()
            .await?;

        // Save tar file temporarily
        let backups_dir = self.get_backups_path()?;
        fs::create_dir_all(&backups_dir)?;
        
        let tar_location = backups_dir.join(&download_response.object_key);
        fs::write(&tar_location, &tar_content)?;

        // Extract tar
        let backup_path = backups_dir.join(format!("{}-{}", shop, object_id));
        if backup_path.exists() {
            fs::remove_dir_all(&backup_path)?;
        }
        fs::create_dir_all(&backup_path)?;

        let tar_file = File::open(&tar_location)?;
        let mut archive = tar::Archive::new(tar_file);
        archive.unpack(&backup_path)?;

        // TODO: Restore files using ludusavi mapping.yaml
        // This is complex and requires parsing mapping.yaml and moving files
        // to their proper locations

        // Cleanup tar file
        fs::remove_file(&tar_location)?;

        Ok(())
    }

    /// List local backups for a game (local-only mode)
    pub fn list_local_backups(&self, object_id: &str, _shop: &str) -> Result<Vec<LocalBackup>> {
        let backups_dir = self.get_backups_path()?;
        let mut backups = Vec::new();
        
        if !backups_dir.exists() {
            return Ok(backups);
        }

        // Read all .tar files in backups directory
        for entry in fs::read_dir(&backups_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            // Only process .tar files
            if path.extension().and_then(|s| s.to_str()) != Some("tar") {
                continue;
            }

            // Extract mapping.yaml to read metadata
            match self.read_backup_metadata(&path, object_id) {
                Ok(Some(backup)) => backups.push(backup),
                Ok(None) => continue, // Not for this game
                Err(e) => {
                    eprintln!("[CloudSync] Failed to read backup metadata from {:?}: {}", path, e);
                    continue;
                }
            }
        }

        // Sort by created_at descending (newest first)
        backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        Ok(backups)
    }

    /// Read backup metadata from tar file
    fn read_backup_metadata(&self, tar_path: &PathBuf, object_id: &str) -> Result<Option<LocalBackup>> {
        use std::io::Read;
        
        let tar_file = File::open(tar_path)?;
        let mut archive = tar::Archive::new(tar_file);
        
        // Look for mapping.yaml inside {object_id}/mapping.yaml
        let mapping_path = format!("{}/mapping.yaml", object_id);
        
        for entry in archive.entries()? {
            let mut entry = entry?;
            let path = entry.path()?;
            
            if path.to_str() == Some(&mapping_path) {
                // Read mapping.yaml content
                let mut content = String::new();
                entry.read_to_string(&mut content)?;
                
                // Parse YAML
                let mapping: LudusaviMapping = serde_yaml::from_str(&content)?;
                
                // Verify this backup is for the requested game
                if mapping.name != object_id {
                    return Ok(None);
                }
                
                // Get file size
                let metadata = fs::metadata(tar_path)?;
                let size_in_bytes = metadata.len();
                
                // Get backup info from first backup entry
                let backup_info = mapping.backups.first()
                    .ok_or_else(|| anyhow::anyhow!("No backup entries in mapping.yaml"))?;
                
                let file_count = backup_info.files.len();
                let created_at = backup_info.when.clone();
                let platform = backup_info.os.clone();
                
                // Generate label from created_at
                let label = format!("Backup from {}", created_at.split('T').next().unwrap_or(&created_at));
                
                return Ok(Some(LocalBackup {
                    id: tar_path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    object_id: object_id.to_string(),
                    label,
                    created_at,
                    size_in_bytes,
                    file_count,
                    platform,
                }));
            }
        }
        
        // mapping.yaml not found for this object_id
        Ok(None)
    }

    /// Restore game save from local backup (local-only mode)
    pub fn restore_from_local_backup(&self, backup_id: &str, object_id: &str, shop: &str) -> Result<()> {
        let backups_dir = self.get_backups_path()?;
        let tar_path = backups_dir.join(backup_id);
        
        if !tar_path.exists() {
            return Err(anyhow::anyhow!("Backup file not found: {}", backup_id));
        }

        println!("[CloudSync] Restoring backup: {}", backup_id);
        
        // Extract path
        let extract_path = backups_dir.join(format!("{}-{}-restore", shop, object_id));
        
        // Remove existing extract directory
        if extract_path.exists() {
            fs::remove_dir_all(&extract_path)?;
        }
        fs::create_dir_all(&extract_path)?;
        
        // Extract tar file
        println!("[CloudSync] Extracting tar file...");
        let tar_file = File::open(&tar_path)?;
        let mut archive = tar::Archive::new(tar_file);
        archive.unpack(&extract_path)?;
        
        // Read mapping.yaml
        let game_backup_path = extract_path.join(object_id);
        let mapping_path = game_backup_path.join("mapping.yaml");
        
        let mapping_content = fs::read_to_string(&mapping_path)?;
        let mapping: LudusaviMapping = serde_yaml::from_str(&mapping_content)?;
        
        println!("[CloudSync] Mapping loaded. Found {} backups", mapping.backups.len());
        
        // Get current user's home directory
        let current_home = Self::get_windows_like_user_profile_path(None)?;
        println!("[CloudSync] Current home directory: {}", current_home);
        
        // Restore files
        self.restore_ludusavi_backup(&game_backup_path, &mapping, &current_home, None)?;
        
        println!("[CloudSync] ✓ Restore completed successfully");
        
        // Cleanup extract directory
        fs::remove_dir_all(&extract_path)?;
        
        Ok(())
    }

    /// Restore files from Ludusavi backup (based on Hydra's implementation)
    fn restore_ludusavi_backup(
        &self,
        game_backup_path: &PathBuf,
        mapping: &LudusaviMapping,
        current_home: &str,
        _wine_prefix: Option<&str>,
    ) -> Result<()> {
        let backup_info = mapping.backups.first()
            .ok_or_else(|| anyhow::anyhow!("No backup entries in mapping.yaml"))?;
        
        let file_count = backup_info.files.len();
        println!("[CloudSync] Restoring {} files...", file_count);
        
        for (file_path, _file_info) in &backup_info.files {
            // Transform path from archive structure to actual Windows path
            // Example: "C:/Users/Nazril/AppData/..." → "drive-C/Users/Nazril/AppData/..."
            let mut source_path_with_drives = file_path.clone();
            for (drive_key, drive_value) in &mapping.drives {
                source_path_with_drives = source_path_with_drives.replace(drive_value, drive_key);
            }
            
            let source_path = game_backup_path.join(&source_path_with_drives);
            
            // Destination path = replace backup home with current home
            // Extract original home directory from first file path
            let backup_home = self.extract_home_from_path(file_path)?;
            let destination_path = file_path.replace(&backup_home, current_home);
            
            println!("[CloudSync] Restoring: {} -> {}", source_path.display(), destination_path);
            
            // Create destination directory
            let dest_path = PathBuf::from(&destination_path);
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent)?;
            }
            
            // Remove existing file if present
            if dest_path.exists() {
                fs::remove_file(&dest_path)?;
            }
            
            // Copy file to destination
            fs::copy(&source_path, &dest_path)?;
        }
        
        Ok(())
    }

    /// Extract home directory from file path
    /// Example: "C:/Users/Nazril/AppData/..." → "C:/Users/Nazril"
    fn extract_home_from_path(&self, file_path: &str) -> Result<String> {
        // Windows: C:/Users/Username
        if file_path.starts_with("C:/Users/") || file_path.starts_with("C:\\Users\\") {
            let parts: Vec<&str> = file_path.split('/').collect();
            if parts.len() >= 3 {
                return Ok(format!("{}/{}/{}", parts[0], parts[1], parts[2]));
            }
        }
        
        Err(anyhow::anyhow!("Could not extract home directory from path: {}", file_path))
    }

    /// Copy backup tar file to custom destination path
    pub fn copy_backup_to_path(&self, backup_id: &str, destination_path: &str) -> Result<String> {
        let backups_dir = self.get_backups_path()?;
        let source_path = backups_dir.join(backup_id);
        
        // Verify source file exists
        if !source_path.exists() {
            return Err(anyhow::anyhow!("Backup file not found: {}", backup_id));
        }

        // Parse destination path
        let dest_path = PathBuf::from(destination_path);
        
        // Check if destination is a directory
        let final_dest = if dest_path.is_dir() {
            // If it's a directory, append the backup filename
            dest_path.join(backup_id)
        } else {
            // If it's a file path, use it as is
            dest_path
        };

        // Create destination directory if it doesn't exist
        if let Some(parent) = final_dest.parent() {
            fs::create_dir_all(parent)?;
        }

        // Copy the file
        fs::copy(&source_path, &final_dest)?;

        println!("[CloudSync] ✓ Backup copied successfully!");
        println!("[CloudSync]   From: {:?}", source_path);
        println!("[CloudSync]   To: {:?}", final_dest);

        Ok(final_dest.to_string_lossy().to_string())
    }

    /// Delete local backup file
    pub fn delete_local_backup(&self, backup_id: &str) -> Result<()> {
        let backups_dir = self.get_backups_path()?;
        let tar_path = backups_dir.join(backup_id);
        
        if !tar_path.exists() {
            return Err(anyhow::anyhow!("Backup file not found: {}", backup_id));
        }

        fs::remove_file(&tar_path)?;
        println!("[CloudSync] ✓ Backup deleted: {}", backup_id);

        Ok(())
    }

    /// Import external backup file (.tar) into local backups directory
    /// This allows users to restore backups shared by friends
    pub fn import_backup_file(&self, source_file_path: &str, object_id: &str) -> Result<String> {
        let source_path = PathBuf::from(source_file_path);
        
        // Verify source file exists and is a .tar file
        if !source_path.exists() {
            return Err(anyhow::anyhow!("Source file not found: {}", source_file_path));
        }
        
        if source_path.extension().and_then(|s| s.to_str()) != Some("tar") {
            return Err(anyhow::anyhow!("Only .tar files are supported"));
        }

        // Verify the tar file contains valid backup for this game
        match self.read_backup_metadata(&source_path, object_id) {
            Ok(Some(_backup)) => {
                // Valid backup for this game
            },
            Ok(None) => {
                return Err(anyhow::anyhow!(
                    "This backup file is not for the current game (object_id: {})", 
                    object_id
                ));
            },
            Err(e) => {
                return Err(anyhow::anyhow!("Invalid backup file: {}", e));
            }
        }

        // Get backups directory
        let backups_dir = self.get_backups_path()?;
        fs::create_dir_all(&backups_dir)?;

        // Generate new filename with UUID to avoid conflicts
        let new_filename = format!("{}.tar", Uuid::new_v4());
        let dest_path = backups_dir.join(&new_filename);

        // Copy file to backups directory
        fs::copy(&source_path, &dest_path)?;

        println!("[CloudSync] ✓ Backup imported successfully!");
        println!("[CloudSync]   From: {:?}", source_path);
        println!("[CloudSync]   To: {:?}", dest_path);
        println!("[CloudSync]   New ID: {}", new_filename);

        Ok(new_filename)
    }
}

