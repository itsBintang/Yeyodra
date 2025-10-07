# Binary Process Checklist - Windows CMD Window Prevention

## 📋 Quick Reference

Checklist untuk memastikan semua external binary spawn TIDAK menampilkan CMD window di Windows.

---

## ✅ Current Status

### All Verified Processes:

| Binary | Location | CREATE_NO_WINDOW | Status |
|--------|----------|------------------|--------|
| **aria2c.exe** | `src-tauri/src/aria2.rs:118` | ✅ Yes | ✅ OK |
| **ludusavi.exe (backup)** | `src-tauri/src/ludasavi.rs:336` | ✅ Yes | ✅ OK |
| **ludusavi.exe (manifest)** | `src-tauri/src/ludasavi.rs:270` | ✅ Yes | ✅ OK |
| **game launcher** | `src-tauri/src/game_launcher.rs:48` | ✅ Yes | ✅ OK |
| **taskkill** | `src-tauri/src/steam_restart.rs:18` | ✅ Yes | ✅ OK |
| **steam.exe** | `src-tauri/src/steam_restart.rs:45` | ✅ Yes | ✅ OK |
| **tasklist** | `src-tauri/src/lock.rs:77` | ✅ Yes | ✅ OK |

**Total:** 7 process spawns on Windows, all properly hidden ✅

---

## 🔧 Pattern to Follow

### ✅ CORRECT Pattern:

```rust
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

fn spawn_binary() -> Result<()> {
    let mut cmd = Command::new("binary.exe");
    cmd.args(["--arg1", "--arg2"]);
    
    // ✅ ALWAYS ADD THIS ON WINDOWS:
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = cmd.output()?;
    // Process output...
    Ok(())
}
```

### ❌ WRONG Pattern:

```rust
// ❌ BAD - Will show CMD window!
fn spawn_binary() -> Result<()> {
    let output = Command::new("binary.exe")
        .args(["--arg1", "--arg2"])
        .output()?;  // ❌ No CREATE_NO_WINDOW!
    Ok(())
}
```

---

## 🔍 How to Find All Process Spawns

### Method 1: Grep for Command::new
```powershell
cd src-tauri
rg "Command::new" --type rust
```

### Method 2: Check for CREATE_NO_WINDOW
```powershell
cd src-tauri
rg "CREATE_NO_WINDOW" --type rust
```

**Rule:** Every `Command::new()` should have matching `CREATE_NO_WINDOW`!

---

## 📝 Checklist for New Binary Integrations

When adding new external binary (e.g., torrent client, 7zip, etc.):

- [ ] Binary path detection (dev vs prod)
- [ ] Copy binary to AppData (if needed)
- [ ] Process spawn with `CREATE_NO_WINDOW` flag
- [ ] Error handling for missing binary
- [ ] Graceful degradation if binary fails
- [ ] Test in both dev and production builds

---

## 🎯 Common Scenarios

### Scenario 1: Spawn and Wait
```rust
// Download manager, game launcher
let mut cmd = Command::new(&binary_path);
cmd.args([...]);

#[cfg(target_os = "windows")]
{
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

let output = cmd.output()?;  // Waits for completion
```

### Scenario 2: Spawn and Detach
```rust
// Long-running service (aria2c)
let mut command = Command::new(&binary_path);
command.args([...]);

#[cfg(windows)]
{
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

let process = command.spawn()?;  // Detaches
```

### Scenario 3: With Background Thread
```rust
// Heavy operation (manifest update)
tauri::async_runtime::spawn_blocking(move || {
    let mut cmd = Command::new(&binary_path);
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    cmd.output()
})
.await?
```

---

## 🐛 Debugging CMD Window Issues

### If CMD Window Appears:

1. **Find the spawn location:**
   ```powershell
   # Search for the binary name
   cd src-tauri
   rg "binary_name.exe" --type rust
   ```

2. **Check for CREATE_NO_WINDOW:**
   ```powershell
   # Check around the spawn location
   rg "CREATE_NO_WINDOW" src/file.rs
   ```

3. **Verify the pattern:**
   - Is `#[cfg(target_os = "windows")]` present?
   - Is `CommandExt` imported?
   - Is flag set BEFORE `.output()` or `.spawn()`?

4. **Common mistakes:**
   ```rust
   // ❌ Flag after output() - TOO LATE!
   let output = cmd.output()?;
   cmd.creation_flags(CREATE_NO_WINDOW);  // ❌ WRONG!
   
   // ✅ Flag before output() - CORRECT!
   cmd.creation_flags(CREATE_NO_WINDOW);  // ✅ RIGHT!
   let output = cmd.output()?;
   ```

---

## 📊 Process Spawn Inventory

### Current Binaries:

#### 1. aria2c.exe
- **Purpose:** Download manager
- **Location:** `binaries/aria2c.exe`
- **Spawn:** `src-tauri/src/aria2.rs:118`
- **Window:** Hidden ✅
- **Type:** Long-running daemon

#### 2. ludusavi.exe
- **Purpose:** Game save backup
- **Location:** `ludusavi/ludusavi.exe`
- **Spawns:**
  - Backup: `src-tauri/src/ludasavi.rs:336` ✅
  - Manifest: `src-tauri/src/ludasavi.rs:270` ✅
- **Window:** Hidden ✅
- **Type:** Short-lived task

#### 3. Game Executables
- **Purpose:** Launch games
- **Location:** User-specified
- **Spawn:** `src-tauri/src/game_launcher.rs:48`
- **Window:** Hidden (launcher only) ✅
- **Type:** Detached process

#### 4. 7z.exe (Potential Future Use)
- **Purpose:** Archive extraction
- **Location:** `binaries/7z.exe`
- **Status:** Not yet integrated
- **Note:** When added, use same pattern!

---

## 🚀 Future Binary Additions

### Template for New Binary:

1. **Create module:** `src-tauri/src/new_binary.rs`

2. **Add binary detection:**
   ```rust
   fn get_binary_path() -> Result<PathBuf> {
       if cfg!(debug_assertions) {
           // Dev: binaries/binary.exe
           let workspace_dir = env!("CARGO_MANIFEST_DIR");
           Ok(PathBuf::from(workspace_dir)
               .parent().unwrap()
               .join("binaries")
               .join("binary.exe"))
       } else {
           // Prod: resources/binary.exe
           app_handle.path()
               .resource_dir()?
               .join("binaries")
               .join("binary.exe")
       }
   }
   ```

3. **Add spawn with hidden window:**
   ```rust
   pub fn execute(&self) -> Result<Output> {
       let binary_path = self.get_binary_path()?;
       let mut cmd = Command::new(&binary_path);
       cmd.args([...]);
       
       #[cfg(target_os = "windows")]
       {
           use std::os::windows::process::CommandExt;
           const CREATE_NO_WINDOW: u32 = 0x08000000;
           cmd.creation_flags(CREATE_NO_WINDOW);
       }
       
       cmd.output()
   }
   ```

4. **Test thoroughly:**
   - Dev mode
   - Production build
   - With and without binary present

---

## 🎓 Key Principles

1. **Always hide console on Windows**
   - Use `CREATE_NO_WINDOW` flag
   - No exceptions

2. **Graceful degradation**
   - Binary missing? Don't crash app
   - Feature disabled? Show helpful error

3. **Consistent patterns**
   - Follow existing code structure
   - Reuse proven solutions

4. **Test both modes**
   - Dev mode (binaries/ folder)
   - Prod mode (resources/)

---

## 📚 References

- **Main fix:** `LUDUSAVI_STARTUP_FIX_IMPLEMENTATION.md`
- **Root cause:** `LUDUSAVI_STARTUP_CRASH_ROOT_CAUSE.md`
- **Hydra comparison:** Pattern analysis

---

**Last Updated:** After Ludusavi startup fix  
**All Processes:** ✅ Verified hidden on Windows  
**Status:** Ready for production

