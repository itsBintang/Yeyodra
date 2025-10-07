use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use anyhow::Result;

/// Application lock to prevent multiple instances
/// Similar to Hydra's Lock service
pub struct AppLock {
    lock_file_path: PathBuf,
}

impl AppLock {
    /// Acquire application lock
    /// Returns error if another instance is already running
    pub fn acquire() -> Result<Self> {
        let lock_dir = Self::get_lock_dir()?;
        fs::create_dir_all(&lock_dir)?;
        
        let lock_file_path = lock_dir.join("app.lock");
        
        // Check if lock file exists and contains valid PID
        if lock_file_path.exists() {
            let existing_pid_str = fs::read_to_string(&lock_file_path)?;
            if let Ok(existing_pid) = existing_pid_str.trim().parse::<u32>() {
                // Check if process is still running
                if Self::is_process_running(existing_pid) {
                    return Err(anyhow::anyhow!(
                        "Another instance of Yeyodra is already running (PID: {})", 
                        existing_pid
                    ));
                } else {
                    println!("[Lock] Stale lock file found (PID: {}), removing", existing_pid);
                    // Remove stale lock file
                    let _ = fs::remove_file(&lock_file_path);
                }
            }
        }
        
        // Create new lock file with current PID
        let current_pid = std::process::id();
        let mut lock_file = File::create(&lock_file_path)?;
        write!(lock_file, "{}", current_pid)?;
        
        println!("[Lock] ✓ Application lock acquired (PID: {})", current_pid);
        
        Ok(AppLock { lock_file_path })
    }
    
    /// Release the application lock
    pub fn release(&self) -> Result<()> {
        if self.lock_file_path.exists() {
            fs::remove_file(&self.lock_file_path)?;
            println!("[Lock] ✓ Application lock released");
        }
        Ok(())
    }
    
    /// Get lock directory path
    fn get_lock_dir() -> Result<PathBuf> {
        // Use temp directory for lock files
        let temp_dir = std::env::temp_dir();
        Ok(temp_dir.join("yeyodra-launcher"))
    }
    
    /// Check if a process with given PID is still running
    #[cfg(windows)]
    fn is_process_running(pid: u32) -> bool {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        
        // Use tasklist to check if process exists
        let mut cmd = Command::new("tasklist");
        cmd.args(&["/FI", &format!("PID eq {}", pid), "/NH"]);
        
        // ✅ CRITICAL FIX: Multiple flags needed to completely hide window on Windows
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
        
        let output = cmd.output();
        
        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                stdout.contains(&pid.to_string())
            }
            Err(_) => false,
        }
    }
    
    #[cfg(not(windows))]
    fn is_process_running(pid: u32) -> bool {
        use std::process::Command;
        
        // Use kill -0 to check if process exists (doesn't actually kill it)
        let output = Command::new("kill")
            .args(&["-0", &pid.to_string()])
            .output();
        
        match output {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }
}

impl Drop for AppLock {
    fn drop(&mut self) {
        // Automatically release lock when dropped
        let _ = self.release();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_lock_acquire_and_release() {
        let lock = AppLock::acquire().expect("Failed to acquire lock");
        assert!(lock.lock_file_path.exists());
        
        lock.release().expect("Failed to release lock");
        assert!(!lock.lock_file_path.exists());
    }
    
    #[test]
    fn test_prevent_multiple_instances() {
        let _lock1 = AppLock::acquire().expect("Failed to acquire first lock");
        
        // Second attempt should fail
        let lock2_result = AppLock::acquire();
        assert!(lock2_result.is_err());
    }
}

