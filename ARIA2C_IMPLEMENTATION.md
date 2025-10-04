# Aria2c Implementation Plan for Chaos

## Overview
Implementasi aria2c untuk download manager di Chaos, mengikuti arsitektur Hydra tetapi menggunakan Rust native.

## Architecture Comparison

### Hydra (Electron + Node.js + Python)
```
Electron Main Process
  ├── Aria2.ts (spawn aria2c binary)
  ├── PythonRPC.ts (spawn Python Flask server)
  └── DownloadManager.ts (koordinasi downloads)
      └── HTTP via Python + aria2p library
```

### Chaos (Tauri + Rust)
```
Tauri Rust Backend
  ├── aria2.rs (spawn & manage aria2c process)
  ├── download_manager.rs (download coordination)
  └── Direct RPC to aria2c via HTTP/JSON-RPC
```

## Implementation Steps

### 1. Backend (Rust)

#### 1.1 Aria2 Process Manager
- File: `src-tauri/src/aria2.rs`
- Spawn aria2c with RPC enabled
- Manage process lifecycle
- Configuration:
  ```
  --enable-rpc
  --rpc-listen-all
  --rpc-listen-port=6800
  --file-allocation=none
  --allow-overwrite=true
  --max-connection-per-server=16
  --split=16
  --min-split-size=1M
  ```

#### 1.2 Aria2 RPC Client
- HTTP/JSON-RPC 2.0 client
- Methods to implement:
  - `aria2.addUri` - Add download
  - `aria2.tellStatus` - Get download status
  - `aria2.pause` - Pause download
  - `aria2.unpause` - Resume download
  - `aria2.remove` - Cancel download
  - `aria2.getGlobalStat` - Get global stats

#### 1.3 Download Manager
- File: `src-tauri/src/download_manager.rs`
- Queue management
- Progress tracking
- Event emission to frontend

#### 1.4 Tauri Commands
```rust
#[tauri::command]
async fn start_download(url: String, save_path: String) -> Result<String, String>

#[tauri::command]
async fn pause_download(gid: String) -> Result<(), String>

#[tauri::command]
async fn resume_download(gid: String) -> Result<(), String>

#[tauri::command]
async fn cancel_download(gid: String) -> Result<(), String>

#[tauri::command]
async fn get_download_status(gid: String) -> Result<DownloadStatus, String>
```

### 2. Frontend (React + TypeScript)

#### 2.1 Download Hook
- File: `src/hooks/useDownload.ts`
- State management for downloads
- Tauri command wrappers
- Event listeners for progress updates

#### 2.2 Downloads Page Updates
- Display active downloads
- Show progress bars
- Controls (pause/resume/cancel)
- Queue management UI

### 3. Aria2c Binary
- Download aria2c binary for Windows
- Place in `binaries/` folder
- Include in Tauri bundle configuration

## Data Flow

```
1. User clicks Download button
   ↓
2. Frontend calls start_download command
   ↓
3. Rust backend:
   - Adds download to aria2c via RPC
   - Stores download info in state
   ↓
4. Periodic polling or event listening:
   - Get status from aria2c
   - Emit event to frontend
   ↓
5. Frontend updates UI with progress
```

## Key Differences from Hydra

1. **No Python Layer**: Direct Rust to aria2c communication
2. **Native Performance**: Rust for all backend logic
3. **Simplified Stack**: No Flask/libtorrent, just aria2c
4. **Type Safety**: Full type safety from backend to frontend

## Dependencies

### Rust (Cargo.toml)
```toml
[dependencies]
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
```

### TypeScript
- No additional dependencies needed
- Use existing Tauri API

## Configuration

### aria2c Binary Location
- Development: `binaries/aria2c.exe`
- Production: Bundled with app resources

### RPC Settings
- Host: `http://localhost`
- Port: `6800`
- Secret: Generated and stored securely

## Testing Plan

1. Test aria2c process spawning
2. Test RPC communication
3. Test download lifecycle (start/pause/resume/cancel)
4. Test progress updates
5. Test error handling
6. Test queue management
7. Integration test with real downloads

