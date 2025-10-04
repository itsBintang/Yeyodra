# Aria2c Implementation Status

## ✅ Completed (Backend)

### 1. Aria2 Process Manager (`src-tauri/src/aria2.rs`)
**Status: COMPLETED**

Implementasi lengkap untuk:
- ✅ Spawn aria2c process dengan RPC enabled
- ✅ Configuration optimization (16 connections, split download)
- ✅ Process lifecycle management (start/stop)
- ✅ Secure RPC secret generation
- ✅ Global singleton instance

**Fitur:**
```rust
// Auto-start on app init
aria2::init()

// Auto-shutdown on app exit
aria2::shutdown()
```

### 2. Aria2 RPC Client (`src-tauri/src/aria2.rs`)
**Status: COMPLETED**

JSON-RPC 2.0 client dengan methods:
- ✅ `add_uri()` - Add new download
- ✅ `tell_status()` - Get download status & progress
- ✅ `pause()` - Pause download
- ✅ `unpause()` - Resume paused download
- ✅ `remove()` - Cancel/remove download
- ✅ `get_global_stat()` - Get global download statistics

**Type-safe structures:**
```rust
DownloadStatus {
    gid: String,
    status: String,
    total_length: String,
    completed_length: String,
    download_speed: String,
    files: Vec<FileInfo>,
}
```

### 3. Tauri Commands (`src-tauri/src/lib.rs`)
**Status: COMPLETED**

Frontend-accessible commands:
- ✅ `start_download(url, save_path, filename)`
- ✅ `pause_download(gid)`
- ✅ `resume_download(gid)`
- ✅ `cancel_download(gid)`
- ✅ `get_download_status(gid)`
- ✅ `get_global_download_stat()`

### 4. Dependencies (`Cargo.toml`)
**Status: COMPLETED**

Added dependencies:
- ✅ `uuid` - For secure secret generation
- ✅ `once_cell` - For global singleton
- ✅ `reqwest` (already present) - For HTTP/RPC client
- ✅ `serde_json` (already present) - For JSON serialization

## 📦 Setup Required

### Binary Setup
**Action Required:** Download aria2c binary

1. Download aria2c for Windows:
   ```
   https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip
   ```

2. Extract `aria2c.exe`

3. Place in: `binaries/aria2c.exe`

4. Verify file structure:
   ```
   C:\Users\Nazril\Documents\ProjekV2\Chaos\
     ├── binaries\
     │   └── aria2c.exe    ← Place here
     ├── src-tauri\
     └── ...
   ```

## 🔄 Next Steps (Frontend Integration)

### 1. TypeScript Types (`src/types/index.ts`)
**Status: PENDING**

Add types for aria2c:
```typescript
export interface DownloadStatus {
  gid: string;
  status: 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed';
  totalLength: string;
  completedLength: string;
  downloadSpeed: string;
  files: FileInfo[];
}

export interface FileInfo {
  path: string;
  length: string;
  completedLength: string;
}

export interface GlobalStat {
  downloadSpeed: string;
  numActive: string;
  numWaiting: string;
  numStopped: string;
}
```

### 2. Download Hook (`src/hooks/useDownload.ts`)
**Status: PENDING**

Create React hook for download management:
```typescript
export function useDownload() {
  const startDownload = async (url: string, savePath: string) => {
    return await invoke('start_download', { url, savePath });
  };

  const pauseDownload = async (gid: string) => {
    return await invoke('pause_download', { gid });
  };

  // ... more methods

  return {
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    getDownloadStatus,
  };
}
```

### 3. Downloads Page Update
**Status: PENDING**

Update `src/pages/Downloads.tsx`:
- Display active downloads
- Show progress bars
- Add pause/resume/cancel buttons
- Real-time status updates

### 4. Download Integration in Game Details
**Status: PENDING**

Update `src/pages/GameDetails.tsx`:
- Connect Download button to aria2c
- Start download when user clicks Download
- Show download progress

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CHAOS APP                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  FRONTEND (React + TypeScript)                     │    │
│  │                                                     │    │
│  │  ┌──────────────┐     ┌──────────────┐            │    │
│  │  │  Game Details│     │   Downloads  │            │    │
│  │  │     Page     │     │     Page     │            │    │
│  │  └──────┬───────┘     └──────┬───────┘            │    │
│  │         │                    │                     │    │
│  │         └────────┬───────────┘                     │    │
│  │                  │                                  │    │
│  │         ┌────────▼────────┐                        │    │
│  │         │  useDownload()  │                        │    │
│  │         │      Hook       │                        │    │
│  │         └────────┬────────┘                        │    │
│  └──────────────────┼─────────────────────────────────┘    │
│                     │ Tauri Invoke                          │
│                     │                                       │
│  ┌──────────────────▼─────────────────────────────────┐    │
│  │  BACKEND (Rust)                                    │    │
│  │                                                     │    │
│  │  ┌─────────────────────────────────────────┐      │    │
│  │  │       Tauri Commands                    │      │    │
│  │  │  - start_download()                     │      │    │
│  │  │  - pause_download()                     │      │    │
│  │  │  - get_download_status()                │      │    │
│  │  └───────────┬─────────────────────────────┘      │    │
│  │              │                                     │    │
│  │  ┌───────────▼──────────────────────────────┐    │    │
│  │  │      Aria2Client (RPC)                   │    │    │
│  │  │  - JSON-RPC 2.0 over HTTP                │    │    │
│  │  └───────────┬──────────────────────────────┘    │    │
│  └──────────────┼────────────────────────────────────┘    │
│                 │ HTTP (localhost:6800)                    │
│  ┌──────────────▼────────────────────────────────────┐    │
│  │         aria2c Process                            │    │
│  │  - Multi-threaded downloader                      │    │
│  │  - 16 connections per file                        │    │
│  │  - Resume capability                              │    │
│  │  - RPC server on port 6800                        │    │
│  └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 📝 Comparison with Hydra

| Feature | Hydra | Chaos |
|---------|-------|-------|
| Language | Node.js + Python | Rust |
| RPC Method | Python → aria2p | Direct HTTP/JSON-RPC |
| Performance | Good | Excellent (Native) |
| Type Safety | Limited | Full (Rust + TS) |
| Dependencies | Many (Electron, Python, Flask) | Few (Tauri, Rust) |
| Binary Size | Large (~150MB) | Small (~10MB) |
| Memory Usage | High | Low |

## 🔧 Testing Commands

Once binary is in place, test aria2c:

```bash
# 1. Build Rust backend
cd src-tauri
cargo build

# 2. Run app in dev mode
cd ..
npm run tauri dev

# 3. Open DevTools and test:
await invoke('start_download', { 
  url: 'https://example.com/file.zip',
  savePath: 'C:\\Downloads',
  filename: 'test.zip'
})
```

## ⚠️ Important Notes

1. **Binary Requirement**: aria2c.exe MUST be in `binaries/` folder
2. **Port 6800**: Make sure port 6800 is not in use
3. **Antivirus**: Some antivirus may flag aria2c - add exception if needed
4. **Windows Only**: Current implementation is Windows-specific
5. **Production Bundle**: Need to configure Tauri to bundle aria2c.exe

## 🎉 Benefits Over Hydra's Approach

1. **No Python Layer**: Direct Rust implementation = faster & lighter
2. **Type Safety**: Full type safety from Rust to TypeScript
3. **Native Performance**: No JavaScript/Python overhead
4. **Simpler Stack**: Less dependencies = easier maintenance
5. **Better Resource Usage**: Lower memory and CPU usage
6. **Smaller Bundle**: Final app size will be much smaller

## 📚 Documentation

- Aria2 RPC Docs: https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface
- Tauri Commands: https://tauri.app/develop/calling-rust/
- Implementation Plan: See `ARIA2C_IMPLEMENTATION.md`

