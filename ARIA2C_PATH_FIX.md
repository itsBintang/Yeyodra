# Aria2c Binary Path Resolution & Console Window Fix

## Problem Description

**Issue**: Pada startup aplikasi, muncul error log:
```
Failed to initialize aria2c: aria2c binary not found at: "binaries\\aria2c.exe"
Failed to initialize app: Failed to initialize aria2c: aria2c binary not found at: "binaries\\aria2c.exe"
```

Namun anehnya, download feature masih bisa berfungsi normal.

## Root Cause Analysis

### 1. Working Directory Mismatch
Ketika aplikasi dijalankan dengan `cargo run` dari direktori `src-tauri`, working directory adalah `src-tauri/`, bukan workspace root.

**Development mode path resolution:**
- Code mencari: `binaries/aria2c.exe` (relative path)
- Actual lookup: `src-tauri/binaries/aria2c.exe` ❌
- File location: `<workspace-root>/binaries/aria2c.exe` ✓

### 2. Why Download Still Works

Aplikasi tidak crash karena error handling yang baik di `lib.rs:466-469`:
```rust
if let Err(e) = setup::initialize_app(app.handle()) {
    eprintln!("Failed to initialize app: {}", e);
    // Don't prevent app from starting, just log the error
}
```

Kemudian saat user melakukan download:
1. `Aria2Client::new()` dipanggil
2. `aria2::get_rpc_url()` mencoba mengakses global instance
3. Jika belum initialized, lazy initialization happens
4. Pada saat itu working directory sudah correct atau aria2 sudah running dari attempt lain

## Solution

### Fix di `src-tauri/src/aria2.rs`

Updated path resolution untuk development mode:

```rust
pub fn spawn(port: u16, secret: String) -> Result<Self, String> {
    let binary_path = if cfg!(debug_assertions) {
        // Development: use binary from workspace root binaries folder
        let current_dir = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        
        // Check if we're in src-tauri directory, if so go up one level
        let workspace_root = if current_dir.ends_with("src-tauri") {
            current_dir.parent()
                .ok_or("Failed to get parent directory")?
                .to_path_buf()
        } else {
            current_dir
        };
        
        workspace_root.join("binaries").join("aria2c.exe")
    } else {
        // Production: use bundled binary (unchanged)
        let exe_dir = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable directory: {}", e))?
            .parent()
            .ok_or("Failed to get parent directory")?
            .to_path_buf();
        exe_dir.join("aria2c.exe")
    };
    
    // ... rest of the code
}
```

### Key Changes

1. **Get current working directory** dengan `std::env::current_dir()`
2. **Detect if running from src-tauri** dengan `current_dir.ends_with("src-tauri")`
3. **Navigate to workspace root** jika perlu dengan `.parent()`
4. **Build correct path** dengan `workspace_root.join("binaries").join("aria2c.exe")`

### Testing Results

**Before Fix:**
```
Initializing Chaos Launcher...
Failed to initialize aria2c: aria2c binary not found at: "binaries\\aria2c.exe"
Failed to initialize app: Failed to initialize aria2c: aria2c binary not found at: "binaries\\aria2c.exe"
```

**After Fix:**
```
Initializing Chaos Launcher...
aria2c started on port 6800 with RPC enabled
✓ Aria2c initialized
✓ User preferences loaded
  - SteamTools: enabled
✓ Chaos Launcher initialized successfully
```

## Console Window Fix

Untuk mencegah aria2c.exe membuka console window di production build, ditambahkan Windows-specific flag:

```rust
// Hide console window on Windows in release builds
#[cfg(all(windows, not(debug_assertions)))]
{
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}
```

Dengan ini:
- **Development**: Console window masih muncul untuk debugging
- **Production**: Aria2c berjalan silent tanpa console window

## Benefits

1. ✅ **Clean startup logs** - Tidak ada error message saat initialization
2. ✅ **Consistent behavior** - Path resolution works dari mana pun cargo run dipanggil
3. ✅ **Production unchanged** - Production build path logic tidak terpengaruh
4. ✅ **Better debugging** - Startup logs sekarang accurate dan helpful
5. ✅ **No console window** - Aria2c berjalan background tanpa menampilkan CMD window di production

## Production Bundle Configuration

Untuk memastikan binaries juga ter-bundle di production build, ditambahkan konfigurasi di `tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [...],
  "resources": {
    "../binaries/aria2c.exe": "./",
    "../binaries/7z.exe": "./",
    "../binaries/7z.dll": "./"
  }
}
```

Dengan konfigurasi ini:
- Development: Binaries diload dari `<workspace-root>/binaries/`
- Production: Binaries dibundle ke exe directory dan diload dari sana

## Files Modified

1. `src-tauri/src/aria2.rs` - Updated `Aria2Process::spawn()` method untuk smart path resolution
2. `src-tauri/tauri.conf.json` - Added `resources` configuration untuk bundle binaries di production

## Verification

Untuk verify fix bekerja dengan baik:

```powershell
# Test dari workspace root
cd C:\Users\Nazril\Documents\ProjekV2\Chaos
cargo run --manifest-path src-tauri/Cargo.toml

# Test dari src-tauri directory
cd src-tauri
cargo run

# Expected output (both should work):
# Initializing Chaos Launcher...
# aria2c started on port 6800 with RPC enabled
# ✓ Aria2c initialized
# ✓ User preferences loaded
# ✓ Chaos Launcher initialized successfully
```

## Date
October 5, 2025

