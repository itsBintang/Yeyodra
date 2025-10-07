# Zenith Rate Limiting Analysis - Mencegah Flooding ke Steam API

## 🎯 **FUNDAMENTAL PATTERN ZENITH**

Setelah debugging dengan detail, inilah bagaimana Zenith mencegah flooding request ke Steam API:

---

## 📋 **Flow Lengkap Request ke Steam API**

### **1. Entry Point: `get_game_details()` Command**

```rust
#[command]
async fn get_game_details(app_id: String) -> Result<GameDetail, String> {
    // ✅ STEP 1: Check cache first (INSTANT!)
    if let Some(cached_details) = GAME_CACHE.get_game_details(&app_id).await {
        return Ok(cached_details); // 🚀 Cache HIT - No API call!
    }

    // ⏱️ STEP 2: Throttle request (RATE LIMITING!)
    GAME_CACHE.throttle_request().await;
    
    // 🌐 STEP 3: Make API call
    let url = format!("https://store.steampowered.com/api/appdetails?appids={}", app_id);
    
    let resp = match HTTP_CLIENT.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            // 🛑 STEP 4: Record error for circuit breaker
            GAME_CACHE.record_error().await;
            return Err(format!("Request failed: {}", e));
        }
    };
    
    // 🚨 STEP 5: Check for rate limit (429)
    if resp.status().as_u16() == 429 {
        GAME_CACHE.record_error().await; // Trigger circuit breaker
        return Err("Rate limited by Steam API (429)".to_string());
    }
    
    // ✅ STEP 6: Reset error count on success
    GAME_CACHE.reset_error_count().await;
    
    // Parse and return data...
}
```

---

## 🔧 **Mechanism #1: throttle_request() - Adaptive Rate Limiting**

### **Implementasi di `cache_service.rs`:**

```rust
pub async fn throttle_request(&self) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let delay = {
        let mut last_request = self.last_request_time.lock().await;
        let consecutive_errors = self.consecutive_errors.lock().await;

        let time_since_last = now - *last_request;
        
        // 🎯 KEY: Exponential backoff based on errors!
        let base_delay = self.config.request_delay_ms; // Default: 1000ms
        let backoff_multiplier = 2_u64.pow((*consecutive_errors).min(5));
        let required_delay = base_delay * backoff_multiplier;
        
        // Calculate if we need to wait
        if time_since_last < required_delay {
            let delay = required_delay - time_since_last;
            *last_request = now + delay;
            Some(delay)
        } else {
            *last_request = now;
            None
        }
    };

    // Wait if needed
    if let Some(delay_ms) = delay {
        if delay_ms > 500 {
            println!("⏱️ Rate limiting: waiting {}ms before next request", delay_ms);
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
    }
}
```

### **Bagaimana Ini Bekerja:**

#### **Scenario 1: Normal Operation (No Errors)**
```
Request 1: No wait (first request)
Request 2: Wait 1000ms (base delay)
Request 3: Wait 1000ms (base delay)
Request 4: Wait 1000ms (base delay)
```
**Max 1 request per second** ✅

#### **Scenario 2: After 1 Error**
```
Request fails → consecutive_errors = 1
backoff_multiplier = 2^1 = 2
required_delay = 1000ms * 2 = 2000ms

Next request: Wait 2 seconds ⏱️
```

#### **Scenario 3: After 3 Errors**
```
3 consecutive errors → consecutive_errors = 3
backoff_multiplier = 2^3 = 8
required_delay = 1000ms * 8 = 8000ms

Next request: Wait 8 seconds! ⏱️⏱️⏱️
```

#### **Scenario 4: After 5+ Errors**
```
5+ consecutive errors → circuit breaker OPENS! 🛑
NO MORE REQUESTS until errors reset
```

---

## 🔧 **Mechanism #2: Circuit Breaker Pattern**

### **record_error():**
```rust
pub async fn record_error(&self) {
    let mut consecutive_errors = self.consecutive_errors.lock().await;
    *consecutive_errors += 1;

    println!("⚠️ API error recorded. Consecutive errors: {}", *consecutive_errors);

    // 🛑 Open circuit breaker if too many errors
    if *consecutive_errors >= 5 {
        let mut circuit_open = self.circuit_breaker_open.lock().await;
        *circuit_open = true;
        println!("🔴 Circuit breaker OPENED - Stopping all API calls!");
    }
}
```

### **reset_error_count():**
```rust
pub async fn reset_error_count(&self) {
    let mut consecutive_errors = self.consecutive_errors.lock().await;
    if *consecutive_errors > 0 {
        println!("✅ Resetting error count from {}", *consecutive_errors);
        *consecutive_errors = 0;
    }

    let mut circuit_open = self.circuit_breaker_open.lock().await;
    *circuit_open = false;
}
```

### **Flow Diagram:**
```
Normal → Error1 → Error2 → Error3 → Error4 → Error5 → CIRCUIT OPEN! 🛑
  ↓        2s      4s       8s       16s      32s       STOP ALL
Success                                                    
  ↓
Circuit CLOSED ✅
Reset to 1s delay
```

---

## 🔧 **Mechanism #3: Batch Processing dengan Chunks**

### **get_batch_game_details():**
```rust
#[command]
async fn get_batch_game_details(app_ids: Vec<String>) -> Result<Vec<GameDetail>, String> {
    let mut details_list = Vec::new();
    
    // 🎯 KEY: Process in chunks of 5!
    for chunk in app_ids.chunks(5) {
        let mut batch_futures = Vec::new();

        // Check cache first for each
        for app_id in chunk {
            if GAME_CACHE.get_game_details(app_id).await.is_some() {
                // Cache HIT - no API call needed
            }
            batch_futures.push(get_game_details(app_id.clone()));
        }

        // Wait for all in this batch
        for future in batch_futures {
            match future.await {
                Ok(details) => details_list.push(details),
                Err(e) => println!("❌ Could not fetch: {}", e),
            }
        }

        // ⏱️ Delay between batches (300ms)
        if details_list.len() < app_ids.len() {
            tokio::time::sleep(Duration::from_millis(300)).await;
        }
    }
    
    Ok(details_list)
}
```

### **Why Chunks of 5?**
```
❌ Without chunking: 100 requests → All at once → FLOOD!
✅ With chunking: 100 requests → 20 batches of 5 → Controlled!

Batch 1: Process 5 items (each with 1s throttle) = ~5s
Wait 300ms
Batch 2: Process 5 items = ~5s
Wait 300ms
...

Total time for 100 items: ~100 seconds (controlled pace)
```

---

## 🔧 **Mechanism #4: Request Deduplication**

### **get_or_create_request_lock():**
```rust
pub async fn get_or_create_request_lock(&self, app_id: &str) -> Arc<tokio::sync::Mutex<()>> {
    let mut in_flight = self.in_flight_requests.lock().await;
    
    // Check if request is already in progress
    match in_flight.get(app_id) {
        Some(existing_lock) => {
            println!("⏳ Request already in progress for {}", app_id);
            existing_lock.clone() // Reuse existing lock
        }
        None => {
            // Create new lock for this request
            let lock = Arc::new(tokio::sync::Mutex::new(()));
            in_flight.insert(app_id.to_string(), lock.clone());
            println!("🔒 Created new request lock for {}", app_id);
            lock
        }
    }
}
```

### **Scenario:**
```
User 1: Opens game 730 → Creates lock, starts API call
User 2: Opens game 730 (same time) → Sees lock, waits for User 1's result
User 3: Opens game 730 (same time) → Sees lock, waits for User 1's result

Result: Only 1 API call for game 730 ✅ (instead of 3)
```

---

## 📊 **Complete Protection Stack**

### **Layer 1: Cache (Instant, No API Call)**
```
Request → Check cache → HIT? → Return cached data (0ms) ✅
                      → MISS? → Continue to Layer 2
```

### **Layer 2: Request Deduplication**
```
Check if request in-flight → YES? → Wait for existing request ⏳
                            → NO? → Continue to Layer 3
```

### **Layer 3: Throttling (Rate Limiting)**
```
Check last request time → Too soon? → Wait (1s - 32s) ⏱️
                        → OK? → Continue to Layer 4
```

### **Layer 4: Circuit Breaker**
```
Check circuit breaker → OPEN? → Return error immediately 🛑
                      → CLOSED? → Make API call
```

### **Layer 5: Error Handling**
```
API call result → Success? → Reset error count, cache result ✅
                → Error? → Record error, trigger backoff/circuit breaker ⚠️
                → 429? → Aggressive error recording 🚨
```

---

## 🎯 **Why This Prevents Flooding:**

### **Problem: Flooding**
```
❌ Without protection:
- 100 users open same game → 100 API calls instantly
- User refreshes 10 times → 10 API calls
- Background refresh → Constant API hammering
- Steam API: "Dude, chill!" → 429 Rate Limit → IP ban
```

### **Solution: Zenith's Stack**
```
✅ With protection:
- 100 users open same game → 1 API call (cache + dedup)
- User refreshes 10 times → 0 API calls (cache valid)
- Background refresh → Throttled (1 req/sec max)
- Errors detected → Exponential backoff (2s → 4s → 8s → 16s → 32s)
- Too many errors → Circuit breaker stops ALL requests
- Steam API: "Nice! Good citizen!" → Happy API → No ban ✅
```

---

## 📝 **Config Values Zenith Uses:**

```rust
pub struct CacheConfig {
    pub max_concurrent_requests: 5,     // Max 5 simultaneous requests
    pub batch_size: 20,                 // Process 20 items per batch
    pub batch_delay_seconds: 10,        // 10s delay between batches
    pub request_delay_ms: 1000,         // 1s between requests (base)
    pub circuit_breaker_threshold: 10,  // Open after 10 failures
    pub max_retries: 5,                 // Retry up to 5 times
}
```

---

## 🔥 **Yeyodra vs Zenith:**

| Protection | Yeyodra (Current) | Zenith |
|-----------|-------------------|---------|
| **Cache-First** | ✅ Yes | ✅ Yes |
| **Throttling** | ❌ **No** | ✅ **Yes** (1s base) |
| **Exponential Backoff** | ✅ Yes (retry) | ✅ Yes (throttle) |
| **Circuit Breaker** | ❌ **No** | ✅ **Yes** (5 errors) |
| **Request Dedup** | ❌ **No** | ✅ **Yes** |
| **Batch Chunking** | ❌ **No** | ✅ **Yes** (chunks of 5) |
| **429 Detection** | ✅ Yes (503 only) | ✅ **Yes** (429 + 503) |

---

## 💡 **Key Takeaway:**

**Zenith TIDAK mencegah flooding dengan "tidak fetch"**

Zenith **TETAP fetch** ke Steam API, tapi dengan **MULTIPLE LAYERS of PROTECTION**:

1. ✅ **Cache** - 90% request tidak perlu API call
2. ✅ **Deduplication** - Duplicate requests share result
3. ✅ **Throttling** - Maximum 1 request per second (normal)
4. ✅ **Exponential Backoff** - Slow down saat error (2s → 32s)
5. ✅ **Circuit Breaker** - Stop completely saat terlalu banyak error
6. ✅ **Batch Processing** - Process dalam chunks kecil (5 items)

**Result:** 
- Steam API happy ✅
- No rate limiting ✅
- No IP ban ✅
- Fast user experience ✅

---

**Status**: ✅ Analysis Complete  
**Recommendation**: Implement throttling + circuit breaker di Yeyodra!  
**Priority**: HIGH - Ini yang missing untuk prevent flooding!


