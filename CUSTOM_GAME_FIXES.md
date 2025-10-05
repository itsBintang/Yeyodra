# Custom Game Fixes - Empty Image & Elevation Error

## Issues Fixed

### 1. Empty String in Image src Attribute
### 2. Elevation Error When Launching Games

---

## Issue #1: Empty String in Image src

### Problem
```
An empty string ("") was passed to the src attribute. 
This may cause the browser to download the whole page again over the network.
```

### Root Cause
Custom games don't have hero images by default, so `heroImage` variable is an empty string `""`, which causes the browser to try downloading from an empty URL.

### Solution

**Frontend - `src/pages/GameDetails.tsx`:**

Conditionally render image only if `heroImage` exists:

```typescript
// Before:
<img
  src={heroImage}
  className="game-details__hero-image"
  alt={...}
/>

// After:
{heroImage ? (
  <img
    src={heroImage}
    className="game-details__hero-image"
    alt={(effectiveShopDetails?.name || game?.title || "Game") as string}
  />
) : (
  <div className="game-details__hero-placeholder" />
)}
```

**Styling - `src/pages/GameDetails.scss`:**

Added gradient placeholder for games without hero images:

```scss
&__hero-placeholder {
  width: 100%;
  height: calc($hero-height + 72px);
  min-height: calc($hero-height + 72px);
  position: absolute;
  z-index: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);

  @media (min-width: 1250px) {
    height: calc(350px + 72px);
    min-height: calc(350px + 72px);
  }
}
```

### Result
- ✅ No more empty src warning
- ✅ Shows beautiful gradient background for custom games
- ✅ Regular games with images still work normally

---

## Issue #2: Elevation Error (Admin Rights)

### Problem
```
Failed to launch game: The requested operation requires elevation. (os error 740)
```

### Root Cause
Some executables (like installers or games with anti-cheat) require administrator privileges. When launching with `Command::new()` directly, it fails if elevation is needed.

### Solution

**Backend - `src-tauri/src/game_launcher.rs`:**

Use Windows `cmd /C start` command which respects UAC prompts:

```rust
// Before (Direct execution):
Command::new(executable_path)
    .current_dir(working_dir)
    .spawn()
    .map_err(|e| anyhow::anyhow!("Failed to launch game: {}", e))?;

// After (Through Windows shell):
const CREATE_NO_WINDOW: u32 = 0x08000000;

Command::new("cmd")
    .args(["/C", "start", "", executable_path])
    .current_dir(working_dir)
    .creation_flags(CREATE_NO_WINDOW)
    .spawn()
    .map_err(|e| anyhow::anyhow!("Failed to launch game: {}", e))?;
```

### Key Changes

1. **Use Windows Shell:**
   - `cmd /C start ""` launches through Windows shell
   - Shell properly handles UAC elevation prompts
   - Respects file associations (works with .lnk files)

2. **No Window Flag:**
   - `CREATE_NO_WINDOW` (0x08000000) prevents cmd window from appearing
   - Cleaner user experience

3. **Support .lnk files:**
```rust
let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
if ext != "exe" && ext != "lnk" {
    return Err(anyhow::anyhow!("Not a valid executable file (must be .exe or .lnk): {}", executable_path));
}
```

### How It Works

1. User clicks "Play" button
2. Frontend calls `launch_game_executable` Rust command
3. Backend checks file exists and is valid
4. Launches via `cmd /C start` with working directory set
5. Windows handles UAC prompt if needed
6. Game launches with proper permissions

### Benefits

- ✅ Handles UAC elevation automatically
- ✅ No manual elevation needed in manifest
- ✅ Works with shortcuts (.lnk files)
- ✅ Respects Windows file associations
- ✅ No visible cmd window
- ✅ Proper working directory handling

---

## Files Modified

### Issue #1 (Empty Image):
1. `src/pages/GameDetails.tsx` - Conditional image rendering
2. `src/pages/GameDetails.scss` - Hero placeholder styling

### Issue #2 (Elevation):
1. `src-tauri/src/game_launcher.rs` - Windows shell execution

---

## Testing Checklist

### Empty Image Fix:
- [x] Custom game without hero image shows gradient placeholder
- [x] No console warnings about empty src
- [x] Regular games with images still display correctly
- [x] Gradient placeholder matches app theme

### Elevation Fix:
- [x] Games requiring admin launch with UAC prompt
- [x] Normal games launch without prompt
- [x] .lnk shortcuts work correctly
- [x] No cmd window appears
- [x] Working directory is correct
- [x] Games can access their files

---

## Technical Notes

### Why cmd /C start?

Windows `cmd /C start` is the recommended way to launch executables that might need elevation because:

1. **UAC Awareness:** Properly triggers UAC prompts
2. **File Associations:** Respects Windows file type associations
3. **Shell Integration:** Uses Windows shell for proper execution
4. **No Manifest Needed:** Don't need to add elevation to app manifest

### Alternative Approaches (Not Used)

1. **Windows API ShellExecuteEx:**
   - More complex, requires Windows API bindings
   - Would need external crate like `windows-rs`
   - More code, similar result

2. **App Manifest Elevation:**
   - Would require app itself to always run as admin
   - Bad UX - user always sees UAC for launcher
   - Only needed for game, not launcher

3. **runas Command:**
   - Always prompts for admin, even if not needed
   - Worse UX than cmd /C start

### Hydra Comparison

Hydra uses Electron with Node.js `child_process.spawn()`, which on Windows also goes through the shell and handles UAC properly. Our solution achieves the same result using Rust.

---

## Known Limitations

### Empty Image Fix:
- Custom games can't have hero images set during creation
- Must be added later through Edit Game modal
- Could be enhanced to support image upload during creation

### Elevation Fix:
- UAC prompt will still appear for games needing admin
  - This is correct behavior - better than silently failing
- Some anti-cheat systems might still have issues
  - Would need game-specific workarounds
- Windows only solution
  - Linux/Mac would use different approach

---

## Future Enhancements

### For Custom Games:
- [ ] Allow uploading hero/logo images during creation
- [ ] Auto-extract icons from .exe files
- [ ] Default placeholder images with game initials
- [ ] Support for custom gradient colors

### For Game Launcher:
- [ ] Remember "Always run as admin" preference per game
- [ ] Detect if game needs admin before launching
- [ ] Show warning if game requires admin
- [ ] Launch options support (command line arguments)

---

## Conclusion

Both issues are now resolved:
1. Custom games show nice gradient placeholder instead of empty image error
2. Games requiring admin privileges launch correctly with UAC prompt

The solutions are clean, follow Windows best practices, and provide good user experience.

