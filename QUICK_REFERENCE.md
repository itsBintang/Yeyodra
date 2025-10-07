# 🚀 Quick Reference - Admin API Commands

## 📌 Quick Setup

```powershell
# Set your admin token as environment variable (recommended)
$env:CHAOS_ADMIN_TOKEN = "your-admin-token-here"
$env:CHAOS_API_URL = "https://auth.nzr.web.id"
```

---

## 📋 Common Commands

### 1️⃣ Add New License Key

```powershell
# Using JSON file (recommended)
@"
{
  "adminToken": "$env:CHAOS_ADMIN_TOKEN",
  "key": "CHAOS-NEW-KEY-2024",
  "maxDevices": 1,
  "expiresInDays": 365
}
"@ | Out-File -Encoding utf8 add-key.json

curl.exe -X POST "$env:CHAOS_API_URL/admin/add-key" `
  -H "Content-Type: application/json" `
  -d "@add-key.json"

Remove-Item add-key.json
```

---

### 2️⃣ List All Keys

```powershell
# Simple list
curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN"

# Pretty print with PowerShell
$response = curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json
$response.keys | Format-Table key, status, deviceId -AutoSize
```

---

### 3️⃣ Delete License Key

```powershell
@"
{
  "adminToken": "$env:CHAOS_ADMIN_TOKEN",
  "key": "CHAOS-OLD-KEY-2023"
}
"@ | Out-File -Encoding utf8 delete-key.json

curl.exe -X DELETE "$env:CHAOS_API_URL/admin/delete-key" `
  -H "Content-Type: application/json" `
  -d "@delete-key.json"

Remove-Item delete-key.json
```

---

## 📊 Monitoring Commands

### Check Available Keys

```powershell
$response = curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json
$available = $response.keys | Where-Object status -eq 'available'

Write-Host "Available Keys: $($available.Count)" -ForegroundColor Green
$available | Format-Table key, maxDevices
```

---

### Check Used Keys

```powershell
$response = curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json
$used = $response.keys | Where-Object status -eq 'used'

Write-Host "Used Keys: $($used.Count)" -ForegroundColor Yellow
$used | Format-Table key, deviceId, activatedAt -AutoSize
```

---

### Check Expiring Soon (within 30 days)

```powershell
$response = curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json
$expiringSoon = $response.keys | Where-Object { 
    $_.expiresAt -and 
    ([DateTime]$_.expiresAt) -lt (Get-Date).AddDays(30) 
}

Write-Host "Expiring in 30 days: $($expiringSoon.Count)" -ForegroundColor Red
$expiringSoon | Format-Table key, expiresAt -AutoSize
```

---

## 🔄 Batch Operations

### Add Multiple Keys

```powershell
$keys = @(
    "CHAOS-BATCH-001",
    "CHAOS-BATCH-002",
    "CHAOS-BATCH-003"
)

foreach ($key in $keys) {
    Write-Host "Adding: $key" -ForegroundColor Cyan
    
    @"
{
  "adminToken": "$env:CHAOS_ADMIN_TOKEN",
  "key": "$key",
  "maxDevices": 1,
  "expiresInDays": 365
}
"@ | Out-File -Encoding utf8 temp-add.json
    
    $result = curl.exe -X POST "$env:CHAOS_API_URL/admin/add-key" `
        -H "Content-Type: application/json" `
        -d "@temp-add.json" | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "  ✓ Success" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed: $($result.error)" -ForegroundColor Red
    }
    
    Remove-Item temp-add.json
    Start-Sleep -Milliseconds 200
}
```

---

### Generate & Add Random Keys

```powershell
function New-ChaosKey {
    param([int]$count = 1)
    
    for ($i = 1; $i -le $count; $i++) {
        $random = -join ((65..90) + (48..57) | Get-Random -Count 12 | ForEach-Object {[char]$_})
        $formatted = "CHAOS-$($random.Substring(0,4))-$($random.Substring(4,4))-$($random.Substring(8,4))"
        
        Write-Host "Generating key $i/$count : $formatted" -ForegroundColor Cyan
        
        @"
{
  "adminToken": "$env:CHAOS_ADMIN_TOKEN",
  "key": "$formatted",
  "maxDevices": 1,
  "expiresInDays": 365
}
"@ | Out-File -Encoding utf8 temp.json
        
        $result = curl.exe -X POST "$env:CHAOS_API_URL/admin/add-key" `
            -H "Content-Type: application/json" `
            -d "@temp.json" | ConvertFrom-Json
        
        if ($result.success) {
            Write-Host "  ✓ Added" -ForegroundColor Green
        }
        
        Remove-Item temp.json
    }
}

# Usage: Generate 10 random keys
New-ChaosKey -count 10
```

---

## 💾 Backup & Export

### Export All Keys to JSON

```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$filename = "keys_backup_$timestamp.json"

curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" `
    | Out-File -Encoding utf8 $filename

Write-Host "Backup saved to: $filename" -ForegroundColor Green
```

---

### Export Available Keys Only (CSV)

```powershell
$response = curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json
$available = $response.keys | Where-Object status -eq 'available'

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$filename = "available_keys_$timestamp.csv"

$available | Select-Object key, maxDevices | Export-Csv -Path $filename -NoTypeInformation

Write-Host "Exported $($available.Count) available keys to: $filename" -ForegroundColor Green
```

---

## 🧪 Testing

### Test Health Check

```powershell
curl.exe "$env:CHAOS_API_URL/"
```

**Expected:**
```json
{
  "service": "CHAOS Launcher License Server",
  "status": "running"
}
```

---

### Test Activation (with fake HWID)

```powershell
@"
{
  "key": "CHAOS-TEST-KEY",
  "deviceId": "test-hwid-12345"
}
"@ | Out-File -Encoding utf8 test-activate.json

curl.exe -X POST "$env:CHAOS_API_URL/activate" `
  -H "Content-Type: application/json" `
  -d "@test-activate.json"

Remove-Item test-activate.json
```

---

## 📈 Statistics

### Get Summary Stats

```powershell
$response = curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json

$total = $response.keys.Count
$available = ($response.keys | Where-Object status -eq 'available').Count
$used = ($response.keys | Where-Object status -eq 'used').Count

Write-Host "`n=== LICENSE STATISTICS ===" -ForegroundColor Cyan
Write-Host "Total Keys:     $total" -ForegroundColor White
Write-Host "Available:      $available" -ForegroundColor Green
Write-Host "Used:           $used" -ForegroundColor Yellow
Write-Host "Usage Rate:     $('{0:P2}' -f ($used / $total))" -ForegroundColor Magenta
```

---

## 🔧 Maintenance

### Clean Up Test Keys

```powershell
$response = curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json
$testKeys = $response.keys | Where-Object { $_.key -like "*TEST*" }

Write-Host "Found $($testKeys.Count) test keys" -ForegroundColor Yellow

foreach ($key in $testKeys) {
    Write-Host "Deleting: $($key.key)" -ForegroundColor Red
    
    @"
{
  "adminToken": "$env:CHAOS_ADMIN_TOKEN",
  "key": "$($key.key)"
}
"@ | Out-File -Encoding utf8 temp-del.json
    
    curl.exe -X DELETE "$env:CHAOS_API_URL/admin/delete-key" `
        -H "Content-Type: application/json" `
        -d "@temp-del.json"
    
    Remove-Item temp-del.json
}
```

---

## 🎯 Pro Tips

### 1. Save Admin Token Securely

```powershell
# Save to Windows Credential Manager (one-time)
cmdkey /generic:CHAOS_ADMIN /user:admin /pass:your-token-here

# Retrieve when needed
$token = (cmdkey /list:CHAOS_ADMIN | Select-String "Password").ToString().Split(":")[1].Trim()
```

### 2. Create Alias for Common Commands

```powershell
# Add to PowerShell profile ($PROFILE)
function chaos-list {
    curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json | 
        Select-Object -ExpandProperty keys | 
        Format-Table key, status, deviceId -AutoSize
}

function chaos-stats {
    $r = curl.exe "$env:CHAOS_API_URL/admin/list-keys?adminToken=$env:CHAOS_ADMIN_TOKEN" | ConvertFrom-Json
    Write-Host "Total: $($r.keys.Count) | Available: $(($r.keys | ? status -eq 'available').Count) | Used: $(($r.keys | ? status -eq 'used').Count)"
}

# Usage:
chaos-list
chaos-stats
```

---

## 📞 Support

**API Base URL:** `https://auth.nzr.web.id`

**Endpoints:**
- `POST /activate` - Public
- `POST /validate` - Public  
- `POST /admin/add-key` - Admin only
- `GET /admin/list-keys` - Admin only
- `DELETE /admin/delete-key` - Admin only

**Authentication:** All admin endpoints require `adminToken` parameter

