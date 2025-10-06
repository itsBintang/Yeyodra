# Ludasavi Cloud Save Implementation Plan

## Overview
Implementasi fitur Cloud Save menggunakan Ludasavi untuk backup dan restore game saves, berdasarkan implementasi Hydra Launcher.

## Checkpoint Progress
- [x] Fase 1: Analisis Hydra Implementation
- [ ] Fase 2: Setup Ludasavi Binary & Config
- [ ] Fase 3: Backend Service Implementation
- [ ] Fase 4: Tauri Commands & API
- [ ] Fase 5: Frontend Types & Context
- [ ] Fase 6: UI Components
- [ ] Fase 7: Integration & Testing

---

## Fase 1: Analisis Hydra Implementation ✅

### Komponen Utama di Hydra:

#### 1. **Ludusavi Service** (`src/main/services/ludusavi.ts`)
- **Fungsi**: Wrapper untuk ludusavi binary
- **Key Methods**:
  - `getConfig()` - Baca config.yaml
  - `copyConfigFileToUserData()` - Copy config saat first run
  - `copyBinaryToUserData()` - Copy binary saat first run
  - `backupGame()` - Backup game save menggunakan CLI
  - `getBackupPreview()` - Preview backup tanpa execute
  - `addCustomGame()` - Tambah custom save path

#### 2. **CloudSync Service** (`src/main/services/cloud-sync.ts`)
- **Fungsi**: Handle upload/download backup ke cloud
- **Key Methods**:
  - `getWindowsLikeUserProfilePath()` - Get user profile path (cross-platform)
  - `bundleBackup()` - Bundle backup ke tar file
  - `uploadSaveGame()` - Upload backup ke server
  - `restoreLudusaviBackup()` - Restore backup dari tar

#### 3. **Process Watcher** (`src/main/services/process-watcher.ts`)
- **Fungsi**: Monitor game processes untuk automatic backup
- **Trigger Points**:
  - `onOpenGame()` - Backup saat game start (line 220-227)
  - `onCloseGame()` - Backup saat game stop (line 291-297)

#### 4. **Event Handlers** (`src/main/events/cloud-save/`)
- `get-game-backup-preview.ts` - Get preview files yang akan di-backup
- `upload-save-game.ts` - Trigger upload backup
- `download-game-artifact.ts` - Download & restore backup
- `get-game-artifacts.ts` - List semua backup artifacts
- `select-game-backup-path.ts` - Set custom backup path
- `delete-game-artifact.ts` - Delete backup
- `toggle-artifact-freeze.ts` - Freeze backup (prevent auto-delete)
- `rename-game-artifact.ts` - Rename backup label

#### 5. **Frontend Context** (`src/renderer/src/context/cloud-sync/`)
- **CloudSyncContext**: Central state management
- **State**:
  - `backupPreview` - Preview data dari ludusavi
  - `artifacts` - List of cloud backups
  - `backupState` - New/Different/Same/Unknown
  - `restoringBackup` - Download progress flag
  - `uploadingBackup` - Upload progress flag

#### 6. **UI Components**
- **CloudSyncModal**: Main modal untuk manage backups
- **CloudSyncFilesModal**: Modal untuk configure save paths
- **CloudSyncRenameArtifactModal**: Rename backup labels

---

## Fase 2: Setup Ludasavi Binary & Config

### Task 2.1: Copy Ludasavi Files
- Copy `ludusavi/ludusavi.exe` dari Hydra
- Copy `ludusavi/config.yaml` dari Hydra
- Buat folder structure di Chaos project

### Task 2.2: Update Config
- Sesuaikan config.yaml untuk Chaos
- Setup manifest URL jika perlu

---

## Fase 3: Backend Service Implementation

### Task 3.1: Buat Ludasavi Service (Rust)
File: `src-tauri/src/ludasavi.rs`
- Struct `Ludasavi`
- Methods:
  - `init()` - Setup binary dan config
  - `backup_game()` - Execute backup
  - `get_backup_preview()` - Preview backup
  - `add_custom_game()` - Custom save path
  - `get_config()` - Read config

### Task 3.2: Buat CloudSync Service (Rust)
File: `src-tauri/src/cloud_sync.rs`
- Struct `CloudSync`
- Methods:
  - `bundle_backup()` - Create tar from backup
  - `upload_save_game()` - Upload to API
  - `download_backup()` - Download from API
  - `restore_backup()` - Extract & restore tar
  - `get_backup_label()` - Generate backup label

### Task 3.3: Types & Structures
File: `src-tauri/src/types.rs` (atau file baru)
- `LudusaviBackup`
- `LudusaviConfig`
- `LudusaviGame`
- `GameArtifact`

---

## Fase 4: Tauri Commands & API

### Task 4.1: Implement Tauri Commands
File: `src-tauri/src/lib.rs`
- `get_game_backup_preview()`
- `upload_save_game()`
- `download_game_artifact()`
- `get_game_artifacts()`
- `select_game_backup_path()`
- `delete_game_artifact()`
- `toggle_artifact_freeze()`
- `rename_game_artifact()`

### Task 4.2: Event Emitters
- `on-upload-complete`
- `on-backup-download-complete`
- `on-backup-download-progress`

---

## Fase 5: Frontend Types & Context

### Task 5.1: Types Definition
File: `src/types/index.ts`
- Export Ludasavi types
- Export GameArtifact types

### Task 5.2: CloudSync Context
File: `src/contexts/cloud-sync.tsx`
- CloudSyncContext provider
- State management
- API calls wrapper

---

## Fase 6: UI Components

### Task 6.1: CloudSyncModal
File: `src/components/CloudSyncModal/`
- List backups
- Upload button
- Restore button
- Delete button
- Freeze/Unfreeze

### Task 6.2: CloudSyncFilesModal
File: `src/components/CloudSyncFilesModal/`
- Automatic mapping
- Manual path selection
- File list preview

### Task 6.3: Integration di GameDetails
- Add cloud save button
- Integrate CloudSyncContext
- Show backup status

---

## Fase 7: Integration & Testing

### Task 7.1: Automatic Backup Integration
- Hook ke game launcher
- Backup saat game start
- Backup saat game stop

### Task 7.2: API Integration
- Setup API endpoints (jika belum ada)
- Test upload/download
- Handle errors

### Task 7.3: Testing
- Manual testing
- Edge cases
- Cross-platform testing (Windows/Linux)

---

## Technical Notes

### Ludusavi CLI Usage
```bash
# Preview backup
ludusavi --config <config_path> backup <game_id> --api --preview

# Execute backup
ludusavi --config <config_path> backup <game_id> --api --force --path <backup_path>

# With wine prefix (Linux)
ludusavi --config <config_path> backup <game_id> --api --wine-prefix <prefix_path>
```

### Backup Flow
1. User clicks "Create Backup" atau game close (auto)
2. Ludusavi scans save locations
3. Files copied ke temp backup folder
4. Tar archive created
5. Upload to API server
6. Cleanup temp files

### Restore Flow
1. User clicks "Restore Backup"
2. Download tar from API
3. Extract tar to temp location
4. Read mapping.yaml untuk file locations
5. Copy files ke actual save locations
6. Cleanup temp files

### Key Differences vs Hydra
- Chaos uses Tauri (Rust) instead of Electron (Node.js)
- Need to adapt file handling for Tauri
- Need to adapt IPC for Tauri commands
- API endpoints might be different

---

## Dependencies Needed

### Rust Crates
- `tar` - For tar archive handling
- `flate2` - For compression
- `reqwest` - For HTTP uploads/downloads
- `serde_yaml` - For config.yaml parsing
- `tokio` - Async runtime

### Frontend Packages
- Already have most (React, etc.)
- Might need additional for file handling

---

## Next Steps
1. Start with Fase 2: Copy ludusavi files
2. Implement basic Ludasavi service (Fase 3.1)
3. Test basic backup/restore locally
4. Add cloud integration
5. Build UI components
6. Full integration testing

