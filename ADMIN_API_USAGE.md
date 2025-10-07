# Admin API Usage Guide

## Setup

### 1. Add Environment Variable to Worker

Di Cloudflare Dashboard > Workers > Settings > Variables:

```
Name: ADMIN_SECRET_TOKEN
Value: your-super-secret-admin-token-here-12345
Type: Secret (encrypted)
```

---

## API Endpoints

### 1. Add New Key

**Endpoint:** `POST /admin/add-key`

**Request:**
```bash
curl -X POST "https://auth.nzr.web.id/admin/add-key" \
  -H "Content-Type: application/json" \
  -d '{
    "adminToken": "your-super-secret-admin-token-here-12345",
    "key": "CHAOS-NEW-KEY-XXXX",
    "maxDevices": 1,
    "expiresInDays": 365
  }'
```

**PowerShell:**
```powershell
$body = @{
    adminToken = "your-super-secret-admin-token-here-12345"
    key = "CHAOS-NEW-KEY-XXXX"
    maxDevices = 1
    expiresInDays = 365
} | ConvertTo-Json

curl.exe -X POST "https://auth.nzr.web.id/admin/add-key" `
  -H "Content-Type: application/json" `
  -d $body
```

**Response Success:**
```json
{
  "success": true,
  "message": "Key added successfully",
  "key": "CHAOS-NEW-KEY-XXXX"
}
```

**Response Error (Key exists):**
```json
{
  "error": "Key already exists"
}
```

---

### 2. List All Keys (with binding data)

**Endpoint:** `GET /admin/list-keys?adminToken=xxx`

**Request:**
```bash
curl "https://auth.nzr.web.id/admin/list-keys?adminToken=your-super-secret-admin-token-here-12345"
```

**PowerShell:**
```powershell
curl.exe "https://auth.nzr.web.id/admin/list-keys?adminToken=your-super-secret-admin-token-here-12345"
```

**Response:**
```json
{
  "keys": [
    {
      "key": "CHAOS-A1B2-C3D4-E5F7",
      "status": "used",
      "activatedAt": "2025-10-07T15:38:34.835Z",
      "expiresAt": "2026-10-07T15:38:34.835Z",
      "deviceId": "fe84ab76415874f7e7fe2636ae49240064de517fb9384af7b1fbd821c63197d0",
      "maxDevices": 1
    },
    {
      "key": "CHAOS-NEW-KEY-XXXX",
      "status": "available",
      "activatedAt": null,
      "expiresAt": null,
      "deviceId": null,
      "maxDevices": 1
    }
  ]
}
```

---

### 3. Delete Key

**Endpoint:** `DELETE /admin/delete-key`

**Request:**
```bash
curl -X DELETE "https://auth.nzr.web.id/admin/delete-key" \
  -H "Content-Type: application/json" \
  -d '{
    "adminToken": "your-super-secret-admin-token-here-12345",
    "key": "CHAOS-OLD-KEY-XXXX"
  }'
```

**PowerShell:**
```powershell
$body = @{
    adminToken = "your-super-secret-admin-token-here-12345"
    key = "CHAOS-OLD-KEY-XXXX"
} | ConvertTo-Json

curl.exe -X DELETE "https://auth.nzr.web.id/admin/delete-key" `
  -H "Content-Type: application/json" `
  -d $body
```

**Response:**
```json
{
  "success": true,
  "message": "Key deleted successfully"
}
```

---

## Security Features

1. ✅ **Token-based Authentication**
   - All admin endpoints require `adminToken`
   - Token stored as encrypted secret in Worker

2. ✅ **Read from R2 before Write**
   - Fetches current data from R2
   - Adds/removes key from existing data
   - Preserves all binding information

3. ✅ **Validation**
   - Check key format (must start with "CHAOS-")
   - Check duplicate keys before adding
   - Check key existence before deleting

4. ✅ **No Local File Needed**
   - Everything managed via API
   - Direct R2 manipulation
   - Always in sync

---

## Workflow

### Old Way (❌ Dangerous):
```
1. Edit local keys.json
2. Upload to R2
3. ❌ Overwrites all binding data!
```

### New Way (✅ Safe):
```
1. curl POST /admin/add-key
2. Worker reads R2 → adds key → saves R2
3. ✅ Preserves all existing data!
```

---

## Batch Add Keys

**Bash Script:**
```bash
#!/bin/bash

ADMIN_TOKEN="your-super-secret-admin-token-here-12345"
API_URL="https://auth.nzr.web.id/admin/add-key"

KEYS=(
  "CHAOS-BATCH-0001"
  "CHAOS-BATCH-0002"
  "CHAOS-BATCH-0003"
)

for KEY in "${KEYS[@]}"; do
  echo "Adding key: $KEY"
  curl -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"adminToken\":\"$ADMIN_TOKEN\",\"key\":\"$KEY\",\"maxDevices\":1,\"expiresInDays\":365}"
  echo ""
done
```

**PowerShell Script:**
```powershell
$adminToken = "your-super-secret-admin-token-here-12345"
$apiUrl = "https://auth.nzr.web.id/admin/add-key"

$keys = @(
  "CHAOS-BATCH-0001",
  "CHAOS-BATCH-0002",
  "CHAOS-BATCH-0003"
)

foreach ($key in $keys) {
  Write-Host "Adding key: $key"
  
  $body = @{
    adminToken = $adminToken
    key = $key
    maxDevices = 1
    expiresInDays = 365
  } | ConvertTo-Json

  curl.exe -X POST $apiUrl `
    -H "Content-Type: application/json" `
    -d $body
  
  Write-Host ""
}
```

---

## Monitoring

**Check total keys:**
```bash
curl "https://auth.nzr.web.id/admin/list-keys?adminToken=xxx" | jq '.keys | length'
```

**Check available keys:**
```bash
curl "https://auth.nzr.web.id/admin/list-keys?adminToken=xxx" | jq '.keys[] | select(.status=="available")'
```

**Check used keys:**
```bash
curl "https://auth.nzr.web.id/admin/list-keys?adminToken=xxx" | jq '.keys[] | select(.status=="used")'
```

---

## Error Handling

| Error | Reason | Solution |
|-------|--------|----------|
| `Unauthorized` | Wrong admin token | Check `ADMIN_SECRET_TOKEN` env var |
| `Key already exists` | Duplicate key | Use different key or delete old one |
| `Invalid key format` | Key doesn't start with "CHAOS-" | Fix key format |
| `Key not found` | Delete non-existent key | Check key name |

---

## Best Practices

1. **Never commit admin token to git**
   - Use environment variables
   - Keep token secret

2. **Backup before bulk operations**
   - Download current keys with `/admin/list-keys`
   - Save locally as backup

3. **Use descriptive key names**
   - `CHAOS-TRIAL-001` for trial keys
   - `CHAOS-PREMIUM-001` for premium keys
   - `CHAOS-LIFETIME-001` for lifetime keys

4. **Monitor usage regularly**
   - Check which keys are used
   - Remove expired/unused keys

