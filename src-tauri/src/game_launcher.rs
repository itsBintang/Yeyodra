use std::path::Path;
use anyhow::Result;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::process::Command;

/// Launch a game executable
pub fn launch_game(executable_path: &str) -> Result<String> {
    let path = Path::new(executable_path);
    
    // Check if executable exists
    if !path.exists() {
        return Err(anyhow::anyhow!("Executable not found: {}", executable_path));
    }
    
    // Check if it's a file (Windows)
    #[cfg(target_os = "windows")]
    {
        if !path.is_file() {
            return Err(anyhow::anyhow!("Not a valid file: {}", executable_path));
        }
        
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        if ext != "exe" && ext != "lnk" {
            return Err(anyhow::anyhow!("Not a valid executable file (must be .exe or .lnk): {}", executable_path));
        }
    }
    
    // Get the working directory (parent directory of the executable)
    let working_dir = path.parent()
        .ok_or_else(|| anyhow::anyhow!("Cannot determine working directory"))?;
    
    println!("Launching game: {}", executable_path);
    println!("Working directory: {:?}", working_dir);
    
    // Launch the game process
    #[cfg(target_os = "windows")]
    {
        // Use Windows ShellExecute to handle elevation properly
        // CREATE_NO_WINDOW = 0x08000000
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        Command::new("cmd")
            .args(["/C", "start", "", executable_path])
            .current_dir(working_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to launch game: {}", e))?;
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        Command::new(executable_path)
            .current_dir(working_dir)
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to launch game: {}", e))?;
    }
    
    Ok(format!("Game launched successfully: {}", path.file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")))
}


