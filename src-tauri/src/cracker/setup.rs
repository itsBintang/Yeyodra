use crate::cracker::config::{FOLDER, S3};
use crate::cracker::error::SetupError;

use tauri::Emitter;

use dirs::data_dir;
use futures_util::stream::StreamExt;
use log::info;
use reqwest::Client;
use std::fs::{self, File};
use std::io;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::sync::Semaphore;
use tokio::task::{self, spawn_blocking};
use zip::read::ZipArchive;

const GOLDBERG32_PATH: &str = "gameboun/x32/steam_api.dll";
const STEAMCLIENT32_PATH: &str = "gameboun/x32/steamclient.dll";
const GOLDBERG64_PATH: &str = "gameboun/x64/steam_api64.dll";
const STEAMCLIENT64_PATH: &str = "gameboun/x64/steamclient64.dll";
const OVERLAY_SOUND_PATH: &str = "gameboun/overlay_achievement_notification.wav";
const FONT_FILE_PATH: &str = "gameboun/Roboto-Medium.ttf";
const STEAMLESS_DOWNLOAD_PATH: &str = "gameboun/Steamless.v3.1.0.5.-.by.atom0s.zip";
const STEAMLESS_DIR_NAME: &str = "steamless";
const STEAMLESS_KEY_FILE: &str = "Steamless.CLI.exe";

struct DownloadableFile {
    url: String,
    target_path: String,
}

async fn download_file(
    client: Client,
    file: DownloadableFile,
    semaphore: &Semaphore,
    app_handle: &tauri::AppHandle,
) -> Result<(), SetupError> {
    let target_path = Path::new(&file.target_path);
    
    // Delete existing file if it's suspiciously small (likely corrupt from previous failed download)
    if target_path.exists() {
        if let Ok(metadata) = fs::metadata(&target_path) {
            let file_size = metadata.len();
            let file_name = file.target_path.split('\\').last().or_else(|| file.target_path.split('/').last()).unwrap_or(&file.target_path);
            
            // Check if file is suspiciously small (corrupt)
            let is_corrupt = match file_name {
                "steam_api.dll" | "steam_api64.dll" => file_size < 10_000_000, // Should be ~16-18 MB
                "steamclient.dll" | "steamclient64.dll" => file_size < 50_000, // Should be ~90-111 KB
                "overlay_achievement_notification.wav" => file_size < 10_000,
                "Roboto-Medium.ttf" => file_size < 100_000,
                name if name.ends_with(".zip") => file_size < 500_000,
                _ => false,
            };
            
            if is_corrupt {
                info!("Deleting corrupt file: {} ({} bytes)", file_name, file_size);
                fs::remove_file(&target_path).ok();
            } else {
                info!("File exists and valid: {}", file.target_path);
                app_handle.emit("setup-progress", format!("Skipped: {}", file.target_path))?;
                return Ok(());
            }
        }
    }

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let _permit = semaphore
        .acquire()
        .await
        .map_err(|e| SetupError::Other(format!("Semaphore error: {}", e)))?;
    app_handle.emit(
        "setup-progress",
        format!("Downloading: {}", file.target_path),
    )?;

    // Increased timeout for large files (Goldberg DLLs are ~16-18 MB each!)
    let response = client
        .get(&file.url)
        .timeout(Duration::from_secs(180)) // 3 minutes for large files
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(SetupError::Other(format!(
            "HTTP {} for {}",
            response.status(),
            file.url
        )));
    }

    let mut outfile = tokio::fs::File::create(&file.target_path).await?;
    let mut stream = response.bytes_stream();
    let mut total_bytes = 0u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        total_bytes += chunk.len() as u64;
        outfile.write_all(&chunk).await?;
    }
    
    outfile.sync_all().await?;

    // CRITICAL: Validate downloaded file size
    let file_name = file.target_path.split('\\').last().or_else(|| file.target_path.split('/').last()).unwrap_or(&file.target_path);
    let min_expected_size = match file_name {
        "steam_api.dll" | "steam_api64.dll" => 10_000_000u64, // 10 MB minimum (actual ~16-18 MB)
        "steamclient.dll" | "steamclient64.dll" => 50_000u64, // 50 KB minimum (actual ~90-111 KB)
        "overlay_achievement_notification.wav" => 10_000u64,
        "Roboto-Medium.ttf" => 100_000u64,
        name if name.ends_with(".zip") => 500_000u64,
        _ => 0,
    };

    if min_expected_size > 0 && total_bytes < min_expected_size {
        // Delete invalid file
        tokio::fs::remove_file(&file.target_path).await.ok();
        return Err(SetupError::Other(format!(
            "File {} is too small: {} bytes (expected >{} bytes). Download was interrupted or incomplete.",
            file_name, total_bytes, min_expected_size
        )));
    }

    info!("✓ Downloaded & validated: {} ({} bytes)", file.target_path, total_bytes);
    app_handle.emit("setup-progress", format!("Completed: {} ({} KB)", file.target_path, total_bytes / 1024))?;
    Ok(())
}

async fn extract_steamless_zip(
    cache_dir: &str,
    app_handle: &tauri::AppHandle,
) -> Result<(), SetupError> {
    let zip_path = format!("{}/{}", cache_dir, "Steamless.v3.1.0.5.-.by.atom0s.zip");
    let extract_dir = format!("{}/{}", cache_dir, STEAMLESS_DIR_NAME);

    // Check if already extracted
    if Path::new(&extract_dir).join(STEAMLESS_KEY_FILE).exists() {
        info!("Steamless already extracted: {}", extract_dir);
        app_handle.emit("setup-progress", "Steamless already extracted")?;
        return Ok(());
    }
    
    // CRITICAL: Check if ZIP file exists and is valid before extraction
    let zip_path_obj = Path::new(&zip_path);
    if !zip_path_obj.exists() {
        return Err(SetupError::Other(format!(
            "ZIP file not found at: {}. Download may have failed.",
            zip_path
        )));
    }
    
    // Check if ZIP file size is reasonable
    // Steamless ZIP is ~610KB, so we check for at least 500KB to detect incomplete downloads
    if let Ok(metadata) = fs::metadata(&zip_path) {
        let file_size = metadata.len();
        const MIN_EXPECTED_SIZE: u64 = 500_000; // 500 KB minimum
        const EXPECTED_SIZE: u64 = 610_646; // Actual Steamless ZIP size
        
        if file_size < MIN_EXPECTED_SIZE {
            info!("ZIP file incomplete ({} bytes, expected ~{} bytes)", file_size, EXPECTED_SIZE);
            // Remove incomplete file
            fs::remove_file(&zip_path).ok();
            return Err(SetupError::Other(format!(
                "ZIP file incomplete (size: {} bytes, expected: {} bytes). Please restart.",
                file_size, EXPECTED_SIZE
            )));
        }
        
        info!("ZIP file size validated: {} bytes", file_size);
    }

    // Create extraction directory
    fs::create_dir_all(&extract_dir)?;

    let zip_path_clone = zip_path.clone();
    let extract_dir_clone = extract_dir.clone();

    app_handle.emit("setup-progress", "Extracting Steamless ZIP")?;
    
    // Extract in blocking thread to avoid blocking async runtime
    spawn_blocking(move || {
        let zip_file = File::open(&zip_path_clone)?;
        let mut archive = ZipArchive::new(zip_file)?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            
            // CRITICAL FIX: Use enclosed_name() which returns Option<&Path>
            // This prevents path traversal attacks and handles invalid paths
            let file_path = file.enclosed_name().ok_or_else(|| {
                SetupError::Other(format!("Invalid file path in ZIP entry {}", i))
            })?;
            
            let target_path = Path::new(&extract_dir_clone).join(file_path);

            if file.is_dir() {
                fs::create_dir_all(&target_path)?;
            } else {
                // Ensure parent directory exists
                if let Some(parent) = target_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                
                // Create and write file
                let mut outfile = File::create(&target_path)?;
                io::copy(&mut file, &mut outfile)?;
            }
        }
        Ok::<(), SetupError>(())
    })
    .await??;

    // Remove ZIP file after extraction
    fs::remove_file(&zip_path)?;
    info!("Extracted Steamless to: {}", extract_dir);
    app_handle.emit("setup-progress", "Steamless extraction completed")?;
    Ok(())
}

pub async fn setup(app_handle: tauri::AppHandle) -> Result<(), SetupError> {
    let cache_dir = data_dir()
        .ok_or(SetupError::Other(
            "Failed to get app data directory".to_string(),
        ))?
        .join(FOLDER)
        .to_string_lossy()
        .into_owned();

    fs::create_dir_all(&cache_dir)?;
    app_handle.emit("setup-progress", "Created cache directory")?;

    let client = Client::new();
    let semaphore = Arc::new(Semaphore::new(3));

    let files = vec![
        DownloadableFile {
            url: format!("{}{}", S3, GOLDBERG32_PATH),
            target_path: format!("{}/{}", cache_dir, "steam_api.dll"),
        },
        DownloadableFile {
            url: format!("{}{}", S3, STEAMCLIENT32_PATH),
            target_path: format!("{}/{}", cache_dir, "steamclient.dll"),
        },
        DownloadableFile {
            url: format!("{}{}", S3, GOLDBERG64_PATH),
            target_path: format!("{}/{}", cache_dir, "steam_api64.dll"),
        },
        DownloadableFile {
            url: format!("{}{}", S3, STEAMCLIENT64_PATH),
            target_path: format!("{}/{}", cache_dir, "steamclient64.dll"),
        },
        DownloadableFile {
            url: format!("{}{}", S3, OVERLAY_SOUND_PATH),
            target_path: format!("{}/{}", cache_dir, "overlay_achievement_notification.wav"),
        },
        DownloadableFile {
            url: format!("{}{}", S3, FONT_FILE_PATH),
            target_path: format!("{}/{}", cache_dir, "Roboto-Medium.ttf"),
        },
        DownloadableFile {
            url: format!("{}{}", S3, STEAMLESS_DOWNLOAD_PATH),
            target_path: format!("{}/{}", cache_dir, "Steamless.v3.1.0.5.-.by.atom0s.zip"),
        },
    ];

    let download_tasks: Vec<_> = files
        .into_iter()
        .map(|file| {
            let client = client.clone();
            let semaphore = semaphore.clone();
            let app_handle = app_handle.clone();
            task::spawn(async move { download_file(client, file, &semaphore, &app_handle).await })
        })
        .collect();

    for task in download_tasks {
        task.await??;
    }

    extract_steamless_zip(&cache_dir, &app_handle).await?;
    info!("Setup completed");
    app_handle.emit("setup-progress", "Setup completed")?;
    Ok(())
}

