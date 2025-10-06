# Download History Debugging Guide

## Issue Report
User reported that downloads in Low Connection Mode are not appearing in the Downloads page history.

## Root Cause Investigation

The download history save mechanism is **independent of Low Connection Mode**. The code path in `lib.rs` line 217-254 does not check for low connection mode before saving history.

## Debug Logging Added

### 1. Enhanced Logging in `lib.rs`
Added comprehensive logging to track the download history save process:

```rust
println!("[DownloadHistory] Saving download for AppID: {}", app_id);
// ... save logic ...
println!("[DownloadHistory] ✓ Successfully saved to history: {}", game_title);
```

### 2. Enhanced Logging in `download_history.rs`
Added detailed logging to track file operations:

```rust
println!("[DownloadHistory] File path: {:?}", file_path);
println!("[DownloadHistory] Current history count: {}", history.len());
println!("[DownloadHistory] Adding new download: {} ({})", download.title, download.app_id);
println!("[DownloadHistory] ✓ Saved successfully. New count: {}", history.len());
```

## How to Debug

### Step 1: Run the App in Dev Mode
```bash
npm run tauri:dev
```

### Step 2: Watch the Console Output
When downloading a game with SteamTools, you should see:

```
[DownloadHistory] Saving download for AppID: 1971870
[DownloadHistory] File path: "C:\\Users\\USERNAME\\AppData\\Local\\chaos\\download_history.json"
[DownloadHistory] Current history count: 25
[DownloadHistory] Adding new download: Liar's Bar (1971870)
[DownloadHistory] ✓ Saved successfully. New count: 26
[DownloadHistory] ✓ Successfully saved to history: Liar's Bar
[Library] ✓ Marked game as installed: Liar's Bar
```

### Step 3: Check for Errors
Look for these error messages:

```
[DownloadHistory] ✗ Failed to save download history: [error message]
[Library] ✗ Failed to mark game as installed: [error message]
```

### Step 4: Verify File Exists
Check if the history file was created:
- **Windows**: `%LOCALAPPDATA%\chaos\download_history.json`
- **Linux**: `~/.local/share/chaos/download_history.json`
- **macOS**: `~/Library/Application Support/chaos/download_history.json`

### Step 5: Check File Permissions
Ensure the app has write permissions to the directory.

## Common Issues & Solutions

### Issue 1: File Not Found
**Symptom**: File path shows but file doesn't exist
**Solution**: Check directory permissions, ensure `dirs::data_local_dir()` returns valid path

### Issue 2: Already Exists
**Symptom**: Log shows "Download already exists, skipping"
**Solution**: This is normal if redownloading same game

### Issue 3: JSON Parse Error
**Symptom**: Error when reading existing history
**Solution**: Delete corrupted `download_history.json` file

### Issue 4: Silent Failure
**Symptom**: No logs appear
**Solution**: 
1. Check if SteamTools is enabled in Settings
2. Verify download actually succeeded (`result.success == true`)
3. Check if Low Connection Mode affects other code paths

## Testing Checklist

- [ ] Download game in **Normal Mode**
- [ ] Download game in **Low Connection Mode**
- [ ] Check console logs for both scenarios
- [ ] Verify history file is created/updated
- [ ] Refresh Downloads page after download completes
- [ ] Try redownloading same game (should skip)
- [ ] Try downloading different game (should add)

## Expected Behavior

✅ **In Both Modes:**
- Download history should save after successful SteamTools download
- History should appear in Downloads page immediately
- No errors should appear in console

## Code References

**Save History:**
- `src-tauri/src/lib.rs` line 217-254
- `src-tauri/src/download_history.rs` line 30-61

**Get History:**
- `src-tauri/src/lib.rs` line 248 (`get_completed_downloads` command)
- `src-tauri/src/download_history.rs` line 64-74

**Frontend Display:**
- `src/pages/Downloads.tsx` - Displays completed downloads

## Next Steps

1. **Run app and download a game** with console open
2. **Copy all log output** showing the download process
3. **Check if logs show successful save**
4. **Verify file exists and contains correct data**
5. **Report findings** with log output

---

**Last Updated**: October 6, 2025

