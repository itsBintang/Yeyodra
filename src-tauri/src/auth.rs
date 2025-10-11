use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const AUTH_API_URL: &str = "https://auth.nzr.web.id";
const LICENSE_FILE: &str = "license.json";

// ============ STRUCTS ============

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseInfo {
    pub key: String,
    pub device_id: String,
    pub expires_at: String,
    pub activated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivateRequest {
    key: String,
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivateResponse {
    success: bool,
    message: Option<String>,
    error: Option<String>,
    #[serde(rename = "expiresAt")]
    expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ValidateRequest {
    key: String,
    #[serde(rename = "deviceId")]
    device_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ValidateResponse {
    valid: bool,
    error: Option<String>,
    #[serde(rename = "expiresAt")]
    expires_at: Option<String>,
}

// ============ HELPER FUNCTIONS ============

/// Get hardware ID (device fingerprint)
pub fn get_device_id() -> Result<String> {
    match machineid_rs::IdBuilder::new(machineid_rs::Encryption::SHA256)
        .add_component(machineid_rs::HWIDComponent::SystemID)
        .add_component(machineid_rs::HWIDComponent::CPUCores)
        .build("yeyodra-launcher")
    {
        Ok(hwid) => Ok(hwid),
        Err(e) => Err(anyhow!("Failed to generate device ID: {}", e)),
    }
}

/// Get license file path
fn get_license_path(app_handle: &AppHandle) -> Result<PathBuf> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| anyhow!("Failed to get app data dir: {}", e))?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)?;
    }

    Ok(app_data_dir.join(LICENSE_FILE))
}

/// Save license info to local file
fn save_license(app_handle: &AppHandle, license: &LicenseInfo) -> Result<()> {
    let license_path = get_license_path(app_handle)?;
    let json = serde_json::to_string_pretty(license)?;
    fs::write(license_path, json)?;
    Ok(())
}

/// Load license info from local file
fn load_license(app_handle: &AppHandle) -> Result<LicenseInfo> {
    let license_path = get_license_path(app_handle)?;
    
    if !license_path.exists() {
        return Err(anyhow!("License file not found"));
    }

    let json = fs::read_to_string(license_path)?;
    let license: LicenseInfo = serde_json::from_str(&json)?;
    Ok(license)
}

// ============ PUBLIC API ============

/// Activate a license key
pub async fn activate_license(
    app_handle: AppHandle,
    key: String,
) -> Result<LicenseInfo> {
    let device_id = get_device_id()?;

    println!("[Auth] Activating license key: {}", key);
    println!("[Auth] Device ID: {}", device_id);

    // Try to get username from user profile
    let username = match crate::user_profile::get_user_profile(&app_handle) {
        Ok(profile) => Some(profile.display_name),
        Err(_) => None,
    };

    println!("[Auth] Username: {:?}", username);

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/activate", AUTH_API_URL))
        .json(&ActivateRequest {
            key: key.clone(),
            device_id: device_id.clone(),
            username,
        })
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow!("Activation failed with status: {}", response.status()));
    }

    let activate_response: ActivateResponse = response.json().await?;

    if !activate_response.success {
        return Err(anyhow!(
            "Activation failed: {}",
            activate_response.error.unwrap_or_else(|| "Unknown error".to_string())
        ));
    }

    let license = LicenseInfo {
        key: key.clone(),
        device_id: device_id.clone(),
        expires_at: activate_response
            .expires_at
            .ok_or_else(|| anyhow!("No expiration date in response"))?,
        activated_at: chrono::Utc::now().to_rfc3339(),
    };

    // Save to local file
    save_license(&app_handle, &license)?;

    // Sync username from R2 to local profile if provided
    if let Some(r2_username) = activate_response.username {
        // Don't sync placeholder usernames
        let is_placeholder = r2_username.is_empty() 
            || r2_username == "Unknown User" 
            || r2_username == "Local User"
            || r2_username == "Yeyodra User";
            
        if !is_placeholder {
            match crate::user_profile::get_user_profile(&app_handle) {
                Ok(mut profile) => {
                    // Only update if different to avoid unnecessary writes
                    if profile.display_name != r2_username {
                        println!("[Auth] Syncing username from R2: '{}' -> '{}'", profile.display_name, r2_username);
                        profile.display_name = r2_username;
                        let _ = crate::user_profile::save_user_profile(&app_handle, profile);
                    }
                },
                Err(e) => println!("[Auth] Could not sync username: {}", e),
            }
        }
    }

    println!("[Auth] ✓ License activated successfully");
    Ok(license)
}

/// Validate current license
pub async fn validate_license(app_handle: AppHandle) -> Result<LicenseInfo> {
    // Load from local file
    let license = load_license(&app_handle)?;

    println!("[Auth] Validating license...");

    // Verify with server
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/validate", AUTH_API_URL))
        .json(&ValidateRequest {
            key: license.key.clone(),
            device_id: license.device_id.clone(),
        })
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow!("Validation failed with status: {}", response.status()));
    }

    let validate_response: ValidateResponse = response.json().await?;

    if !validate_response.valid {
        return Err(anyhow!(
            "License validation failed: {}",
            validate_response.error.unwrap_or_else(|| "Unknown error".to_string())
        ));
    }

    println!("[Auth] ✓ License is valid");
    Ok(license)
}

/// Get current license info (from local file only, no network check)
pub fn get_license_info(app_handle: AppHandle) -> Result<LicenseInfo> {
    load_license(&app_handle)
}

/// Check if license is expired (local check only)
pub fn is_license_expired(license: &LicenseInfo) -> bool {
    match chrono::DateTime::parse_from_rfc3339(&license.expires_at) {
        Ok(expires_at) => expires_at < chrono::Utc::now(),
        Err(_) => true, // If can't parse, assume expired
    }
}

/// Deactivate license (remove local file)
pub fn deactivate_license(app_handle: AppHandle) -> Result<()> {
    let license_path = get_license_path(&app_handle)?;
    
    if license_path.exists() {
        fs::remove_file(license_path)?;
        println!("[Auth] ✓ License deactivated");
    }
    
    Ok(())
}

