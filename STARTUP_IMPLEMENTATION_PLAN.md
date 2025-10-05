# Startup Implementation Plan

## Current Status ✅

### Implemented
- ✅ Basic app initialization (`setup.rs`)
- ✅ Aria2c startup and shutdown
- ✅ User preferences loading on startup
- ✅ Cleanup on app exit
- ✅ Console logging for initialization steps

## Future Enhancements 📋

Based on Hydra's `loadState()` function in `src/main/main.ts`, here are the features to implement:

### 1. Download Queue Management
**Priority**: High  
**Reference**: Hydra `main.ts` lines 57-83

**Tasks**:
- [ ] Check for downloads with status "queued"
- [ ] Resume the first queued download on startup
- [ ] Reset "extracting" status for interrupted extractions
- [ ] Load download state from database/file system

**Implementation**:
```rust
// In setup.rs
pub fn resume_downloads(app_handle: &AppHandle) -> Result<(), String> {
    // 1. Get all downloads from history
    // 2. Filter downloads with queued status
    // 3. Resume first in queue
    // 4. Reset extracting status for interrupted downloads
}
```

---

### 2. Seeding Management (Torrent)
**Priority**: Medium  
**Reference**: Hydra `main.ts` lines 75-81

**Tasks**:
- [ ] Find completed downloads that should seed
- [ ] Check if downloader is Torrent
- [ ] Verify progress is 100%
- [ ] Start seeding via Aria2c RPC

**Implementation**:
```rust
// In setup.rs
pub fn start_seeding(app_handle: &AppHandle) -> Result<(), String> {
    // 1. Get downloads with shouldSeed = true
    // 2. Filter by downloader = Torrent and progress = 1
    // 3. Start seeding via Aria2c
}
```

---

### 3. System Path Validation
**Priority**: Medium  
**Reference**: Hydra `main.ts` line 89

**Tasks**:
- [ ] Check if downloads directory exists and is writable
- [ ] Check if temporary directory exists and is writable
- [ ] Validate SteamTools installation path
- [ ] Check disk space availability

**Implementation**:
```rust
// In setup.rs
pub fn validate_system_paths(app_handle: &AppHandle) -> Result<(), String> {
    let prefs = get_user_preferences(app_handle)?;
    
    // Check downloads path
    if let Some(path) = prefs.downloads_path {
        // Validate existence and permissions
    }
    
    // Check temp directory
    // Check SteamTools path
    // Check disk space
}
```

---

### 4. Main Loop / Background Tasks
**Priority**: Medium  
**Reference**: Hydra `main.ts` line 85

**Tasks**:
- [ ] Create background task loop
- [ ] Monitor download progress
- [ ] Update playtime for running games
- [ ] Sync library changes
- [ ] Check for app updates

**Implementation**:
```rust
// Create new file: src-tauri/src/background_tasks.rs
pub struct BackgroundTaskManager {
    // Task handles
}

impl BackgroundTaskManager {
    pub fn start() -> Self {
        // Start background tasks
        // - Download monitor
        // - Playtime tracker
        // - Library sync
    }
    
    pub fn stop(&self) {
        // Stop all background tasks
    }
}
```

---

### 5. Common Redistributables Download
**Priority**: Low  
**Reference**: Hydra `main.ts` line 87

**Tasks**:
- [ ] Check for required redistributables (DirectX, VC++, .NET)
- [ ] Download if missing
- [ ] Install silently in background

**Implementation**:
```rust
// Create new file: src-tauri/src/redist_manager.rs
pub async fn download_common_redist() -> Result<(), String> {
    // Check for DirectX
    // Check for VC++ 2015-2022
    // Check for .NET Framework
    // Download and install if needed
}
```

---

### 6. Lock/Mutex System
**Priority**: Medium  
**Reference**: Hydra `main.ts` line 22

**Tasks**:
- [ ] Implement file-based lock to prevent multiple instances
- [ ] Acquire lock on startup
- [ ] Release lock on exit
- [ ] Handle lock timeout

**Implementation**:
```rust
// Create new file: src-tauri/src/lock.rs
pub struct AppLock {
    lock_file_path: PathBuf,
}

impl AppLock {
    pub fn acquire() -> Result<Self, String> {
        // Create lock file
        // Write PID to lock file
        // Check if another instance is running
    }
    
    pub fn release(&self) -> Result<(), String> {
        // Delete lock file
    }
}
```

---

### 7. Auto-Update System
**Priority**: Low

**Tasks**:
- [ ] Check for app updates on startup
- [ ] Download updates in background
- [ ] Notify user when update is ready
- [ ] Apply updates on next restart

**Implementation**:
```rust
// In setup.rs
pub async fn check_for_updates(app_handle: &AppHandle) -> Result<(), String> {
    // Use Tauri's built-in updater
    // Or implement custom update checker
}
```

---

### 8. Crash Recovery
**Priority**: Medium

**Tasks**:
- [ ] Detect if previous session crashed
- [ ] Save session state periodically
- [ ] Restore downloads on crash recovery
- [ ] Clean up corrupted files

**Implementation**:
```rust
// In setup.rs
pub fn check_crash_recovery(app_handle: &AppHandle) -> Result<(), String> {
    // Check for crash flag file
    // If found, attempt recovery
    // Restore downloads
    // Clean up temp files
}
```

---

## Implementation Order (Recommended)

1. **Phase 1** (Essential)
   - Lock/Mutex system
   - Download queue management
   - System path validation

2. **Phase 2** (Important)
   - Main loop / background tasks
   - Crash recovery
   - Seeding management

3. **Phase 3** (Nice to have)
   - Common redistributables
   - Auto-update system

---

## Testing Checklist

For each feature implementation:
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Manual testing completed
- [ ] Error handling verified
- [ ] Performance impact measured
- [ ] Documentation updated

---

## Notes

- All implementations should follow Hydra's architecture as reference
- Use Rust's async/await for long-running operations
- Implement proper error handling and logging
- Consider Windows-specific requirements (paths, permissions)
- Test on different system configurations

---

## References

- Hydra Source: `C:\Users\Nazril\Documents\hydra\src\main\main.ts`
- Tauri Docs: https://tauri.app/
- Aria2c RPC: https://aria2.github.io/manual/en/html/aria2c.html

