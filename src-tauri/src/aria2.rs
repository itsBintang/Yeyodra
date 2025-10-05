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
    pub fn spawn(port: u16, secret: String) -> Result<Self, String> {
        let binary_path = if cfg!(debug_assertions) {
            // Development: use binary from workspace root binaries folder
            let current_dir = std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?;
            
            // Check if we're in src-tauri directory, if so go up one level
            let workspace_root = if current_dir.ends_with("src-tauri") {
                current_dir.parent()
                    .ok_or("Failed to get parent directory")?
                    .to_path_buf()
            } else {
                current_dir
            };
            
            workspace_root.join("binaries").join("aria2c.exe")
        } else {
            // Production: use bundled binary
            let exe_dir = std::env::current_exe()
                .map_err(|e| format!("Failed to get executable directory: {}", e))?
                .parent()
                .ok_or("Failed to get parent directory")?
                .to_path_buf();
            exe_dir.join("aria2c.exe")
        };

        if !binary_path.exists() {
            return Err(format!("aria2c binary not found at: {:?}", binary_path));
        }

        let mut command = Command::new(binary_path);
        command.args(&[
            "--enable-rpc",
            "--rpc-listen-all=false",
            &format!("--rpc-listen-port={}", port),
            &format!("--rpc-secret={}", secret),
            "--file-allocation=none",
            "--allow-overwrite=true",
            "--max-connection-per-server=16",
            "--split=16",
            "--min-split-size=1M",
            "--continue=true",
            "--auto-file-renaming=false",
            "--quiet=true",
        ]);

        // Hide console window on Windows in release builds
        #[cfg(all(windows, not(debug_assertions)))]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
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
pub fn init() -> Result<(), String> {
    let mut instance = ARIA2_INSTANCE.lock().unwrap();
    
    if instance.is_some() {
        return Ok(()); // Already initialized
    }

    // Generate a secure random secret
    let secret = uuid::Uuid::new_v4().to_string();
    let port = 6800;

    let aria2 = Aria2Process::spawn(port, secret)?;
    *instance = Some(aria2);

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

