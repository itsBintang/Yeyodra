# Hydra Restore Implementation - Fundamental Analysis

## 🔍 OVERVIEW

Analisis mendalam tentang bagaimana Hydra mengimplementasikan restore game save dari cloud backup.

## 📦 BACKUP STRUCTURE

### Tar File Contents:
```
9dc8ab29-8c29-40fd-8b21-241adf8b5b7e.tar
└── 413150/                                    (objectId folder)
    ├── mapping.yaml                           (metadata & file mapping)
    └── drive-C/                               (Windows C: drive)
        └── Users/
            └── Nazril/
                └── AppData/
                    └── Roaming/
                        └── StardewValley/
                            ├── Saves/
                            │   ├── SaveGameInfo
                            │   ├── steam_autocloud.vdf
                            │   └── asdass_418019374/
                            │       ├── SaveGameInfo
                            │       └── asdass_418019374
                            └── default_options
```

### mapping.yaml Structure:
```yaml
name: "413150"                    # objectId (Steam App ID)
drives:
  drive-C: "C:"                   # Drive mapping for restore
backups:
  - name: "."
    when: "2025-10-06T11:29:38.984464100Z"
    os: windows
    files:
      "C:/Users/Nazril/AppData/Roaming/StardewValley/Saves/SaveGameInfo":
        hash: 65c4b2bb14321a7b931da7d3ddb0bdfc38348df3
        size: 18286
      # ... more files
    registry:
      hash: ~
    children: []
```

**Key Fields:**
- `name`: Game identifier (objectId)
- `drives`: Maps archive paths (`drive-C`) to actual paths (`C:`)
- `backups[].files`: Dictionary of file paths with hash & size for verification
- `when`: Backup timestamp
- `os`: Operating system (windows/linux/mac)

## 🔄 HYDRA RESTORE FLOW

### File: `download-game-artifact.ts`

#### 1. **API Call - Get Download URL**
```typescript
const {
  downloadUrl,
  objectKey,
  homeDir,
  winePrefixPath: artifactWinePrefixPath,
} = await HydraApi.post(`/profile/games/artifacts/${gameArtifactId}/download`);
```

**Response:**
- `downloadUrl`: Presigned S3 URL for tar file
- `objectKey`: Filename (UUID.tar)
- `homeDir`: User's home directory from artifact metadata
- `winePrefixPath`: Wine prefix if Linux (null for Windows)

#### 2. **Download Tar File**
```typescript
const zipLocation = path.join(SystemPath.getPath("userData"), objectKey);
const response = await axios.get(downloadUrl, {
  responseType: "stream",
  onDownloadProgress: (progressEvent) => {
    // Send progress to renderer
    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-progress-${objectId}-${shop}`,
      progressEvent
    );
  },
});

const writer = fs.createWriteStream(zipLocation);
response.data.pipe(writer);
```

**Progress Updates:** Sent to frontend via IPC for progress bar

#### 3. **Extract Tar File**
```typescript
writer.on("close", async () => {
  const backupPath = path.join(backupsPath, `${shop}-${objectId}`);
  
  // Extract tar to backup directory
  await tar.x({
    file: zipLocation,
    cwd: backupPath,
  });
  
  // Restore files
  restoreLudusaviBackup(
    backupPath,
    objectId,
    normalizePath(homeDir),
    game?.winePrefixPath,
    artifactWinePrefixPath
  );
});
```

#### 4. **Restore Files** (`restoreLudusaviBackup`)

**Step 4.1: Read mapping.yaml**
```typescript
const gameBackupPath = path.join(backupPath, title);  // backups/steam-413150/413150
const mappingYamlPath = path.join(gameBackupPath, "mapping.yaml");

const manifest = YAML.parse(fs.readFileSync(mappingYamlPath, "utf8")) as {
  backups: LudusaviBackupMapping[];
  drives: Record<string, string>;
};
```

**Step 4.2: Get Current User Profile**
```typescript
const userProfilePath = CloudSync.getWindowsLikeUserProfilePath(winePrefixPath);
// Windows: C:/Users/Nazril
// Linux: /home/username (from wine prefix user.reg)
```

**Step 4.3: Process Each File**
```typescript
manifest.backups.forEach((backup) => {
  Object.keys(backup.files).forEach((key) => {
    // key = "C:/Users/Nazril/AppData/Roaming/StardewValley/Saves/SaveGameInfo"
    
    // 1. Convert path to archive structure
    const sourcePathWithDrives = Object.entries(manifest.drives).reduce(
      (prev, [driveKey, driveValue]) => {
        return prev.replace(driveValue, driveKey);
      },
      key
    );
    // Result: "drive-C/Users/Nazril/AppData/Roaming/StardewValley/Saves/SaveGameInfo"
    
    // 2. Get full source path in archive
    const sourcePath = path.join(gameBackupPath, sourcePathWithDrives);
    // Result: "backups/steam-413150/413150/drive-C/Users/Nazril/AppData/.../SaveGameInfo"
    
    // 3. Transform to destination path
    const destinationPath = transformLudusaviBackupPathIntoWindowsPath(
        key,
        artifactWinePrefixPath
      )
      .replace(homeDir, addWinePrefixToWindowsPath(userProfilePath, winePrefixPath))
      .replace(publicProfilePath, addWinePrefixToWindowsPath(publicProfilePath, winePrefixPath));
    // Result: "C:/Users/Nazril/AppData/Roaming/StardewValley/Saves/SaveGameInfo"
    
    // 4. Create destination directory
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    
    // 5. Remove existing file if present
    if (fs.existsSync(destinationPath)) {
      fs.unlinkSync(destinationPath);
    }
    
    // 6. Move file from archive to destination
    fs.renameSync(sourcePath, destinationPath);
  });
});
```

## 🔧 HELPER FUNCTIONS

### `transformLudusaviBackupPathIntoWindowsPath`
```typescript
export const transformLudusaviBackupPathIntoWindowsPath = (
  backupPath: string,
  winePrefixPath?: string | null
) => {
  return backupPath
    .replace(winePrefixPath ? addTrailingSlash(winePrefixPath) : "", "")
    .replace("drive_c", "C:");
};
```

**Purpose:** Convert Ludusavi archive path to actual Windows path
- Remove wine prefix if Linux
- Replace `drive_c` with `C:`

**Example:**
- Input: `"C:/Users/Nazril/AppData/Roaming/StardewValley/Saves/SaveGameInfo"`
- Output: `"C:/Users/Nazril/AppData/Roaming/StardewValley/Saves/SaveGameInfo"`

### `addWinePrefixToWindowsPath`
```typescript
export const addWinePrefixToWindowsPath = (
  windowsPath: string,
  winePrefixPath?: string | null
) => {
  if (!winePrefixPath) {
    return windowsPath;
  }
  return path.join(winePrefixPath, windowsPath.replace("C:", "drive_c"));
};
```

**Purpose:** Add wine prefix to path for Linux compatibility
- Windows: No change
- Linux: Prepend wine prefix and convert `C:` → `drive_c`

### `CloudSync.getWindowsLikeUserProfilePath`
```typescript
public static getWindowsLikeUserProfilePath(winePrefixPath?: string | null) {
  if (process.platform === "linux") {
    if (!winePrefixPath) {
      throw new Error("Wine prefix path is required");
    }
    
    // Read wine user.reg to get USERPROFILE
    const userReg = fs.readFileSync(
      path.join(winePrefixPath, "user.reg"),
      "utf8"
    );
    
    const entries = parseRegFile(userReg);
    const volatileEnvironment = entries.find(
      (entry) => entry.path === "Volatile Environment"
    );
    
    const userProfile = String(volatileEnvironment.values["USERPROFILE"]);
    return normalizePath(userProfile);
  }
  
  // Windows: Return home directory
  return normalizePath(SystemPath.getPath("home"));
}
```

**Purpose:** Get user profile path compatible with backup metadata
- Windows: `C:/Users/Username`
- Linux: From wine registry (e.g., `C:/users/username` in wine context)

## 🎯 KEY INSIGHTS

### 1. **Cross-Platform Compatibility**
Hydra handles Windows + Linux (Wine) dengan:
- Store paths as Windows-style (`C:/Users/...`)
- Store wine prefix in metadata
- Convert paths saat restore based on current platform

### 2. **Path Transformation Chain**
```
Archive Path                         → Windows Path
--------------------------------------------------------------------
413150/drive-C/Users/.../file       → C:/Users/.../file
413150/drive-C/users/.../file       → C:/users/.../file (wine)
```

### 3. **User Profile Mapping**
Backup dibuat di PC A dengan user "John":
- Stored: `C:/Users/John/AppData/...`
- Metadata: `homeDir = "C:/Users/John"`

Restore di PC B dengan user "Jane":
- Replace `homeDir` dengan current user profile
- Result: `C:/Users/Jane/AppData/...`

### 4. **File Verification**
`mapping.yaml` includes hash & size:
```yaml
files:
  "C:/Users/.../SaveGameInfo":
    hash: 65c4b2bb14321a7b...
    size: 18286
```

Could be used untuk verify integrity (Hydra doesn't verify, tapi could implement)

### 5. **Cleanup**
Hydra does NOT cleanup:
- Extracted backup directory (kept in `backupsPath`)
- Downloaded tar file (kept in userData)

Allows for re-restore without re-download.

## 🚀 IMPLEMENTATION PLAN FOR CHAOS

### Local-Only Mode (No Cloud):

#### 1. **List Local Backups**
```rust
pub fn list_local_backups(&self, object_id: &str, shop: &str) -> Result<Vec<LocalBackup>> {
    let backups_dir = self.get_backups_path()?;
    let mut backups = Vec::new();
    
    for entry in fs::read_dir(&backups_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("tar") {
            // Extract and read mapping.yaml to get metadata
            // Add to backups list
        }
    }
    
    Ok(backups)
}
```

#### 2. **Restore from Local Tar**
```rust
pub fn restore_from_local_backup(&self, tar_path: &PathBuf, object_id: &str, shop: &str) -> Result<()> {
    // 1. Extract tar
    let backups_dir = self.get_backups_path()?;
    let extract_path = backups_dir.join(format!("{}-{}", shop, object_id));
    
    // 2. Read mapping.yaml
    let mapping_path = extract_path.join(object_id).join("mapping.yaml");
    let mapping: LudusaviMapping = serde_yaml::from_str(&fs::read_to_string(mapping_path)?)?;
    
    // 3. Get current user home
    let current_home = Self::get_windows_like_user_profile_path(None)?;
    
    // 4. Restore each file
    for backup in mapping.backups {
        for (file_path, _metadata) in backup.files {
            // Transform paths and move files
            self.restore_file(&extract_path, &file_path, &mapping.drives, &current_home)?;
        }
    }
    
    Ok(())
}
```

## 📝 NEXT STEPS

1. ✅ Understand Hydra's restore flow
2. ⏳ Implement local backup listing
3. ⏳ Implement restore from local backup
4. ⏳ Add UI for selecting backup to restore
5. ⏳ Test restore with Stardew Valley saves

---

**Date:** October 6, 2025
**Source:** Hydra codebase analysis
**Purpose:** Guide Chaos implementation of restore functionality

