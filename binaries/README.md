# Binaries Folder

This folder contains the required binary files for Chaos.

## ✅ Installed Binaries

### aria2c.exe
**Status:** ✅ INSTALLED (copied from Hydra)
- **Purpose:** Multi-threaded download manager with RPC support
- **Version:** 1.37.0
- **Features:** 16 connections per file, resume capability, HTTP/HTTPS/FTP/BitTorrent support

### 7z.exe & 7z.dll
**Status:** ✅ INSTALLED (copied from Hydra)
- **Purpose:** File compression and extraction
- **Supported formats:** 7z, ZIP, RAR, TAR, GZIP, BZIP2, and more
- **Usage:** Extract downloaded game archives automatically

## File Structure

```
binaries/
  ├── aria2c.exe  ✅ (Windows download manager)
  ├── 7z.exe      ✅ (Windows compression tool)
  ├── 7z.dll      ✅ (Required by 7z.exe)
  └── README.md
```

## Alternative Setup

If binaries are missing, you can:

1. **Copy from Hydra** (Recommended):
   ```cmd
   xcopy "C:\Users\Nazril\Documents\hydra\binaries\aria2c.exe" "binaries\" /Y
   xcopy "C:\Users\Nazril\Documents\hydra\binaries\7z.exe" "binaries\" /Y
   xcopy "C:\Users\Nazril\Documents\hydra\binaries\7z.dll" "binaries\" /Y
   ```

2. **Download Manually**:
   - aria2c: https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip
   - 7-Zip: https://www.7-zip.org/download.html

## Production Build

For production builds, these binaries will be automatically bundled with the application in the resources folder.

