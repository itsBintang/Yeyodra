# Ludasavi Implementation - Checkpoint 1

## ✅ Completed Tasks

### Fase 1: Analisis ✅
- Studied Hydra's implementation completely
- Documented architecture and data flow
- Identified all key components and their interactions

### Fase 2: Setup Ludasavi Binary & Config ✅
- ✅ Created `ludusavi/` folder in project root
- ✅ Copied `ludusavi.exe` from Hydra
- ✅ Copied `config.yaml` from Hydra
- ✅ Created README.md for ludusavi folder

### Fase 3.1: Buat Service Ludusavi (Rust) ✅
- ✅ Created `src-tauri/src/ludasavi.rs`
- ✅ Implemented `Ludasavi` struct with methods:
  - `new()` - Constructor
  - `init()` - Initialize binary and config
  - `get_config()` - Read config.yaml
  - `save_config()` - Write config.yaml
  - `backup_game()` - Execute backup via CLI
  - `get_backup_preview()` - Get backup preview
  - `add_custom_game()` - Add custom save path
- ✅ Added Rust types for Ludasavi:
  - `LudusaviScanChange`
  - `LudusaviGame`
  - `LudusaviBackup`
  - `LudusaviConfig`
  - All related structures

### Fase 3.2: Buat CloudSync Service (Partial) ✅
- ✅ Created `src-tauri/src/cloud_sync.rs`
- ✅ Implemented `CloudSync` struct with methods:
  - `new()` - Constructor
  - `get_backups_path()` - Get backups directory
  - `get_windows_like_user_profile_path()` - Cross-platform home path
  - `normalize_path()` - Path normalization
  - `get_backup_label()` - Generate backup labels
  - `bundle_backup()` - Create tar archive from backup
  - `upload_save_game()` - Upload backup to cloud (skeleton)
  - `download_game_artifact()` - Download backup from cloud (skeleton)

### Fase 4: Types & Dependencies ✅
- ✅ Updated `src/types/index.ts` with:
  - `LudusaviScanChange`
  - `LudusaviGame`
  - `LudusaviBackup`
  - `LudusaviConfig`
  - `LudusaviBackupMapping`
  - `GameArtifact`
  - `GameArtifactUploadPayload`
  - `GameArtifactDownloadResponse`
- ✅ Updated `Cargo.toml` with dependencies:
  - `serde_yaml` - For config parsing
  - `tar` - For tar archive handling
  - `flate2` - For compression
  - `hostname` - For getting machine name
- ✅ Updated `lib.rs` to include new modules

---

## 🔄 In Progress

### Fase 3.3: CloudSync Service - Restore Logic
- Need to implement restore logic that:
  1. Reads mapping.yaml from extracted backup
  2. Maps source paths to destination paths
  3. Handles Wine prefix path transformations
  4. Copies files to correct save locations
  
### Fase 4: Tauri Commands
- Need to implement Tauri commands for:
  - `get_game_backup_preview`
  - `upload_save_game`
  - `download_game_artifact`
  - `get_game_artifacts` (API call)
  - `select_game_backup_path`
  - `delete_game_artifact` (API call)
  - `toggle_artifact_freeze` (API call)
  - `rename_game_artifact` (API call)

---

## 📋 Pending Tasks

### Fase 4: Complete Tauri Commands
- Implement all cloud save commands
- Add event emitters for progress tracking
- Handle errors properly

### Fase 5: API Integration
- Need API endpoint configuration
- Implement API client for game artifacts
- Handle authentication if needed

### Fase 6: Frontend Context
- Create CloudSyncContext
- Implement state management
- Handle IPC communications

### Fase 7: UI Components
- CloudSyncModal
- CloudSyncFilesModal
- Integration with GameDetails page

### Fase 8: Automatic Backup
- Hook into game launcher
- Trigger backup on game start
- Trigger backup on game stop
- Add automatic backup settings

---

## 🔧 Technical Notes

### Ludusavi Binary Location
- **Resources**: `ludusavi/ludusavi.exe` (in project root, will be bundled)
- **Runtime**: Copied to app data directory on first run
- **Config**: `{APP_DATA}/ludusavi/config.yaml`

### Backup Flow
1. User triggers backup (manual or automatic)
2. Ludusavi scans save locations
3. Files copied to temp backup folder
4. Tar archive created
5. Upload to API server (presigned URL)
6. Cleanup temp files

### Restore Flow
1. User selects backup to restore
2. API provides download URL
3. Download tar file
4. Extract to temp location
5. Read mapping.yaml
6. Copy files to actual save locations
7. Cleanup temp files

### Path Handling (Cross-Platform)
- **Windows**: Direct path usage
- **Linux (Wine)**: Path transformation required
  - Read `user.reg` for USERPROFILE
  - Map `C:` to `drive_c`
  - Handle wine prefix properly

### API Endpoints (TODO)
These need to be configured:
- `POST /profile/games/artifacts` - Create artifact, get upload URL
- `GET /profile/games/artifacts?objectId={id}&shop={shop}` - List artifacts
- `POST /profile/games/artifacts/{id}/download` - Get download URL
- `DELETE /profile/games/artifacts/{id}` - Delete artifact
- `PATCH /profile/games/artifacts/{id}/freeze` - Toggle freeze
- `PATCH /profile/games/artifacts/{id}/rename` - Rename artifact

---

## 🐛 Known Issues / TODOs

1. **API Endpoints**: Placeholder URLs need to be replaced with actual endpoints
2. **Authentication**: Need to handle auth tokens for API calls
3. **Restore Logic**: Complex path mapping not yet implemented
4. **Progress Tracking**: Upload/download progress not yet emitted
5. **Error Handling**: Need more robust error handling
6. **Testing**: No tests yet

---

## 📦 Dependencies Added

### Rust Crates
```toml
serde_yaml = "0.9"
tar = "0.4"
flate2 = "1.0"
hostname = "0.4"
```

### Files Created
- `ludusavi/ludusavi.exe`
- `ludusavi/config.yaml`
- `ludusavi/README.md`
- `src-tauri/src/ludasavi.rs`
- `src-tauri/src/cloud_sync.rs`

### Files Modified
- `src/types/index.ts` - Added Ludasavi types
- `src-tauri/Cargo.toml` - Added dependencies
- `src-tauri/src/lib.rs` - Added module declarations

---

## 🎯 Next Steps

1. **Implement Restore Logic** in cloud_sync.rs
   - Parse mapping.yaml
   - Transform paths
   - Copy files to save locations

2. **Create Tauri Commands**
   - Implement all commands in lib.rs
   - Test basic backup flow locally

3. **Frontend Context**
   - Create CloudSyncContext
   - Implement IPC bindings

4. **UI Components**
   - Build CloudSyncModal
   - Build CloudSyncFilesModal

5. **Integration**
   - Add to GameDetails page
   - Test full flow

---

## 📝 Estimated Progress

- ✅ Phase 1 (Analysis): 100%
- ✅ Phase 2 (Setup): 100%
- 🔄 Phase 3 (Backend Services): 70%
- ⏳ Phase 4 (Tauri Commands): 0%
- ⏳ Phase 5 (Types & Context): 50%
- ⏳ Phase 6 (UI Components): 0%
- ⏳ Phase 7 (Integration): 0%

**Overall Progress: ~40%**


