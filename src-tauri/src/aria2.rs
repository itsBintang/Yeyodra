use serde::{Deserialize, Serialize};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

/// Global Aria2 instance
static ARIA2_INSTANCE: Lazy<Arc<Mutex<Option<Aria2Process>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(None)));

/// Aria2 process manager
pub struct Aria2Process {
    process: Child,
    port: u16,
    secret: String,
}

impl Aria2Process {
    /// Spawn a new aria2c process with RPC enabled
    /// Use max_connections to limit parallel connections (good for unstable networks)
    pub fn spawn(port: u16, secret: String, max_connections: u8) -> Result<Self, String> {
        // Determine binary path based on environment
        let binary_name = if cfg!(windows) { "aria2c.exe" } else { "aria2c" };
        
        let binary_path = if cfg!(debug_assertions) {
            // Development: use binary from workspace root binaries folder
            // Optimized path search to prevent UI freeze
            let current_dir = std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?;
            
            // Fast path: Try common development locations first
            let common_locations = [
                current_dir.join("binaries").join(binary_name),                    // From workspace root
                current_dir.join("..").join("binaries").join(binary_name),         // From src-tauri/
                current_dir.join("../..").join("binaries").join(binary_name),      // From target/debug/
            ];
            
            let mut found_path = None;
            for path in &common_locations {
                if path.exists() {
                    found_path = Some(path.clone());
                    break;
                }
            }
            
            // Slow path: Search up the tree if not found (limited to 5 levels)
            if found_path.is_none() {
                let mut search_path = current_dir.clone();
                for _ in 0..5 {
                    let binaries_path = search_path.join("binaries").join(binary_name);
                    if binaries_path.exists() {
                        found_path = Some(binaries_path);
                        break;
                    }
                    
                    match search_path.parent() {
                        Some(parent) => search_path = parent.to_path_buf(),
                        None => break,
                    }
                }
            }
            
            // Use found path or fallback to current_dir/binaries
            found_path.unwrap_or_else(|| current_dir.join("binaries").join(binary_name))
        } else {
            // Production: use bundled binary from resources
            // In Tauri, bundled resources are placed next to the executable
            let exe_path = std::env::current_exe()
                .map_err(|e| format!("Failed to get executable path: {}", e))?;
            
            let exe_dir = exe_path.parent()
                .ok_or("Failed to get executable directory")?;
            
            // Try current directory first (where exe is)
            let mut binary = exe_dir.join(binary_name);
            
            // If not found, try resources folder (common in some build configs)
            if !binary.exists() {
                binary = exe_dir.join("resources").join(binary_name);
            }
            
            binary
        };

        // Log the path we're trying to use
        println!("Looking for aria2c at: {:?}", binary_path);
        
        if !binary_path.exists() {
            eprintln!("WARNING: aria2c binary not found at: {:?}", binary_path);
            eprintln!("Current working directory: {:?}", std::env::current_dir());
            eprintln!("Current executable: {:?}", std::env::current_exe());
            
            // Try to continue anyway - the binary might be in PATH
            // This allows development to continue even if path detection fails
            println!("Attempting to use 'aria2c' from system PATH...");
        }

        let mut command = Command::new(binary_path);
        command.args(&[
            "--enable-rpc",
            "--rpc-listen-all=false",
            &format!("--rpc-listen-port={}", port),
            &format!("--rpc-secret={}", secret),
            "--file-allocation=none",
            "--allow-overwrite=true",
            &format!("--max-connection-per-server={}", max_connections),
            &format!("--split={}", max_connections),
            "--min-split-size=1M",
            "--continue=true",
            "--auto-file-renaming=false",
            "--quiet=true",
        ]);

        // ✅ CRITICAL FIX: Multiple flags needed to completely hide window on Windows
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            
            // CREATE_NO_WINDOW prevents console window creation
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            // DETACHED_PROCESS creates process without console
            const DETACHED_PROCESS: u32 = 0x00000008;
            
            // Combine both flags for complete suppression
            command.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
        }

        let process = command
            .spawn()
            .map_err(|e| format!("Failed to spawn aria2c: {}", e))?;

        println!("aria2c started on port {} with RPC enabled", port);

        Ok(Aria2Process {
            process,
            port,
            secret,
        })
    }

    /// Get the RPC URL
    pub fn get_rpc_url(&self) -> String {
        format!("http://localhost:{}/jsonrpc", self.port)
    }

    /// Get the RPC secret
    pub fn get_secret(&self) -> &str {
        &self.secret
    }

    /// Kill the aria2c process
    pub fn kill(&mut self) -> Result<(), String> {
        self.process
            .kill()
            .map_err(|e| format!("Failed to kill aria2c process: {}", e))?;
        
        self.process
            .wait()
            .map_err(|e| format!("Failed to wait for aria2c process: {}", e))?;
        
        println!("aria2c process terminated");
        Ok(())
    }
}

impl Drop for Aria2Process {
    fn drop(&mut self) {
        let _ = self.kill();
    }
}

/// Initialize the global aria2c instance
/// max_connections: number of parallel connections (default 16, use 4 for low connection mode)
pub fn init() -> Result<(), String> {
    init_with_connections(16) // Default: 16 connections
}

/// Initialize with custom connection count (for low connection mode)
pub fn init_with_connections(max_connections: u8) -> Result<(), String> {
    let mut instance = ARIA2_INSTANCE.lock().unwrap();
    
    if instance.is_some() {
        return Ok(()); // Already initialized
    }

    // Generate a secure random secret
    let secret = uuid::Uuid::new_v4().to_string();
    let port = 6800;

    let aria2 = Aria2Process::spawn(port, secret, max_connections)?;
    *instance = Some(aria2);

    println!("Aria2c initialized with {} parallel connections", max_connections);
    Ok(())
}

/// Get the RPC URL for aria2c
pub fn get_rpc_url() -> Result<String, String> {
    let instance = ARIA2_INSTANCE.lock().unwrap();
    instance
        .as_ref()
        .map(|a| a.get_rpc_url())
        .ok_or_else(|| "Aria2 not initialized".to_string())
}

/// Get the RPC secret for aria2c
pub fn get_secret() -> Result<String, String> {
    let instance = ARIA2_INSTANCE.lock().unwrap();
    instance
        .as_ref()
        .map(|a| a.get_secret().to_string())
        .ok_or_else(|| "Aria2 not initialized".to_string())
}

/// Shutdown the global aria2c instance
pub fn shutdown() -> Result<(), String> {
    let mut instance = ARIA2_INSTANCE.lock().unwrap();
    
    if let Some(mut aria2) = instance.take() {
        aria2.kill()?;
    }

    Ok(())
}

/// Restart aria2c with new connection count
/// Used when switching between normal and low connection mode
pub fn restart_with_connections(max_connections: u8) -> Result<(), String> {
    println!("Restarting aria2c with {} connections...", max_connections);
    
    // Shutdown existing instance
    {
        let mut instance = ARIA2_INSTANCE.lock().unwrap();
        if let Some(mut aria2) = instance.take() {
            aria2.kill()?;
            println!("✓ Old aria2c instance stopped");
        }
    }
    
    // Wait a moment for process to fully terminate
    std::thread::sleep(std::time::Duration::from_millis(100));
    
    // Start new instance with new connection count
    let secret = uuid::Uuid::new_v4().to_string();
    let port = 6800;
    let aria2 = Aria2Process::spawn(port, secret, max_connections)?;
    
    {
        let mut instance = ARIA2_INSTANCE.lock().unwrap();
        *instance = Some(aria2);
    }
    
    println!("✓ Aria2c restarted with {} parallel connections", max_connections);
    Ok(())
}

// JSON-RPC structures
#[derive(Debug, Serialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: String,
    pub method: String,
    pub params: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct JsonRpcResponse<T> {
    pub jsonrpc: String,
    pub id: String,
    pub result: Option<T>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

/// Aria2 RPC Client
pub struct Aria2Client {
    client: reqwest::Client,
    rpc_url: String,
    secret: String,
}

impl Aria2Client {
    pub fn new() -> Result<Self, String> {
        Ok(Aria2Client {
            client: reqwest::Client::new(),
            rpc_url: get_rpc_url()?,
            secret: get_secret()?,
        })
    }

    /// Call an aria2 RPC method
    async fn call<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        params: Vec<serde_json::Value>,
    ) -> Result<T, String> {
        let mut full_params = vec![serde_json::json!(format!("token:{}", self.secret))];
        full_params.extend(params);

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: uuid::Uuid::new_v4().to_string(),
            method: method.to_string(),
            params: full_params,
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("RPC request failed: {}", e))?;

        let json_response: JsonRpcResponse<T> = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse RPC response: {}", e))?;

        if let Some(error) = json_response.error {
            return Err(format!("RPC error: {} (code: {})", error.message, error.code));
        }

        json_response
            .result
            .ok_or_else(|| "No result in RPC response".to_string())
    }

    /// Add a new download
    pub async fn add_uri(&self, uris: Vec<String>, options: Option<serde_json::Value>) -> Result<String, String> {
        let params = if let Some(opts) = options {
            vec![serde_json::json!(uris), opts]
        } else {
            vec![serde_json::json!(uris)]
        };

        self.call("aria2.addUri", params).await
    }

    /// Get download status
    pub async fn tell_status(&self, gid: &str) -> Result<DownloadStatus, String> {
        self.call("aria2.tellStatus", vec![serde_json::json!(gid)]).await
    }

    /// Pause a download
    pub async fn pause(&self, gid: &str) -> Result<String, String> {
        self.call("aria2.pause", vec![serde_json::json!(gid)]).await
    }

    /// Resume a paused download
    pub async fn unpause(&self, gid: &str) -> Result<String, String> {
        self.call("aria2.unpause", vec![serde_json::json!(gid)]).await
    }

    /// Remove/cancel a download
    pub async fn remove(&self, gid: &str) -> Result<String, String> {
        self.call("aria2.remove", vec![serde_json::json!(gid)]).await
    }

    /// Get global statistics
    pub async fn get_global_stat(&self) -> Result<GlobalStat, String> {
        self.call("aria2.getGlobalStat", vec![]).await
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadStatus {
    pub gid: String,
    pub status: String, // "active", "waiting", "paused", "error", "complete", "removed"
    pub total_length: String,
    pub completed_length: String,
    pub download_speed: String,
    #[serde(default)]
    pub files: Vec<FileInfo>,
}

impl DownloadStatus {
    pub fn get_progress(&self) -> f64 {
        let total: f64 = self.total_length.parse().unwrap_or(0.0);
        let completed: f64 = self.completed_length.parse().unwrap_or(0.0);
        
        if total > 0.0 {
            completed / total
        } else {
            0.0
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct FileInfo {
    pub path: String,
    pub length: String,
    #[serde(rename = "completedLength")]
    pub completed_length: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalStat {
    pub download_speed: String,
    pub num_active: String,
    pub num_waiting: String,
    pub num_stopped: String,
}

