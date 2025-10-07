# Testing Guide - Ludusavi Startup Fix

## 🎯 What to Test

Anda perlu verify bahwa fix sudah bekerja dengan benar. Berikut testing guide lengkap.

---

## 🧪 Test 1: Fresh Install - No CMD Window

### Objective
Verify bahwa saat first-time setup, TIDAK ADA CMD window yang muncul dan app langsung ready.

### Steps:
1. **Hapus AppData directory:**
   ```powershell
   Remove-Item -Path "$env:APPDATA\Roaming\Chaos" -Recurse -Force -ErrorAction SilentlyContinue
   ```

2. **Start app dalam dev mode:**
   ```powershell
   cd C:\Users\Nazril\Documents\ProjekV2\Chaos
   npm run tauri dev
   ```

3. **Observe:**
   - ✅ App window muncul langsung
   - ✅ TIDAK ADA CMD window flash
   - ✅ Tidak ada freeze/hanging

4. **Check console output:**
   Look for:
   ```
   [Setup] ✓ Aria2c initialized
   [Ludasavi] Initializing...
   [Ludasavi] Binary path: C:\Users\...\AppData\Roaming\Chaos\ludusavi\ludusavi.exe
   [Ludasavi] ✓ Binary copied successfully
   [Ludasavi] ✓ Config copied successfully
   [Ludasavi] ✓ Initialization complete (manifest update skipped)  ← KEY!
   [Setup] ✓ Ludusavi initialized successfully
   ```

### Expected Result:
- ✅ No "Updating manifest database..." message
- ✅ No CMD window appears
- ✅ Startup completes in <2 seconds

### ❌ If FAILED:
Check:
- Apakah masih ada call ke `update_manifest()` di `init()`?
- Apakah `CREATE_NO_WINDOW` flag sudah ditambahkan?

---

## 🧪 Test 2: Subsequent Runs - Instant Startup

### Objective
Verify bahwa startup kedua kalinya juga cepat (binary sudah ada).

### Steps:
1. **Close app** (jika masih running)

2. **Start lagi:**
   ```powershell
   npm run tauri dev
   ```

3. **Check console:**
   ```
   [Ludasavi] Binary path: ...
   [Ludasavi] Binary already exists  ← KEY!
   [Ludasavi] Config already exists  ← KEY!
   [Ludasavi] ✓ Initialization complete (manifest update skipped)
   ```

### Expected Result:
- ✅ Startup SANGAT cepat (<1 second)
- ✅ No file copy operations
- ✅ No CMD window

---

## 🧪 Test 3: Cloud Save Preview - Works Without Manifest Update

### Objective
Verify bahwa cloud save preview masih berfungsi meskipun manifest tidak di-update saat startup.

### Steps:
1. **Start app**

2. **Add game to library:**
   - Buka Catalogue
   - Search "Stardew Valley" (or any game you have)
   - Add to library

3. **Open game details:**
   - Click game card
   - Go to "Cloud Save" tab

4. **Click "Preview Save Files"**

5. **Observe:**
   - ✅ Save files detected (if game installed)
   - ✅ OR message "No save files found" (if not installed)
   - ✅ TIDAK ADA CMD window flash
   - ✅ Operation completes successfully

### Expected Console:
```
[CloudSync] Getting backup preview for: Stardew Valley
[CloudSync] Executing ludusavi backup preview...
[CloudSync] Found save files: ...
```

### Expected Result:
- ✅ Backup preview works correctly
- ✅ No CMD window during execution
- ✅ Ludusavi auto-updates manifest on first use (if needed)

---

## 🧪 Test 4: Manual Manifest Update Command (Optional)

### Objective
Verify new command untuk manual manifest update.

### Steps:
1. **Open app**

2. **Open browser DevTools:**
   - Right-click → Inspect
   - Go to Console tab

3. **Run command:**
   ```javascript
   await window.__TAURI__.invoke('update_ludusavi_manifest')
   ```

4. **Observe:**
   - ✅ Command completes successfully
   - ✅ No CMD window appears
   - ✅ Returns: "Ludusavi manifest database updated successfully"

### Expected Console Output:
```javascript
Promise {<fulfilled>: "Ludusavi manifest database updated successfully"}
```

### Expected Result:
- ✅ Update runs in background
- ✅ No visual disruption
- ✅ No CMD window

---

## 🧪 Test 5: Production Build

### Objective
Verify fix works in production build (bukan hanya dev).

### Steps:
1. **Build app:**
   ```powershell
   npm run tauri build
   ```

2. **Install .msi:**
   - Go to `src-tauri\target\release\bundle\msi\`
   - Install `Chaos_0.1.0_x64_en-US.msi`

3. **Run installed app**

4. **Repeat Test 1, 2, 3**

### Expected Result:
- ✅ Production build behaves sama dengan dev mode
- ✅ No CMD window in production
- ✅ Fast startup

---

## 🔍 What to Look For

### ✅ SUCCESS Indicators:
1. **No CMD Window:**
   - Tidak ada black console window flash
   - Tidak ada "ludusavi.exe" window

2. **Fast Startup:**
   - Dev mode: <2 seconds
   - Production: <1 second

3. **Console Output:**
   ```
   [Ludasavi] ✓ Initialization complete (manifest update skipped)
   ```
   NOT:
   ```
   [Ludasavi] Updating manifest database...
   ```

4. **Features Work:**
   - Cloud save preview works
   - Backup works
   - Restore works

### ❌ FAILURE Indicators:
1. **CMD Window Appears:**
   - Even for a split second
   - → Fix not applied correctly

2. **Slow Startup:**
   - Takes >5 seconds
   - Hangs/freezes
   - → Network call still happening

3. **Error Messages:**
   ```
   Failed to update manifest: ...
   ```
   → Old code still running

---

## 📊 Comparison Checklist

| Scenario | Before Fix | After Fix | Status |
|----------|------------|-----------|--------|
| **First startup** | 5-10s, CMD flash | <2s, silent | [ ] |
| **Subsequent runs** | 3-5s | <1s | [ ] |
| **CMD window** | Appears | Never | [ ] |
| **Offline mode** | Crashes | Works | [ ] |
| **Cloud save preview** | Works | Works | [ ] |
| **Production build** | Same issues | Fixed | [ ] |

---

## 🐛 Troubleshooting

### Problem: CMD Window Still Appears

**Cause:** `CREATE_NO_WINDOW` not applied or old code still running

**Solution:**
1. Check `src-tauri/src/ludasavi.rs` line 267-271
2. Verify `#[cfg(target_os = "windows")]` block exists
3. Rebuild: `cargo clean && cargo build`

---

### Problem: Startup Still Slow

**Cause:** Manifest update still being called

**Solution:**
1. Check console for: "Updating manifest database..."
2. If present, check `src-tauri/src/ludasavi.rs` line 241-248
3. Should say: "manifest update skipped"

---

### Problem: Cloud Save Not Working

**Cause:** Ludusavi binary not found or config missing

**Solution:**
1. Check: `C:\Users\...\AppData\Roaming\Chaos\ludusavi\`
2. Should contain:
   - `ludusavi.exe`
   - `config.yaml`
3. If missing, check console for copy errors

---

## 📝 Final Verification

After all tests pass, confirm:

- [ ] ✅ No CMD window appears in ANY scenario
- [ ] ✅ Startup is consistently fast (<2s)
- [ ] ✅ Cloud save features work correctly
- [ ] ✅ Console shows "manifest update skipped"
- [ ] ✅ Production build works same as dev
- [ ] ✅ Offline mode doesn't crash

---

## 🎓 Understanding the Fix

### What Changed:
1. **Removed blocking network call from startup**
   - Manifest update no longer runs automatically
   - App starts instantly

2. **Added process hiding flag**
   - All external processes use `CREATE_NO_WINDOW`
   - Professional UX

3. **Made manifest update optional**
   - Can be triggered manually
   - Or auto-updates on first cloud save use

### Why It Works:
- **Hydra Pattern:** Only copy files at startup, no network
- **Lazy Loading:** Expensive operations deferred
- **Graceful Degradation:** Works offline

---

**Next Steps After Testing:**
1. If all tests pass → Mark as ✅ VERIFIED
2. If any test fails → Report which test and what happened
3. Once verified → Safe to use in production

**Good luck! 🚀**

