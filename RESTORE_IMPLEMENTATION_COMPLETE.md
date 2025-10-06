# Restore Implementation - Local Backup Mode

## 🎯 IMPLEMENTATION COMPLETE

Full restore functionality implemented untuk local-only backup mode, based on Hydra's fundamental architecture.

## ✅ COMPLETED FEATURES

### Backend (Rust)
1. ✅ **Types for mapping.yaml** (`src-tauri/src/ludasavi.rs`)
   - `LudusaviMapping`
   - `LudusaviMappingBackup`
   - `LudusaviMappingFileInfo`

2. ✅ **LocalBackup type** (`src-tauri/src/cloud_sync.rs`)
   - Metadata for local backup listing

3. ✅ **list_local_backups()** (`src-tauri/src/cloud_sync.rs`)
   - Scans `backups/` directory for .tar files
   - Reads `mapping.yaml` from each tar
   - Returns list of backups for specific game

4. ✅ **restore_from_local_backup()** (`src-tauri/src/cloud_sync.rs`)
   - Extracts tar file
   - Reads mapping.yaml
   - Transforms paths (backup home → current home)
   - Copies files to destination

5. ✅ **Tauri Commands** (`src-tauri/src/lib.rs`)
   - `get_game_artifacts` → returns `Vec<LocalBackup>`
   - `download_game_artifact` → calls `restore_from_local_backup`

### Frontend (TypeScript)
1. ✅ **LocalBackup interface** (`src/types/index.ts`)
2. ✅ **CloudSyncContext updated** (`src/contexts/cloud-sync.tsx`)
   - Changed `GameArtifact[]` → `LocalBackup[]`
   - No other changes needed!

## 🔄 HOW IT WORKS

### List Backups Flow:
```
User opens Cloud Save modal
    ↓
Frontend calls getGameArtifacts()
    ↓
Backend: list_local_backups(objectId, shop)
    ↓
Scan backups/*.tar files
    ↓
For each .tar:
  - Extract {objectId}/mapping.yaml
  - Parse YAML to get metadata
  - Create LocalBackup object
    ↓
Return list sorted by date (newest first)
    ↓
Frontend displays in modal
```

### Restore Flow:
```
User clicks backup in list
    ↓
Frontend calls downloadGameArtifact(backupId)
    ↓
Backend: restore_from_local_backup(backupId, objectId, shop)
    ↓
1. Open tar file: backups/{backupId}.tar
2. Extract to: backups/steam-413150-restore/
3. Read mapping.yaml
4. For each file in backup:
   a. Get source: extract_path/413150/drive-C/Users/.../file
   b. Transform destination:
      - Extract backup home: C:/Users/OldUser
      - Get current home: C:/Users/Nazril
      - Replace: C:/Users/OldUser → C:/Users/Nazril
   c. Copy file to destination
5. Cleanup extract directory
    ↓
Files restored to correct locations!
```

## 📝 CODE HIGHLIGHTS

### Path Transformation (Core Logic)
```rust
// Example transformation:
// Backup: "C:/Users/OldUser/AppData/Roaming/StardewValley/Saves/file"
// Current: "C:/Users/Nazril"
// Result: "C:/Users/Nazril/AppData/Roaming/StardewValley/Saves/file"

for (file_path, _file_info) in &backup_info.files {
    // 1. Transform to archive structure
    let mut source_path_with_drives = file_path.clone();
    for (drive_key, drive_value) in &mapping.drives {
        source_path_with_drives = source_path_with_drives.replace(drive_value, drive_key);
    }
    // "C:/Users/.../file" → "drive-C/Users/.../file"
    
    let source_path = game_backup_path.join(&source_path_with_drives);
    // "backups/.../413150/drive-C/Users/.../file"
    
    // 2. Get destination with current user
    let backup_home = self.extract_home_from_path(file_path)?;
    // "C:/Users/OldUser"
    
    let destination_path = file_path.replace(&backup_home, current_home);
    // "C:/Users/Nazril/AppData/Roaming/.../file"
    
    // 3. Copy file
    fs::copy(&source_path, &dest_path)?;
}
```

### Reading Metadata from Tar
```rust
fn read_backup_metadata(&self, tar_path: &PathBuf, object_id: &str) -> Result<Option<LocalBackup>> {
    let tar_file = File::open(tar_path)?;
    let mut archive = tar::Archive::new(tar_file);
    
    let mapping_path = format!("{}/mapping.yaml", object_id);
    
    for entry in archive.entries()? {
        let mut entry = entry?;
        if entry.path()?.to_str() == Some(&mapping_path) {
            let mut content = String::new();
            entry.read_to_string(&mut content)?;
            
            let mapping: LudusaviMapping = serde_yaml::from_str(&content)?;
            
            // Extract metadata and return LocalBackup
            ...
        }
    }
}
```

## 🧪 TESTING CHECKLIST

### Test 1: List Local Backups
- [ ] Open Cloud Save modal for Stardew Valley
- [ ] Verify backup created earlier is listed
- [ ] Check backup shows:
  - Correct label ("Backup from 2025-10-06")
  - File count (5 files)
  - Size (2.98 MB)
  - Platform (windows)

### Test 2: Restore Backup
**Prerequisites:**
1. Make backup of current save files (manual copy)
2. Modify a save file (e.g., delete SaveGameInfo)
3. Verify game shows modified state

**Test Steps:**
- [ ] Click on backup in list
- [ ] Confirm restore dialog
- [ ] Check console logs:
  ```
  [CloudSync] Restoring backup: 9dc8ab29-8c29-40fd-8b21-241adf8b5b7e.tar
  [CloudSync] Extracting tar file...
  [CloudSync] Mapping loaded. Found 1 backups
  [CloudSync] Current home directory: C:/Users/Nazril
  [CloudSync] Restoring 5 files...
  [CloudSync] Restoring: ... -> ...
  [CloudSync] ✓ Restore completed successfully
  ```
- [ ] Verify files restored:
  ```powershell
  Get-ChildItem "$env:APPDATA\StardewValley\Saves" -Recurse
  ```
- [ ] Launch Stardew Valley
- [ ] Verify save game works correctly

### Test 3: Cross-User Restore
**Simulate different user:**
1. Create backup on current PC
2. Manually edit mapping.yaml to change username
3. Restore and verify path transformation works

## 📂 FILE STRUCTURE

### Backup Directory:
```
%APPDATA%\com.nazril.tauri-app\backups\
├── 9dc8ab29-8c29-40fd-8b21-241adf8b5b7e.tar    (backup 1)
├── a1b2c3d4-e5f6-7890-abcd-ef1234567890.tar    (backup 2)
└── steam-413150\                                (temp during backup creation)
    └── StardewValley\
        └── ...
```

### Restore Process Temp:
```
%APPDATA%\com.nazril.tauri-app\backups\
└── steam-413150-restore\                        (temp during restore)
    └── 413150\
        ├── mapping.yaml
        └── drive-C\
            └── Users\
                └── Nazril\
                    └── AppData\
                        └── Roaming\
                            └── StardewValley\
                                └── ...
```

## 🔐 SAFETY FEATURES

1. **Overwrite Protection**: Asks confirmation before restore (frontend TODO)
2. **Cleanup**: Removes temp directories after restore
3. **Error Handling**: All errors propagated to frontend with clear messages
4. **Path Validation**: Verifies source files exist before copy
5. **Directory Creation**: Creates destination directories if missing

## ⚠️ LIMITATIONS (Local-Only Mode)

1. **No Cloud Storage**: Backups only on local machine
2. **No Sync**: Can't transfer backups between PCs
3. **No Version Management**: Each backup is independent
4. **Manual Cleanup**: User must manually delete old backups if needed

## 🚀 FUTURE ENHANCEMENTS (When API Ready)

1. **Cloud Upload**: Upload tar files to S3
2. **Cloud Download**: Download from API instead of local
3. **Backup List from API**: Get artifact list from database
4. **Automatic Cleanup**: Delete local tar after cloud upload
5. **Cross-Device Sync**: Restore backups from other devices

## 📊 COMPARISON WITH HYDRA

| Feature | Hydra | Chaos (Current) |
|---------|-------|-----------------|
| Backup Creation | ✅ Ludusavi + Tar | ✅ Same |
| Cloud Upload | ✅ S3 via API | ❌ Local only |
| Backup Listing | ✅ From API | ✅ From local .tar files |
| Restore | ✅ Download + Extract | ✅ Extract local .tar |
| Path Transformation | ✅ Full cross-user | ✅ Full cross-user |
| Wine Support | ✅ Linux compatible | ⚠️ Windows only (structure ready) |

---

**Date:** October 6, 2025
**Status:** ✅ Implementation Complete - Ready for Testing
**Next:** User acceptance testing with Stardew Valley restore

