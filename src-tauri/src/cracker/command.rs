use tauri::{command, AppHandle, Emitter};
use serde_json::json;

use crate::cracker::goldberg::apply::apply_goldberg;
use crate::cracker::steamless::apply::apply_steamless;

#[command]
pub async fn cmd_apply_crack(
    app: AppHandle,
    game_location: String,
    app_id: String,
    language: Option<String>,
) -> Result<String, String> {
    eprintln!("\n═══════════════════════════════════════════");
    eprintln!("🔧 STARTING CRACK PROCESS");
    eprintln!("═══════════════════════════════════════════");
    eprintln!("📁 Game Location: {}", game_location);
    eprintln!("🎮 App ID: {}", app_id);
    eprintln!("🌍 Language: {:?}", language);
    eprintln!("═══════════════════════════════════════════\n");

    // CRITICAL: Ensure setup is complete before cracking
    eprintln!("🔍 Checking cracker dependencies...");
    let is_ready = cmd_check_cracker_ready(app.clone()).await?;
    
    if !is_ready {
        eprintln!("⚠️  Cracker dependencies not ready! Running setup...");
        app.emit(
            "crack-progress",
            &json!({"progress": 0, "message": "Setting up cracker dependencies..."}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
        
        crate::cracker::setup::setup(app.clone())
            .await
            .map_err(|e| {
                eprintln!("❌ SETUP FAILED: {}", e);
                format!("Setup failed: {}. Please restart the application.", e)
            })?;
        
        eprintln!("✅ Setup completed successfully!");
    } else {
        eprintln!("✅ Cracker dependencies already ready!");
    }

    // Step 1: Run Steamless (0-50%)
    app.emit(
        "crack-progress",
        &json!({"progress": 0, "message": "Starting Steamless DRM removal"}),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    eprintln!("🚀 STEP 1/2: Running Steamless DRM Removal...");
    let steamless_result = apply_steamless(app.clone(), game_location.clone())
        .await
        .map_err(|e| {
            eprintln!("❌ STEAMLESS FAILED: {}", e);
            format!("Steamless failed: {}", e)
        })?;
    eprintln!("✅ STEAMLESS COMPLETED: {}", steamless_result);

    // Step 2: Run Goldberg (50-100%)
    app.emit(
        "crack-progress",
        &json!({"progress": 50, "message": "Starting Goldberg emulator"}),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    eprintln!("\n🚀 STEP 2/2: Running Goldberg Steam Emulator...");
    let goldberg_result = apply_goldberg(app.clone(), game_location, app_id, language)
        .await
        .map_err(|e| {
            eprintln!("❌ GOLDBERG FAILED: {}", e);
            format!("Goldberg failed: {}", e)
        })?;
    eprintln!("✅ GOLDBERG COMPLETED: {}", goldberg_result);

    // Done
    app.emit(
        "crack-progress",
        &json!({"progress": 100, "message": "Crack completed successfully!"}),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    eprintln!("\n═══════════════════════════════════════════");
    eprintln!("🎉 CRACK PROCESS COMPLETED SUCCESSFULLY!");
    eprintln!("═══════════════════════════════════════════\n");

    Ok(format!(
        "Crack completed successfully!\n\nSteamless: {}\nGoldberg: {}",
        steamless_result, goldberg_result
    ))
}

#[command]
pub async fn cmd_setup_cracker(app: AppHandle) -> Result<String, String> {
    // This command allows manual setup trigger from frontend
    crate::cracker::setup::setup(app)
        .await
        .map_err(|e| format!("Setup failed: {}", e))?;
    Ok("Cracker setup completed successfully".to_string())
}

#[command]
pub async fn cmd_check_cracker_ready(app: AppHandle) -> Result<bool, String> {
    // Check if cracker dependencies are ready without triggering setup
    use crate::cracker::config::FOLDER;
    use crate::cracker::steamless::config::{STEAMLESS_DIR_NAME, STEAMLESS_KEY_FILE};
    use dirs::data_dir;
    
    let cache_dir = data_dir()
        .ok_or("Failed to get app data directory")?
        .join(FOLDER);
    
    // Check if Steamless CLI exists
    let steamless_ready = cache_dir
        .join(STEAMLESS_DIR_NAME)
        .join(STEAMLESS_KEY_FILE)
        .exists();
    
    // Check if Goldberg DLLs exist
    let goldberg32_ready = cache_dir.join("steam_api.dll").exists();
    let goldberg64_ready = cache_dir.join("steam_api64.dll").exists();
    
    Ok(steamless_ready && goldberg32_ready && goldberg64_ready)
}

