# Local Backup Mode - Development/Testing

## 🎯 PURPOSE

Enable local-only backup functionality for **development and testing** without requiring cloud API server.

## 🔧 IMPLEMENTATION

### Backend Changes (`src-tauri/src/cloud_sync.rs`)

**Modified:** `upload_save_game()` function

```rust
pub async fn upload_save_game(...) -> Result<()> {
    // 1. Create backup using Ludusavi
    let tar_location = self.bundle_backup(shop, object_id, wine_prefix)?;
    
    // 2. Get file metadata
    let metadata = fs::metadata(&tar_location)?;
    let file_size = metadata.len();

    // 3. Log backup info
    println!("[CloudSync] ✓ Backup created successfully!");
    println!("[CloudSync]   Location: {:?}", tar_location);
    println!("[CloudSync]   Size: {} bytes ({:.2} MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
    
    // 4. TODO: LOCAL-ONLY MODE - Skip API upload for now
    // All API code is commented out with /* ... */
    
    // 5. Return success immediately
    println!("[CloudSync] ✓ Backup saved locally (cloud upload disabled)");
    Ok(())
}
```

**What's Disabled:**
- ❌ API request to get presigned upload URL
- ❌ File upload to cloud storage
- ❌ Cleanup of local tar file after upload

**What Works:**
- ✅ Ludusavi backup creation
- ✅ Tar archive creation
- ✅ Local file storage
- ✅ Success/error handling

### Frontend Changes (`src/contexts/cloud-sync.tsx`)

**Modified:** Success toast message

```typescript
showSuccessToast("Backup created successfully! (Saved locally)");
```

Makes it clear to users that backup is **local-only** for now.

## 📂 BACKUP LOCATION

### Path Structure:
```
%APPDATA%\com.nazril.tauri-app\backups\
├── steam-413150\              (backup directory)
│   └── [game save files]
└── [uuid].tar                 (compressed backup)
```

### Example (Stardew Valley):
```
C:\Users\Nazril\AppData\Roaming\com.nazril.tauri-app\backups\
├── steam-413150\
│   └── StardewValley\
│       ├── Saves\
│       │   └── asdass_418019374\
│       │       ├── SaveGameInfo
│       │       └── asdass_418019374
│       └── default_options
└── 3a7b2c1d-8e4f-9a5b-6c3d-2e1f4a8b7c9d.tar
```

### Backup Contents:
1. **Save Files**: Actual game save data
2. **Config Files**: Game settings/preferences
3. **Metadata**: Automatically included by Ludusavi

## 🧪 TESTING

### Test Upload:
1. Open game details (e.g., Stardew Valley)
2. Click "Cloud Save" button
3. Click "Upload" (without label)
4. ✅ Success: "Backup created successfully! (Saved locally)"

### Verify Backup:
```powershell
# Check backup directory
PS> Get-ChildItem "$env:APPDATA\com.nazril.tauri-app\backups"

# Check backup files
PS> Get-ChildItem "$env:APPDATA\com.nazril.tauri-app\backups\steam-413150"

# Check tar file
PS> Get-ChildItem "$env:APPDATA\com.nazril.tauri-app\backups" -Filter "*.tar"
```

### Expected Console Output:
```
[CloudSync] Getting backup preview for: Object { objectId: "413150", shop: "steam" }
[CloudSync] Backup preview: Object { overall: {...}, games: {...} }
[CloudSync] Uploading save game: Object { objectId: "413150", shop: "steam", ... }
[CloudSync] ✓ Backup created successfully!
[CloudSync]   Location: "C:\\Users\\Nazril\\AppData\\Roaming\\com.nazril.tauri-app\\backups\\[uuid].tar"
[CloudSync]   Size: 3116130 bytes (2.97 MB)
[CloudSync] ✓ Backup saved locally (cloud upload disabled)
```

## 🚀 ENABLING CLOUD UPLOAD (FUTURE)

When API server is ready:

### 1. Uncomment API Code in `cloud_sync.rs`:
```rust
pub async fn upload_save_game(...) -> Result<()> {
    let tar_location = self.bundle_backup(shop, object_id, wine_prefix)?;
    let metadata = fs::metadata(&tar_location)?;
    let file_size = metadata.len();

    // REMOVE this line:
    // println!("[CloudSync] ✓ Backup saved locally (cloud upload disabled)");
    
    // UNCOMMENT this block:
    /*
    let hostname = hostname::get()...
    let payload = UploadArtifactPayload {...};
    let response = client.post(api_url).json(&payload).send().await?;
    // ... rest of upload logic
    fs::remove_file(&tar_location)?;  // Cleanup after upload
    */
}
```

### 2. Update API URL:
```rust
// Change from:
let api_url = "https://api.yourdomain.com/profile/games/artifacts";

// To:
let api_url = "https://your-actual-api.com/v1/backups/upload";
```

### 3. Update Frontend Message:
```typescript
// Change from:
showSuccessToast("Backup created successfully! (Saved locally)");

// To:
showSuccessToast("Backup uploaded successfully!");
```

## ⚠️ LIMITATIONS (LOCAL-ONLY MODE)

1. **No Cloud Storage**: Backups only exist locally
2. **No Sync**: Cannot sync across devices
3. **No Versioning**: Each backup overwrites previous tar file
4. **No Listing**: `get_game_artifacts()` returns empty array
5. **No Download**: Cannot restore from "cloud" (no artifacts)

## ✅ BENEFITS (LOCAL-ONLY MODE)

1. **Full Backup Pipeline**: Tests entire backup creation process
2. **Ludusavi Integration**: Verifies game detection and save file scanning
3. **File Handling**: Tests tar creation and file system operations
4. **UI Flow**: Tests modal, buttons, loading states, toasts
5. **No Dependencies**: Works without API server or cloud storage

## 📊 BACKUP VERIFICATION

### Check Backup Integrity:
```powershell
# Extract tar file to verify contents
PS> $backupFile = Get-ChildItem "$env:APPDATA\com.nazril.tauri-app\backups" -Filter "*.tar" | Select-Object -First 1
PS> tar -xvf $backupFile.FullName -C "$env:TEMP\backup-verify"
PS> Get-ChildItem "$env:TEMP\backup-verify" -Recurse
```

### Expected Structure:
```
StardewValley/
├── Saves/
│   ├── SaveGameInfo
│   ├── asdass_418019374/
│   │   ├── SaveGameInfo
│   │   └── asdass_418019374
│   └── steam_autocloud.vdf
└── default_options
```

## 🔄 RESTORE FUNCTIONALITY

**Status:** Not implemented yet (requires API)

**Future Implementation:**
1. User selects backup from list (stored in API)
2. Download tar file from cloud storage
3. Extract to temporary directory
4. Use Ludusavi to restore files to correct locations
5. Verify restoration success

---

**Date:** October 6, 2025
**Mode:** Local-only backup (no cloud upload)
**Purpose:** Development and testing without API server
**Next Step:** Implement cloud upload when API is ready

