use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviFileChange {
    pub change: String, // "New" | "Different" | "Removed" | "Same" | "Unknown"
    pub bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviGame {
    pub decision: String, // "Processed" | "Cancelled" | "Ignored"
    pub change: String,   // "New" | "Different" | "Same" | "Unknown"
    pub files: HashMap<String, LudusaviFileChange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registry: Option<HashMap<String, LudusaviFileChange>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviChangedGames {
    pub new: u32,
    pub different: u32,
    pub same: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviOverall {
    #[serde(rename = "totalGames")]
    pub total_games: u32,
    #[serde(rename = "totalBytes")]
    pub total_bytes: u64,
    #[serde(rename = "processedGames")]
    pub processed_games: u32,
    #[serde(rename = "processedBytes")]
    pub processed_bytes: u64,
    #[serde(rename = "changedGames")]
    pub changed_games: LudusaviChangedGames,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviBackup {
    pub overall: LudusaviOverall,
    pub games: HashMap<String, LudusaviGame>,
    #[serde(rename = "customBackupPath")]
    pub custom_backup_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviManifestSecondary {
    pub url: String,
    pub enable: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviManifest {
    pub enable: bool,
    pub secondary: Vec<LudusaviManifestSecondary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviCustomGame {
    pub name: String,
    pub files: Vec<String>,
    pub registry: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviConfig {
    pub manifest: LudusaviManifest,
    #[serde(rename = "customGames")]
    pub custom_games: Vec<LudusaviCustomGame>,
}

// Mapping.yaml types (for restore)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviMappingFileInfo {
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviMappingRegistry {
    pub hash: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviMappingBackup {
    pub name: String,
    pub when: String,
    pub os: String,
    pub files: HashMap<String, LudusaviMappingFileInfo>,
    #[serde(default)]
    pub registry: Option<LudusaviMappingRegistry>,
    pub children: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviMapping {
    pub name: String,
    pub drives: HashMap<String, String>,
    pub backups: Vec<LudusaviMappingBackup>,
}

pub struct Ludasavi {
    app_handle: AppHandle,
}

impl Ludasavi {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Get the path to ludusavi resources (where the binary and config are stored in the app)
    fn get_ludusavi_resources_path(&self) -> Result<PathBuf> {
        // In development, ludusavi folder is in project root (not src-tauri!)
        // In production, it should be bundled in resources
        let resource_path = if cfg!(debug_assertions) {
            // Development: go up from src-tauri to project root
            let current_dir = std::env::current_dir()
                .map_err(|e| anyhow::anyhow!("Failed to get current directory: {}", e))?;
            
            // If we're in src-tauri, go up one level
            if current_dir.ends_with("src-tauri") {
                current_dir.parent()
                    .ok_or_else(|| anyhow::anyhow!("Failed to get parent directory"))?
                    .to_path_buf()
            } else {
                current_dir
            }
        } else {
            // Production: use resource directory
            self.app_handle
                .path()
                .resource_dir()
                .map_err(|e| anyhow::anyhow!("Failed to get resource directory: {}", e))?
        };
        
        Ok(resource_path.join("ludusavi"))
    }

    /// Get the user data path for ludusavi (where config will be copied to)
    fn get_ludusavi_config_path(&self) -> Result<PathBuf> {
        let app_data_dir = self.app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
        
        Ok(app_data_dir.join("ludusavi"))
    }

    /// Get the path to the ludusavi binary
    fn get_binary_path(&self) -> Result<PathBuf> {
        let config_path = self.get_ludusavi_config_path()?;
        let binary_name = if cfg!(windows) {
            "ludusavi.exe"
        } else {
            "ludusavi"
        };
        
        Ok(config_path.join(binary_name))
    }

    /// Initialize ludusavi by copying binary and config to user data directory
    pub fn init(&self) -> Result<()> {
        println!("[Ludasavi] Initializing...");
        
        let config_path = self.get_ludusavi_config_path()?;
        println!("[Ludasavi] Config path: {:?}", config_path);
        
        // Create config directory if it doesn't exist
        if !config_path.exists() {
            fs::create_dir_all(&config_path)?;
            println!("[Ludasavi] Created config directory");
        }

        // Copy binary if it doesn't exist
        let binary_path = self.get_binary_path()?;
        println!("[Ludasavi] Binary path: {:?}", binary_path);
        
        if !binary_path.exists() {
            let resources_path = self.get_ludusavi_resources_path()?;
            println!("[Ludasavi] Resources path: {:?}", resources_path);
            
            let binary_name = if cfg!(windows) {
                "ludusavi.exe"
            } else {
                "ludusavi"
            };
            let source_binary = resources_path.join(binary_name);
            println!("[Ludasavi] Source binary: {:?}", source_binary);
            
            if source_binary.exists() {
                println!("[Ludasavi] Copying binary...");
                fs::copy(&source_binary, &binary_path)?;
                println!("[Ludasavi] ✓ Binary copied successfully");
                
                // Make binary executable on Unix systems
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = fs::metadata(&binary_path)?.permissions();
                    perms.set_mode(0o755);
                    fs::set_permissions(&binary_path, perms)?;
                    println!("[Ludasavi] ✓ Binary made executable");
                }
            } else {
                return Err(anyhow::anyhow!("Source binary not found at {:?}", source_binary));
            }
        } else {
            println!("[Ludasavi] Binary already exists");
        }

        // Copy config if it doesn't exist
        let config_file = config_path.join("config.yaml");
        println!("[Ludasavi] Config file: {:?}", config_file);
        
        if !config_file.exists() {
            let resources_path = self.get_ludusavi_resources_path()?;
            let source_config = resources_path.join("config.yaml");
            println!("[Ludasavi] Source config: {:?}", source_config);
            
            if source_config.exists() {
                println!("[Ludasavi] Copying config...");
                fs::copy(&source_config, &config_file)?;
                println!("[Ludasavi] ✓ Config copied successfully");
            } else {
                return Err(anyhow::anyhow!("Source config not found at {:?}", source_config));
            }
        } else {
            println!("[Ludasavi] Config already exists");
        }

        println!("[Ludasavi] ✓ Binary and config initialization complete");
        Ok(())
    }

    /// Update the ludusavi manifest database
    /// This is now a public method that can be called manually from settings
    pub fn update_manifest_database(&self) -> Result<()> {
        let binary_path = self.get_binary_path()?;
        let config_path = self.get_ludusavi_config_path()?;
        
        let mut cmd = Command::new(&binary_path);
        cmd.args([
            "--config",
            &config_path.to_string_lossy(),
            "manifest",
            "update",
        ]);
        
        // ✅ CRITICAL FIX: Multiple flags needed to completely hide window on Windows
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            
            // CREATE_NO_WINDOW prevents console window creation
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            // DETACHED_PROCESS creates process without console
            const DETACHED_PROCESS: u32 = 0x00000008;
            
            // Combine both flags for complete suppression
            cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
        }
        
        let output = cmd.output()?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to update manifest: {}", stderr));
        }
        
        Ok(())
    }

    /// Get the ludusavi config
    pub fn get_config(&self) -> Result<LudusaviConfig> {
        let config_path = self.get_ludusavi_config_path()?;
        let config_file = config_path.join("config.yaml");
        
        let config_content = fs::read_to_string(config_file)?;
        let config: LudusaviConfig = serde_yaml::from_str(&config_content)?;
        
        Ok(config)
    }

    /// Save the ludusavi config
    fn save_config(&self, config: &LudusaviConfig) -> Result<()> {
        let config_path = self.get_ludusavi_config_path()?;
        let config_file = config_path.join("config.yaml");
        
        let config_content = serde_yaml::to_string(config)?;
        fs::write(config_file, config_content)?;
        
        Ok(())
    }

    /// Backup a game
    pub fn backup_game(
        &self,
        object_id: &str,
        backup_path: Option<&str>,
        wine_prefix: Option<&str>,
        preview: bool,
    ) -> Result<LudusaviBackup> {
        let binary_path = self.get_binary_path()?;
        let config_path = self.get_ludusavi_config_path()?;
        
        let mut args = vec![
            "--config".to_string(),
            config_path.to_string_lossy().to_string(),
            "backup".to_string(),
            object_id.to_string(),
            "--api".to_string(),
            "--force".to_string(),
        ];

        if preview {
            args.push("--preview".to_string());
        }

        if let Some(path) = backup_path {
            args.push("--path".to_string());
            args.push(path.to_string());
        }

        if let Some(prefix) = wine_prefix {
            args.push("--wine-prefix".to_string());
            args.push(prefix.to_string());
        }

        let mut cmd = Command::new(&binary_path);
        cmd.args(&args);
        
        // ✅ CRITICAL FIX: Multiple flags needed to completely hide window on Windows
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            
            // CREATE_NO_WINDOW prevents console window creation
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            // DETACHED_PROCESS creates process without console
            const DETACHED_PROCESS: u32 = 0x00000008;
            
            // Combine both flags for complete suppression
            cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
        }
        
        let output = cmd.output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Ludusavi backup failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let backup: LudusaviBackup = serde_json::from_str(&stdout)?;
        
        Ok(backup)
    }

    /// Get backup preview (scan without actually backing up)
    pub fn get_backup_preview(
        &self,
        object_id: &str,
        wine_prefix: Option<&str>,
    ) -> Result<LudusaviBackup> {
        let mut backup = self.backup_game(object_id, None, wine_prefix, true)?;
        
        // Add custom backup path if configured
        let config = self.get_config()?;
        if let Some(custom_game) = config.custom_games.iter().find(|g| g.name == object_id) {
            backup.custom_backup_path = custom_game.files.first().cloned();
        }
        
        Ok(backup)
    }

    /// Add a custom game with custom save path
    pub fn add_custom_game(&self, title: &str, save_path: Option<&str>) -> Result<()> {
        let mut config = self.get_config()?;
        
        // Remove existing entry for this game
        config.custom_games.retain(|g| g.name != title);
        
        // Add new entry if save_path is provided
        if let Some(path) = save_path {
            config.custom_games.push(LudusaviCustomGame {
                name: title.to_string(),
                files: vec![path.to_string()],
                registry: vec![],
            });
        }
        
        self.save_config(&config)?;
        
        Ok(())
    }
}

