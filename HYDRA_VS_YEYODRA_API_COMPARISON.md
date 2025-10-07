# Hydra vs Yeyodra - Steam API Comparison

## 🔍 Investigasi: Apakah Hydra Fetch ke Steam API?

### ✅ **JAWABAN: YA, Hydra JUGA fetch ke Steam API!**

## 📊 Perbandingan Detail

### **Hydra (Electron + Node.js)**

#### Location: `src/main/services/steam.ts`
```typescript
export const getSteamAppDetails = async (
  objectId: string,
  language: string
) => {
  const searchParams = new URLSearchParams({
    appids: objectId,
    l: language,
  });

  return axios
    .get<SteamAppDetailsResponse>(
      `http://store.steampowered.com/api/appdetails?${searchParams.toString()}`
    )
    .then((response) => {
      if (response.data[objectId].success) {
        const data = response.data[objectId].data;
        return { ...data, objectId };
      }
      return null;
    })
    .catch((err) => {
      logger.error(err, { method: "getSteamAppDetails" });
      return null; // ⚠️ Silent fail - return null on error
    });
};
```

**Key Points:**
- ✅ Fetch ke **EXACT SAME endpoint**: `http://store.steampowered.com/api/appdetails`
- ✅ Pakai `axios` (HTTP client untuk Node.js)
- ⚠️ **Silent fail**: Return `null` saat error (tidak throw exception)
- ⚠️ **No retry logic**: Langsung fail pada error pertama
- ⚠️ **Generic error handling**: Semua error di-log dan return null

---

### **Yeyodra (Tauri + Rust)**

#### Location: `src-tauri/src/api.rs`
```rust
pub async fn fetch_steam_app_details(
    object_id: &str,
    language: &str,
) -> Result<SteamAppDetails, String> {
    let url = format!(
        "http://store.steampowered.com/api/appdetails?appids={}&l={}",
        object_id, language
    );
    
    // Retry logic for Steam API (up to 3 attempts)
    let max_retries = 3;
    
    for attempt in 0..max_retries {
        if attempt > 0 {
            let delay = Duration::from_secs(2_u64.pow(attempt));
            tokio::time::sleep(delay).await;
        }
        
        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                
                // Special handling untuk 503
                if status.as_u16() == 503 {
                    last_error = format!(
                        "Steam Store API is temporarily unavailable (503). 
                         This is a Steam server issue..."
                    );
                    if attempt >= 1 { break; }
                    continue;
                }
                // ... handle success/other errors
            }
            Err(e) => {
                last_error = format!("Network error: {}", e);
                continue;
            }
        }
    }
    
    Err(last_error)
}
```

**Key Points:**
- ✅ Fetch ke **EXACT SAME endpoint**: `http://store.steampowered.com/api/appdetails`
- ✅ Pakai `reqwest` (HTTP client untuk Rust)
- ✅ **Retry mechanism**: Up to 3 attempts dengan exponential backoff
- ✅ **Specific 503 handling**: Custom message untuk Steam API down
- ✅ **Detailed error messages**: User tahu exact problem
- ✅ **Graceful degradation**: Frontend tetap bisa handle error

---

## 🎯 Key Differences

| Aspect | Hydra | Yeyodra |
|--------|-------|---------|
| **Endpoint** | ✅ Same: `store.steampowered.com/api/appdetails` | ✅ Same |
| **HTTP Client** | Axios (Node.js) | Reqwest (Rust) |
| **Error Handling** | Silent fail (return null) | Explicit error messages |
| **Retry Logic** | ❌ None | ✅ 3 attempts with backoff |
| **503 Handling** | ❌ Generic | ✅ Specific message |
| **User Feedback** | Silent (no error shown) | Clear console warnings |
| **Caching** | ✅ LevelDB cache | ❌ Not implemented yet |
| **Performance** | Fast (cached) | Slower (no cache yet) |

---

## 🔧 Hydra's Caching Strategy

### File: `src/main/events/catalogue/get-game-shop-details.ts`

```typescript
const getGameShopDetails = async (...) => {
  if (shop === "steam") {
    // 1. Try to get from cache first
    const [cachedData, cachedAssets] = await Promise.all([
      gamesShopCacheSublevel.get(...),  // LevelDB cache
      gamesShopAssetsSublevel.get(...),
    ]);

    // 2. Fetch from Steam API (background)
    const appDetails = getLocalizedSteamAppDetails(...).then(...);

    // 3. Return cached data immediately if available
    if (cachedData) {
      return {
        ...cachedData,
        assets: cachedAssets ?? null,
      };
    }

    // 4. Wait for API if no cache
    return appDetails;
  }
};
```

**Hydra's Advantage:**
- ⚡ **Instant load** jika ada cache (tidak perlu wait API)
- 🔄 **Background update** fetch dari API untuk refresh cache
- 💾 **Persistent cache** di LevelDB (survive app restart)
- 🎯 **Better UX** karena UI tidak blank saat API down

---

## ⚠️ Mengapa Hydra Sepertinya "Tidak Error"?

### **Alasan:**

1. **Caching Strategy**
   - Hydra punya cache di LevelDB
   - Saat Steam API down, Hydra pakai cached data
   - User tidak lihat error karena UI tetap load dari cache

2. **Silent Error Handling**
   ```typescript
   .catch((err) => {
     logger.error(err);
     return null; // Silent fail
   });
   ```
   - Error hanya di-log ke console
   - Tidak throw exception ke UI
   - UI tetap render dengan data lama/cache

3. **Graceful Degradation**
   - Frontend Hydra designed untuk handle `null` shopDetails
   - Tidak crash saat API fail
   - Show placeholder atau cached data

---

## 💡 Rekomendasi untuk Yeyodra

### **Implementasi Caching (seperti Hydra)**

#### **Option 1: JSON File Cache (Simple)**
```rust
// src-tauri/src/cache.rs
pub struct GameDetailsCache {
    cache_dir: PathBuf,
}

impl GameDetailsCache {
    pub fn get(&self, object_id: &str, language: &str) -> Result<SteamAppDetails> {
        let cache_file = self.cache_dir.join(format!("{}_{}.json", object_id, language));
        if cache_file.exists() {
            let content = fs::read_to_string(cache_file)?;
            let data: CachedData = serde_json::from_str(&content)?;
            
            // Check if cache is still valid (e.g., 24 hours)
            if data.is_valid() {
                return Ok(data.details);
            }
        }
        Err("Cache miss or expired".into())
    }
    
    pub fn set(&self, object_id: &str, language: &str, details: SteamAppDetails) {
        // Save to JSON file with timestamp
    }
}
```

**Usage:**
```rust
pub async fn fetch_steam_app_details(...) -> Result<SteamAppDetails, String> {
    let cache = GameDetailsCache::new();
    
    // Try cache first
    if let Ok(cached) = cache.get(object_id, language) {
        println!("Using cached Steam data");
        
        // Background refresh (optional)
        tokio::spawn(async move {
            // Fetch fresh data and update cache
        });
        
        return Ok(cached);
    }
    
    // Fetch from API if cache miss
    let details = fetch_from_steam_api(object_id, language).await?;
    cache.set(object_id, language, details.clone());
    
    Ok(details)
}
```

#### **Option 2: SQLite Cache (Better)**
```rust
// Use rusqlite for local database cache
// Similar to LevelDB but simpler to implement
```

---

## 📈 Performance Comparison

### **Scenario: Steam API Down (503)**

#### **Hydra:**
```
User opens game details
 ↓
Check LevelDB cache → Found ✅
 ↓
Render UI instantly (100ms)
 ↓
Background: Try Steam API → 503 Error (logged silently)
 ↓
User sees game details from cache ✅
```

#### **Yeyodra (Current):**
```
User opens game details
 ↓
No cache available ❌
 ↓
Try Steam API → 503 Error
 ↓
Retry 2x → Still 503
 ↓
Show error message ❌
 ↓
User sees "Failed to load game details"
```

#### **Yeyodra (With Cache - Recommended):**
```
User opens game details
 ↓
Check JSON cache → Found ✅
 ↓
Render UI instantly (50ms)
 ↓
Background: Try Steam API → 503 Error
 ↓
Console: "Using cached data, Steam API unavailable"
 ↓
User sees game details from cache ✅
```

---

## ✅ Kesimpulan

### **Apakah Hydra fetch ke Steam API?**
✅ **YA! Hydra JUGA fetch ke Steam API yang sama**

### **Mengapa Hydra "lebih stabil"?**
1. ✅ **Caching Layer** - LevelDB cache untuk instant load
2. ✅ **Silent Error Handling** - Error tidak throw ke UI
3. ✅ **Graceful Degradation** - UI tetap render dengan cache
4. ✅ **Background Refresh** - API fetch di background

### **Mengapa Yeyodra error lebih visible?**
1. ❌ **No Caching** - Harus fetch setiap kali
2. ✅ **Explicit Errors** - User tahu ada masalah (lebih honest)
3. ✅ **Better Logging** - Console message yang informatif
4. ✅ **Retry Logic** - Attempt to recover (Hydra tidak punya)

### **Yang Harus Diimplementasi:**
1. 🔥 **PRIORITY 1**: Caching system (JSON atau SQLite)
2. 🔥 **PRIORITY 2**: Graceful degradation di UI
3. 📝 Optional: Background refresh strategy
4. 📝 Optional: Cache invalidation logic (TTL)

---

## 📝 Next Steps

### **Implementation Plan:**
1. Create `src-tauri/src/cache.rs` module
2. Implement `GameDetailsCache` struct
3. Add cache check before API call
4. Save successful API responses to cache
5. Update frontend to handle cached data gracefully
6. Add cache management commands (clear, stats)

### **Testing:**
1. Test cache hit (instant load)
2. Test cache miss (fetch from API)
3. Test API down + cache available (graceful)
4. Test API down + no cache (current behavior)

---

**Status**: ✅ Analysis Complete  
**Recommendation**: Implement caching untuk better UX  
**Priority**: High (sama pentingnya dengan retry logic)


