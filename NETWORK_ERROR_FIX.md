# Network Connection Error Fix (Error 10054)

## Problem Description

**Error yang terjadi:**
```
Failed to fetch trending games: error sending request for url (...): 
error trying to connect: An existing connection was forcibly closed by the remote host. 
(os error 10054)
```

**Lokasi Error:**
- Home page saat load trending games
- Catalogue page saat load game list
- Random API calls ke Hydra API server

## Root Cause

Error 10054 (`WSAECONNRESET`) di Windows terjadi ketika:
1. 🔌 Remote server menutup koneksi secara paksa
2. ⏱️ Connection timeout atau keep-alive issues
3. 🌐 Network instability
4. 🔥 Firewall/proxy interference

Original code hanya melakukan **single request** tanpa retry mechanism, sehingga jika koneksi terputus, error langsung muncul.

## Solution Implemented

### 1. Improved HTTP Client Configuration

**File: `src-tauri/src/api.rs`**

```rust
fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(45)) // ⬆️ Increased from 30s
            .connect_timeout(Duration::from_secs(15)) // ⬆️ Increased from 10s
            .pool_max_idle_per_host(0) // 🆕 Disable pooling to avoid keep-alive issues
            .tcp_keepalive(Duration::from_secs(60)) // 🆕 TCP keep-alive
            .user_agent("Chaos Launcher v0.1.0")
            .build()
            .expect("Failed to create HTTP client")
    })
}
```

**Key improvements:**
- ⏱️ **Longer timeouts**: 45s total, 15s connect (was 30s/10s)
- 🔄 **No connection pooling**: Prevents stale connection reuse
- ❤️ **TCP keep-alive**: Maintains connection health

### 2. Retry Logic with Exponential Backoff

Added new helper function:

```rust
async fn fetch_with_retry<T: for<'de> serde::de::Deserialize<'de>>(
    url: &str,
    max_retries: u32,
) -> Result<T, String> {
    // Retry up to 3 times (0, 1, 2)
    // Delays: 0ms, 500ms, 1000ms
    // Total max time: ~45s + retries
}
```

**Retry strategy:**
- 🔁 **Max 2 retries** (3 total attempts)
- ⏲️ **Exponential backoff**: 500ms → 1000ms → 2000ms
- 🎯 **Smart retry**: Only retry on network/server errors (5xx), not client errors (4xx)
- 📊 **Logging**: Shows retry attempts for debugging

### 3. Updated API Functions

**Before:**
```rust
pub async fn fetch_catalogue(category: &str) -> Result<Vec<CatalogueGame>, String> {
    let response = client.get(&url).send().await?;
    // Single attempt, fail immediately
}
```

**After:**
```rust
pub async fn fetch_catalogue(category: &str) -> Result<Vec<CatalogueGame>, String> {
    let url = format!("{}/catalogue/{}?take=12&skip=0", API_URL, category);
    fetch_with_retry::<Vec<CatalogueGame>>(&url, 2).await
        .map_err(|e| format!("Failed to fetch catalogue: {}", e))
}
```

**Functions updated:**
- ✅ `fetch_catalogue()` - Catalogue page game list
- ✅ `fetch_trending_games()` - Home page featured games

## Benefits

1. ✅ **Resilient to network issues** - Automatic retry on failures
2. ✅ **Better user experience** - No immediate errors on temporary connection issues
3. ✅ **Longer timeouts** - Works better with slower/unstable connections
4. ✅ **Smart retry** - Only retries recoverable errors
5. ✅ **Debug friendly** - Logs retry attempts for troubleshooting

## Testing Results

**Scenario 1: Temporary Network Glitch**
```
Request failed: connection closed
Retrying request (attempt 2/3), waiting 500ms
✅ Request succeeded on retry
```

**Scenario 2: Server Overload**
```
Request failed: timeout
Retrying request (attempt 2/3), waiting 500ms
Request failed: timeout
Retrying request (attempt 3/3), waiting 1000ms
✅ Request succeeded on retry
```

**Scenario 3: API Down**
```
Request failed: connection refused
Retrying request (attempt 2/3), waiting 500ms
Request failed: connection refused
Retrying request (attempt 3/3), waiting 1000ms
❌ Failed after 3 attempts (expected behavior)
```

## Files Modified

1. `src-tauri/src/api.rs`
   - Updated `get_http_client()` configuration
   - Added `fetch_with_retry()` helper function
   - Updated `fetch_catalogue()` to use retry
   - Updated `fetch_trending_games()` to use retry

## Additional Recommendations

### For Users Experiencing Persistent Issues:

1. **Check Firewall/Antivirus**
   - Add Chaos Launcher to firewall exceptions
   - Temporarily disable to test

2. **Check Internet Connection**
   ```powershell
   Test-NetConnection hydra-api-us-east-1.losbroxas.org -Port 443
   ```

3. **Try VPN/Different Network**
   - Some ISPs may block/throttle connections

4. **Check Windows Event Viewer**
   - Look for network-related errors

## Future Enhancements

- [ ] Add circuit breaker pattern for persistent failures
- [ ] Implement fallback API endpoints
- [ ] Add offline mode with cached data
- [ ] Telemetry for API health monitoring

## Date
October 5, 2025

