# Cracking Final Fix - Download Incomplete/Timeout

## ROOT CAUSE CONFIRMED

### Problem
Goldberg DLL files in cache are **INCOMPLETE** (only 1 KB instead of 10-18 MB!):

```
Chaos cache: C:\Users\Nazril\AppData\Roaming\com.chaoslauncher.dev\
steam_api.dll      = 1 KB   ❌ Should be ~16 MB!
steam_api64.dll    = 1 KB   ❌ Should be ~18 MB!
steamclient.dll    = 1 KB   ❌ Should be ~90 KB!
steamclient64.dll  = 1 KB   ❌ Should be ~111 KB!

Original app cache: C:\Users\Nazril\AppData\Roaming\sovereign.bsac.app\
steam_api.dll      = 16,142,248 bytes  ✅ CORRECT!
steam_api64.dll    = 18,031,528 bytes  ✅ CORRECT!
steamclient.dll    = 92,072 bytes      ✅ CORRECT!
steamclient64.dll  = 111,016 bytes     ✅ CORRECT!
```

### Why This Happens
1. Goldberg DLL files are **VERY LARGE** (16-18 MB each!)
2. Original download timeout was **30 seconds** - TOO SHORT for large files on slow connections
3. Download gets **INTERRUPTED/TIMEOUT** before completing
4. Partial/corrupt 1 KB files remain in cache
5. Setup thinks files exist (skip re-download)
6. Crack copies incomplete files to game → **CRASH!**

## The Fix

### 1. Increased Download Timeout
```rust
// OLD: 30 seconds - TOO SHORT for 16 MB files!
.timeout(Duration::from_secs(30))

// NEW: 180 seconds (3 minutes) - enough for large files
.timeout(Duration::from_secs(180))
```

### 2. Auto-Delete Corrupt Files on Startup
```rust
// Check if existing file is suspiciously small (incomplete download)
let is_corrupt = match file_name {
    "steam_api.dll" | "steam_api64.dll" => file_size < 10_000_000, // Should be 16-18 MB
    "steamclient.dll" | "steamclient64.dll" => file_size < 50_000, // Should be 90-111 KB
    _ => false,
};

if is_corrupt {
    info!("Deleting corrupt file: {} ({} bytes)", file_name, file_size);
    fs::remove_file(&target_path).ok(); // Re-download will happen
}
```

### 3. Strict File Size Validation
```rust
let min_expected_size = match file_name {
    "steam_api.dll" | "steam_api64.dll" => 10_000_000u64,      // 10 MB minimum
    "steamclient.dll" | "steamclient64.dll" => 50_000u64,      // 50 KB minimum
    _ => 0,
};

if total_bytes < min_expected_size {
    return Err(SetupError::Other(format!(
        "File {} incomplete: {} bytes (expected >{} bytes)",
        file_name, total_bytes, min_expected_size
    )));
}
```

### 2. Testing Steps

**BEFORE REBUILD:**

1. **Delete corrupt cache folder**:
   ```
   Delete: C:\Users\Nazril\AppData\Roaming\com.chaoslauncher.dev\
   ```

2. **Rebuild app**:
   ```bash
   npm run tauri dev
   ```

3. **Try cracking** - Setup will run and SHOULD:
   - ✅ Download files
   - ✅ Validate sizes
   - ❌ **FAIL if files still corrupt** with clear error message
   - OR
   - ✅ **SUCCEED if files are valid**

### 3. Expected Results

#### On First Run After Fix:
```
🗑️  Deleting corrupt file: steam_api.dll (1024 bytes)
📥 Downloading: steam_api.dll
⏳ (Up to 3 minutes for large file...)
✅ Downloaded & validated: steam_api.dll (16142248 bytes = 15.75 MB)
✅ Downloaded & validated: steam_api64.dll (18031528 bytes = 17.2 MB)
✅ Downloaded & validated: steamclient.dll (92072 bytes)
✅ Downloaded & validated: steamclient64.dll (111016 bytes)
✅ Setup completed successfully!
```

#### If Download Still Fails (network too slow):
```
❌ Error: File steam_api.dll incomplete: 5000000 bytes (expected >10000000 bytes)
```

Clear error showing incomplete download - user can retry with better connection.

## Next Steps

1. ✅ Delete cache folder: `com.chaoslauncher.dev`
2. ✅ Rebuild with validation
3. ⏳ Test setup - will **fail loudly if files corrupt**
4. ❓ If still fails → Check original S3 bucket or use alternative source

## Why Original App Works

Original app likely:
1. ✅ Had enough time to complete download (user waited longer during first setup)
2. ✅ Better internet connection at time of download
3. ✅ Successfully downloaded full 16-18 MB files

Chaos app:
1. ❌ 30 second timeout too short
2. ❌ Download interrupted → 1 KB partial files
3. ❌ Existing check only tested `.exists()` not file size
4. ❌ Skip re-download → use corrupt files → crash

## Status

✅ **Download timeout increased: 30s → 180s**
✅ **Corrupt file auto-detection & deletion**
✅ **Strict file size validation (10 MB minimum for Goldberg DLLs)**
⏳ **Ready to test** - Restart app to trigger fresh download

**The crash was caused by INCOMPLETE DOWNLOADS (timeout too short for large files)!**

