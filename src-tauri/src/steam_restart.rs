use std::process::Command;
use std::time::Duration;
use anyhow::Result;

pub async fn restart_steam() -> Result<String> {
    println!("Attempting to restart Steam...");

    #[cfg(target_os = "windows")]
    {
        // First, terminate the Steam process
        let kill_result = Command::new("taskkill")
            .args(&["/F", "/IM", "steam.exe"])
            .output();

        match kill_result {
            Ok(output) => {
                if output.status.success() {
                    println!("Steam process terminated successfully");
                } else {
                    println!("Steam process might not be running");
                }
            }
            Err(e) => {
                println!("Failed to terminate Steam: {}", e);
            }
        }

        // Wait a moment for the process to fully terminate
        tokio::time::sleep(Duration::from_millis(1000)).await;

        // Find and restart Steam
        match find_steam_executable_path() {
            Ok(steam_path) => match Command::new(&steam_path).spawn() {
                Ok(_) => {
                    println!("Steam restarted successfully");
                    Ok("Steam has been restarted successfully".to_string())
                }
                Err(e) => {
                    let error_msg = format!("Failed to restart Steam: {}", e);
                    println!("{}", error_msg);
                    Err(anyhow::anyhow!(error_msg))
                }
            },
            Err(e) => {
                let error_msg = format!("Steam executable not found: {}", e);
                println!("{}", error_msg);
                Err(anyhow::anyhow!(error_msg))
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // For Linux/macOS, try to restart Steam
        let kill_result = Command::new("pkill")
            .args(&["-f", "steam"])
            .output();

        match kill_result {
            Ok(output) => {
                if output.status.success() {
                    println!("Steam process terminated successfully");
                } else {
                    println!("Steam process might not be running");
                }
            }
            Err(e) => {
                println!("Failed to terminate Steam: {}", e);
            }
        }

        // Wait a moment for the process to fully terminate
        tokio::time::sleep(Duration::from_millis(1000)).await;

        // Try to restart Steam
        match Command::new("steam").spawn() {
            Ok(_) => {
                println!("Steam restarted successfully");
                Ok("Steam has been restarted successfully".to_string())
            }
            Err(e) => {
                let error_msg = format!("Failed to restart Steam: {}", e);
                println!("{}", error_msg);
                Err(anyhow::anyhow!(error_msg))
            }
        }
    }
}

fn find_steam_executable_path() -> Result<String> {
    #[cfg(target_os = "windows")]
    {
        // Try common Steam installation paths
        let possible_paths = vec![
            r"C:\Program Files (x86)\Steam\steam.exe",
            r"C:\Program Files\Steam\steam.exe",
            r"C:\Steam\steam.exe",
        ];

        for path in possible_paths {
            if std::path::Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }

        // Try to find Steam in registry
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(steam_key) = hkcu.open_subkey(r"Software\Valve\Steam") {
            if let Ok(steam_path) = steam_key.get_value::<String, _>("SteamPath") {
                let steam_exe = format!("{}\\steam.exe", steam_path.replace("/", "\\"));
                if std::path::Path::new(&steam_exe).exists() {
                    return Ok(steam_exe);
                }
            }
        }

        Err(anyhow::anyhow!("Steam executable not found"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        // For Linux/macOS, try to find steam in PATH
        match Command::new("which").arg("steam").output() {
            Ok(output) => {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    return Ok(path);
                }
            }
            Err(_) => {}
        }

        Err(anyhow::anyhow!("Steam executable not found"))
    }
}
