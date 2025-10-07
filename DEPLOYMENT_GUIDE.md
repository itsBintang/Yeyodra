# 📘 Complete Deployment Guide - Step by Step

## 🎯 Goal
Upgrade worker kamu dengan Admin API endpoints yang aman untuk manage license keys tanpa overwrite binding data.

---

## 📋 STEP 1: Backup Current Worker

### 1.1 Login ke Cloudflare Dashboard
- Buka: https://dash.cloudflare.com
- Login dengan akun kamu

### 1.2 Navigate ke Worker
- Sidebar kiri > **Workers & Pages**
- Click worker **"auth"** (atau nama worker license server kamu)

### 1.3 Backup Code
- Click tab **"Edit Code"** atau **"Quick Edit"**
- Select All (Ctrl+A) → Copy (Ctrl+C)
- Paste ke Notepad/VSCode
- Save sebagai `worker-backup-OLD.js`

✅ **Backup selesai!** Kalau ada masalah, bisa restore dari backup ini.

---

## 📋 STEP 2: Update Worker Code

### 2.1 Delete Old Code
- Di editor Cloudflare Worker
- Select All (Ctrl+A)
- Delete (Del)

### 2.2 Copy New Code
- Buka file: `cloudflare-worker-complete.js`
- Select All (Ctrl+A) → Copy (Ctrl+C)

### 2.3 Paste ke Worker Editor
- Paste di Cloudflare Worker editor
- Code akan otomatis format

### 2.4 Save & Deploy
- Click button **"Save and Deploy"** (pojok kanan atas)
- Wait hingga muncul notif "Deployment successful"

✅ **Code updated!**

---

## 📋 STEP 3: Set Admin Secret Token

### 3.1 Navigate ke Settings
- Di halaman worker kamu
- Click tab **"Settings"**

### 3.2 Add Environment Variable
- Scroll ke section **"Variables and Secrets"**
- Click button **"Add variable"**

### 3.3 Input Variable
```
Variable name: ADMIN_SECRET_TOKEN
Value: chaos-admin-secret-12345-CHANGE-THIS
Type: ✓ Encrypt (pilih checkbox ini!)
```

**⚠️ IMPORTANT:** Ganti `chaos-admin-secret-12345-CHANGE-THIS` dengan token rahasia kamu sendiri!

**Tips untuk membuat token aman:**
- Minimal 32 karakter
- Mix huruf besar/kecil + angka
- Contoh: `ChAoS2024_MySupErSecRet_Admin_TokeN_9876XYZ`

### 3.4 Save
- Click **"Save"** atau **"Add variable"**
- Worker akan auto-redeploy

✅ **Admin token configured!**

---

## 📋 STEP 4: Verify R2 Binding

### 4.1 Check R2 Binding
- Masih di tab **"Settings"**
- Scroll ke section **"Bindings"**
- Pastikan ada binding:
  ```
  Type: R2 Bucket
  Variable name: KEYS_BUCKET
  R2 bucket: (nama bucket kamu)
  ```

### 4.2 Jika Belum Ada Binding
- Click **"Add binding"**
- Pilih **"R2 Bucket"**
- Variable name: `KEYS_BUCKET`
- R2 bucket: Pilih bucket yang sudah ada (atau create new)
- Click **"Save"**

✅ **R2 binding verified!**

---

## 📋 STEP 5: Upload Initial keys.json to R2

### 5.1 Navigate ke R2
- Cloudflare Dashboard sidebar > **R2**
- Click bucket yang kamu bind ke worker

### 5.2 Upload Initial File
Jika belum ada `keys.json` di R2:

**Option A: Via Dashboard**
- Click **"Upload"**
- Select file `keys.json` (yang isinya initial keys)
- Click **"Upload"**

**Option B: Via Wrangler CLI**
```bash
wrangler r2 object put <bucket-name>/keys.json --file=keys.json
```

**Initial keys.json content:**
```json
{
  "keys": [
    {
      "key": "CHAOS-A1B2-C3D4-E5F7",
      "status": "available",
      "activatedAt": null,
      "expiresAt": null,
      "deviceId": null,
      "maxDevices": 1
    },
    {
      "key": "CHAOS-A1B2-C3D4-E5G8",
      "status": "available",
      "activatedAt": null,
      "expiresAt": null,
      "deviceId": null,
      "maxDevices": 1
    }
  ]
}
```

✅ **R2 initialized!**

---

## 📋 STEP 6: Test Deployment

### 6.1 Test Health Check
```bash
curl https://auth.nzr.web.id/
```

**Expected Response:**
```json
{
  "service": "CHAOS Launcher License Server",
  "status": "running",
  "endpoints": {
    "public": [
      "POST /activate",
      "POST /validate"
    ],
    "admin": [
      "POST /admin/add-key",
      "GET /admin/list-keys",
      "DELETE /admin/delete-key"
    ]
  }
}
```

✅ If you see this → **Worker is running!**

---

## 📋 STEP 7: Test Admin Endpoints

### 7.1 Test List Keys (PowerShell)
```powershell
curl.exe "https://auth.nzr.web.id/admin/list-keys?adminToken=YOUR-ADMIN-TOKEN-HERE"
```

**Expected:** JSON dengan list semua keys

### 7.2 Test Add Key (PowerShell)
```powershell
# Create JSON file
@"
{
  "adminToken": "YOUR-ADMIN-TOKEN-HERE",
  "key": "CHAOS-TEST-NEW-KEY",
  "maxDevices": 1,
  "expiresInDays": 365
}
"@ | Out-File -Encoding utf8 test-add-key.json

# Send request
curl.exe -X POST "https://auth.nzr.web.id/admin/add-key" -H "Content-Type: application/json" -d "@test-add-key.json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Key added successfully",
  "key": "CHAOS-TEST-NEW-KEY",
  "totalKeys": 3
}
```

### 7.3 Verify Key Added
```powershell
curl.exe "https://auth.nzr.web.id/admin/list-keys?adminToken=YOUR-ADMIN-TOKEN-HERE"
```

**Expected:** JSON sekarang ada 3 keys (termasuk yang baru)

✅ **Admin API working!**

---

## 📋 STEP 8: Test Existing App Integration

### 8.1 Delete Local License
Di PowerShell:
```powershell
Remove-Item "$env:APPDATA\com.chaoslauncher.dev\license.json" -ErrorAction SilentlyContinue
```

### 8.2 Run App
```bash
npm run tauri dev
```

### 8.3 Test Activation
- App akan show License Activation page
- Input salah satu key yang available
- Click "Activate License"

**Expected:**
- ✅ Success animation
- ✅ App reloads
- ✅ Main app loads

### 8.4 Verify Binding in R2
```powershell
curl.exe "https://auth.nzr.web.id/admin/list-keys?adminToken=YOUR-ADMIN-TOKEN-HERE"
```

**Expected:** Key sekarang:
```json
{
  "key": "CHAOS-TEST-NEW-KEY",
  "status": "used",  // ← Changed!
  "deviceId": "fe84ab...",  // ← Has HWID!
  "activatedAt": "2025-10-07...",  // ← Has timestamp!
  "expiresAt": "2026-10-07...",  // ← Has expiry!
  "maxDevices": 1
}
```

✅ **End-to-end test passed!**

---

## 📋 STEP 9: Create Admin Scripts (Optional)

### 9.1 PowerShell Script for Adding Keys

**File: `add-license-key.ps1`**
```powershell
# Configuration
$adminToken = "YOUR-ADMIN-TOKEN-HERE"
$apiUrl = "https://auth.nzr.web.id/admin/add-key"

# Prompt for key
$key = Read-Host "Enter new license key (e.g., CHAOS-XXX-YYY)"
$maxDevices = Read-Host "Max devices (default: 1)"
if ([string]::IsNullOrEmpty($maxDevices)) { $maxDevices = 1 }

# Create request body
$body = @{
    adminToken = $adminToken
    key = $key
    maxDevices = [int]$maxDevices
    expiresInDays = 365
} | ConvertTo-Json

# Send request
Write-Host "`nAdding key: $key..." -ForegroundColor Yellow

$response = curl.exe -X POST $apiUrl `
    -H "Content-Type: application/json" `
    -d $body

Write-Host $response -ForegroundColor Green
```

**Usage:**
```powershell
.\add-license-key.ps1
# Enter key when prompted: CHAOS-NEW-2024-001
# Enter max devices: 1
```

### 9.2 PowerShell Script for Listing Keys

**File: `list-license-keys.ps1`**
```powershell
$adminToken = "YOUR-ADMIN-TOKEN-HERE"
$apiUrl = "https://auth.nzr.web.id/admin/list-keys?adminToken=$adminToken"

Write-Host "Fetching license keys..." -ForegroundColor Yellow

$response = curl.exe $apiUrl | ConvertFrom-Json

Write-Host "`nTotal Keys: $($response.keys.Count)" -ForegroundColor Cyan
Write-Host "Available: $(($response.keys | Where-Object status -eq 'available').Count)" -ForegroundColor Green
Write-Host "Used: $(($response.keys | Where-Object status -eq 'used').Count)" -ForegroundColor Yellow

Write-Host "`n=== ALL KEYS ===" -ForegroundColor Cyan
$response.keys | Format-Table key, status, deviceId, activatedAt -AutoSize
```

**Usage:**
```powershell
.\list-license-keys.ps1
```

✅ **Admin scripts ready!**

---

## 📋 STEP 10: Security Checklist

### ✅ Verify These:

- [ ] Admin token is **encrypted** (checkbox ✓ saat add variable)
- [ ] Admin token **NOT committed to git**
- [ ] Admin token **minimal 32 characters**
- [ ] R2 bucket **NOT public** (default private is OK)
- [ ] Worker logs **enabled** untuk monitoring
- [ ] Backup `keys.json` dari R2 secara berkala

---

## 🎉 DEPLOYMENT COMPLETE!

### What You've Built:

✅ **Secure License Server** with:
- Device-bound activation
- Re-installation support  
- Admin API for key management
- No data overwrite issues
- Token-based admin auth

### What You Can Do Now:

1. **Add keys via API** (no more manual R2 upload!)
2. **List all keys** with binding data
3. **Delete keys** safely
4. **Monitor usage** in real-time
5. **Batch operations** via scripts

---

## 🆘 Troubleshooting

### Issue: "Unauthorized" when calling admin endpoints
**Solution:** 
- Check `ADMIN_SECRET_TOKEN` di Worker Settings
- Pastikan token match dengan yang di request
- Pastikan variable type = **Encrypted**

### Issue: "Keys database not found"
**Solution:**
- Check R2 binding di Worker Settings
- Upload `keys.json` ke R2 bucket
- Pastikan filename exact: `keys.json`

### Issue: Worker deploy failed
**Solution:**
- Check syntax di code editor
- Pastikan R2 binding sudah ada
- Redeploy dari dashboard

### Issue: CORS error dari app
**Solution:**
- Sudah handled di code (Access-Control-Allow-Origin: *)
- Jika masih error, check browser DevTools Console

---

## 📞 Need Help?

- Check Cloudflare Worker Logs: Dashboard > Worker > Logs
- Test endpoints dengan curl dulu sebelum test dari app
- Backup `keys.json` dari R2 sebelum bulk operations

---

**Last Updated:** October 2025  
**Author:** AI Assistant  
**Project:** CHAOS Launcher

