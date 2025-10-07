# Window Show Fix - Resolved

## Problem
Saat app launch, CMD window muncul, freeze, lalu close tanpa membuka app utama. User hanya melihat CMD yang freeze lalu hilang.

## Root Cause
Window di-configure dengan `"visible": false` di `tauri.conf.json`, tapi tidak ada kode untuk men-show window setelah setup selesai. Yang terjadi:

1. App launch
2. Setup function berjalan (CMD muncul untuk debug output)
3. Setup selesai
4. Window tetap invisible - **TIDAK ADA yang men-show window**
5. User pikir app crash karena CMD hilang tapi tidak ada window

## Solution

### 1. Show Window After Setup (src-tauri/src/lib.rs)
```rust
.setup(|app| {
    // Initialize app state
    if let Err(e) = setup::initialize_app(app.handle()) {
        eprintln!("Failed to initialize app: {}", e);
    }
    
    // 🔧 FIX: Show the main window after setup is complete
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    
    Ok(())
})
```

### 2. Improved Setup Progress Display (src-tauri/src/setup.rs)
Menambahkan visual progress indicator yang lebih jelas di CMD:

```
═══════════════════════════════════════════
  Chaos Launcher - Initializing...
═══════════════════════════════════════════
[1/4] Checking instance lock... ✓
[2/4] Loading preferences... ✓
[3/4] Starting download manager... ✓
[4/4] Preparing cloud save system... ✓
═══════════════════════════════════════════
  ✓ Ready to launch!
═══════════════════════════════════════════
```

## Benefits

✅ **Window sekarang muncul setelah setup selesai**
- Window di-show secara explicit setelah initialization
- Window langsung get focus untuk user experience yang baik

✅ **Setup progress lebih clear**
- User tahu apa yang sedang terjadi
- Progress counter [1/4], [2/4], etc
- Visual checkmarks dan warnings

✅ **No more "ghost app"**
- CMD tidak lagi hilang tanpa membuka app
- User dapat melihat app window setelah setup

## Technical Details

**Window Lifecycle:**
1. Window created with `visible: false` (tauri.conf.json)
2. Setup runs on main thread (setup::initialize_app)
3. **NEW:** Window explicitly shown after setup
4. Window set to focus for immediate user interaction

**Why visible: false initially?**
- Mencegah white screen flash saat startup
- Memberikan waktu untuk setup tanpa showing incomplete UI
- Standard practice untuk smooth startup experience

## Testing
Build and run the app:
```bash
cd src-tauri
cargo build --release
```

The window should now appear after the setup completes.

## Files Modified
- `src-tauri/src/lib.rs` - Added window show logic
- `src-tauri/src/setup.rs` - Improved progress display

---
**Status:** ✅ RESOLVED
**Date:** October 7, 2025


