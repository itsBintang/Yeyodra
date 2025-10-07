use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Cache entry with timestamp for TTL validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedItem<T> {
    pub data: T,
    pub cached_at: i64, // Unix timestamp
}

impl<T> CachedItem<T> {
    pub fn new(data: T) -> Self {
        Self {
            data,
            cached_at: Utc::now().timestamp(),
        }
    }

    /// Check if cache is still valid (default: 24 hours)
    pub fn is_valid(&self, ttl_seconds: i64) -> bool {
        let now = Utc::now().timestamp();
        let age = now - self.cached_at;
        age < ttl_seconds
    }

    /// Check if cache is valid with default TTL (24 hours)
    pub fn is_valid_default(&self) -> bool {
        self.is_valid(86400) // 24 hours
    }
}

/// Rate limiting configuration (following Zenith's pattern)
#[derive(Clone)]
pub struct RateLimitConfig {
    pub request_delay_ms: u64,        // Base delay between requests (1000ms = 1 req/sec)
    pub circuit_breaker_threshold: u32, // Open circuit after N consecutive errors
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            request_delay_ms: 1000,      // 1 second between requests
            circuit_breaker_threshold: 5, // Open after 5 consecutive errors
        }
    }
}

/// Cache manager for game shop details
/// Following Hydra's pattern with LevelDB-like structure but using JSON files
/// NOW with Zenith's rate limiting + circuit breaker!
pub struct GameShopCache {
    cache_dir: PathBuf,
    // Rate limiting state (from Zenith)
    last_request_time: Arc<Mutex<u64>>,
    consecutive_errors: Arc<Mutex<u32>>,
    circuit_breaker_open: Arc<Mutex<bool>>,
    // Request deduplication (from Zenith)
    in_flight_requests: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
    config: RateLimitConfig,
}

impl GameShopCache {
    /// Create new cache instance with rate limiting
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self> {
        let cache_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow!("Failed to get app data directory: {}", e))?
            .join("cache")
            .join("shop_details");

        fs::create_dir_all(&cache_dir)?;

        Ok(Self {
            cache_dir,
            last_request_time: Arc::new(Mutex::new(0)),
            consecutive_errors: Arc::new(Mutex::new(0)),
            circuit_breaker_open: Arc::new(Mutex::new(false)),
            in_flight_requests: Arc::new(Mutex::new(HashMap::new())),
            config: RateLimitConfig::default(),
        })
    }

    /// Generate cache key similar to Hydra's levelKeys
    fn get_cache_key(&self, shop: &str, object_id: &str, language: &str) -> String {
        format!("{}:{}:{}", shop, object_id, language)
    }

    /// Get cache file path
    fn get_cache_path(&self, shop: &str, object_id: &str, language: &str) -> PathBuf {
        let key = self.get_cache_key(shop, object_id, language);
        // Use safe filename (replace : with _)
        let filename = key.replace(':', "_");
        self.cache_dir.join(format!("{}.json", filename))
    }

    /// Get cached data (similar to gamesShopCacheSublevel.get)
    pub fn get<T>(&self, shop: &str, object_id: &str, language: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let cache_path = self.get_cache_path(shop, object_id, language);

        if !cache_path.exists() {
            return Err(anyhow!("Cache not found"));
        }

        let content = fs::read_to_string(&cache_path)?;
        let cached_item: CachedItem<T> = serde_json::from_str(&content)?;

        // Validate TTL
        if !cached_item.is_valid_default() {
            // Cache expired, remove it
            let _ = fs::remove_file(&cache_path);
            return Err(anyhow!("Cache expired"));
        }

        Ok(cached_item.data)
    }

    /// Put data into cache (similar to gamesShopCacheSublevel.put)
    pub fn put<T>(&self, shop: &str, object_id: &str, language: &str, data: T) -> Result<()>
    where
        T: Serialize,
    {
        let cache_path = self.get_cache_path(shop, object_id, language);
        let cached_item = CachedItem::new(data);
        let json = serde_json::to_string_pretty(&cached_item)?;
        fs::write(cache_path, json)?;
        Ok(())
    }

    /// Delete cache entry
    pub fn delete(&self, shop: &str, object_id: &str, language: &str) -> Result<()> {
        let cache_path = self.get_cache_path(shop, object_id, language);
        if cache_path.exists() {
            fs::remove_file(cache_path)?;
        }
        Ok(())
    }

    /// Clear all cache
    pub fn clear_all(&self) -> Result<()> {
        if self.cache_dir.exists() {
            fs::remove_dir_all(&self.cache_dir)?;
            fs::create_dir_all(&self.cache_dir)?;
        }
        Ok(())
    }

    /// Get cache stats
    pub fn get_stats(&self) -> Result<CacheStats> {
        let mut total_files = 0;
        let mut total_size = 0u64;

        if self.cache_dir.exists() {
            for entry in fs::read_dir(&self.cache_dir)? {
                let entry = entry?;
                if entry.path().is_file() {
                    total_files += 1;
                    if let Ok(metadata) = entry.metadata() {
                        total_size += metadata.len();
                    }
                }
            }
        }

        Ok(CacheStats {
            total_entries: total_files,
            total_size_bytes: total_size,
        })
    }

    // ============= ZENITH PATTERN: RATE LIMITING =============

    /// Throttle requests to avoid rate limiting (from Zenith)
    /// Implements exponential backoff based on consecutive errors
    pub async fn throttle_request(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let (delay, error_count) = {
            let mut last_request = self.last_request_time.lock().await;
            let consecutive_errors = self.consecutive_errors.lock().await;
            let error_count = *consecutive_errors;

            let time_since_last = if *last_request > now || *last_request == 0 {
                0
            } else {
                now - *last_request
            };

            // Exponential backoff based on errors: 2^errors
            let base_delay = self.config.request_delay_ms;
            let backoff_multiplier = 2_u64.pow(error_count.min(5));
            let required_delay = base_delay * backoff_multiplier;

            if time_since_last < required_delay {
                let delay = required_delay.saturating_sub(time_since_last);
                *last_request = now + delay;
                (Some(delay), error_count)
            } else {
                *last_request = now;
                (None, error_count)
            }
        };

        if let Some(delay_ms) = delay {
            // Only log significant throttling (> 2 seconds = errors detected)
            if delay_ms > 2000 {
                println!("[RateLimit] ⏱️ Throttling: {}ms delay (errors: {})", delay_ms, error_count);
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }
    }

    /// Record API error for circuit breaker (from Zenith)
    pub async fn record_error(&self) {
        let mut consecutive_errors = self.consecutive_errors.lock().await;
        *consecutive_errors += 1;

        println!("[RateLimit] ⚠️ API error recorded. Consecutive errors: {}", *consecutive_errors);

        // Open circuit breaker if too many errors
        if *consecutive_errors >= self.config.circuit_breaker_threshold {
            let mut circuit_open = self.circuit_breaker_open.lock().await;
            *circuit_open = true;
            println!("[RateLimit] 🔴 Circuit breaker OPENED - Stopping API calls!");
        }
    }

    /// Reset error count on successful request (from Zenith)
    pub async fn reset_error_count(&self) {
        let mut consecutive_errors = self.consecutive_errors.lock().await;
        if *consecutive_errors > 0 {
            println!("[RateLimit] ✅ Resetting error count from {}", *consecutive_errors);
            *consecutive_errors = 0;
        }

        let mut circuit_open = self.circuit_breaker_open.lock().await;
        *circuit_open = false;
    }

    /// Check if circuit breaker is open (from Zenith)
    pub async fn is_circuit_breaker_open(&self) -> bool {
        *self.circuit_breaker_open.lock().await
    }

    /// Get or create request lock to prevent duplicate API calls (from Zenith)
    pub async fn get_or_create_request_lock(&self, cache_key: &str) -> Arc<Mutex<()>> {
        let mut in_flight = self.in_flight_requests.lock().await;
        
        match in_flight.get(cache_key) {
            Some(existing_lock) => {
                // Only log duplicate requests (interesting!)
                println!("[RateLimit] ⏳ Duplicate request detected for {}", cache_key);
                existing_lock.clone()
            }
            None => {
                let lock = Arc::new(Mutex::new(()));
                in_flight.insert(cache_key.to_string(), lock.clone());
                // Don't log normal lock creation - too spammy
                lock
            }
        }
    }

    /// Remove request lock after completion (from Zenith)
    pub async fn remove_request_lock(&self, cache_key: &str) {
        let mut in_flight = self.in_flight_requests.lock().await;
        in_flight.remove(cache_key);
        // Don't log lock removal - too spammy
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_entries: usize,
    pub total_size_bytes: u64,
}

/// Cache manager for game stats from Hydra API
/// NOW with Zenith's rate limiting + circuit breaker!
pub struct GameStatsCache {
    cache_dir: PathBuf,
    // Rate limiting state (from Zenith)
    last_request_time: Arc<Mutex<u64>>,
    consecutive_errors: Arc<Mutex<u32>>,
    circuit_breaker_open: Arc<Mutex<bool>>,
    // Request deduplication (from Zenith)
    in_flight_requests: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
    config: RateLimitConfig,
}

impl GameStatsCache {
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self> {
        let cache_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow!("Failed to get app data directory: {}", e))?
            .join("cache")
            .join("game_stats");

        fs::create_dir_all(&cache_dir)?;

        Ok(Self {
            cache_dir,
            last_request_time: Arc::new(Mutex::new(0)),
            consecutive_errors: Arc::new(Mutex::new(0)),
            circuit_breaker_open: Arc::new(Mutex::new(false)),
            in_flight_requests: Arc::new(Mutex::new(HashMap::new())),
            config: RateLimitConfig::default(),
        })
    }

    fn get_cache_path(&self, shop: &str, object_id: &str) -> PathBuf {
        let filename = format!("{}_{}.json", shop, object_id);
        self.cache_dir.join(filename)
    }

    pub fn get<T>(&self, shop: &str, object_id: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let cache_path = self.get_cache_path(shop, object_id);

        if !cache_path.exists() {
            return Err(anyhow!("Cache not found"));
        }

        let content = fs::read_to_string(&cache_path)?;
        let cached_item: CachedItem<T> = serde_json::from_str(&content)?;

        // Stats cache: shorter TTL (12 hours)
        if !cached_item.is_valid(43200) {
            let _ = fs::remove_file(&cache_path);
            return Err(anyhow!("Cache expired"));
        }

        Ok(cached_item.data)
    }

    pub fn put<T>(&self, shop: &str, object_id: &str, data: T) -> Result<()>
    where
        T: Serialize,
    {
        let cache_path = self.get_cache_path(shop, object_id);
        let cached_item = CachedItem::new(data);
        let json = serde_json::to_string_pretty(&cached_item)?;
        fs::write(cache_path, json)?;
        Ok(())
    }

    pub fn delete(&self, shop: &str, object_id: &str) -> Result<()> {
        let cache_path = self.get_cache_path(shop, object_id);
        if cache_path.exists() {
            fs::remove_file(cache_path)?;
        }
        Ok(())
    }

    pub fn clear_all(&self) -> Result<()> {
        if self.cache_dir.exists() {
            fs::remove_dir_all(&self.cache_dir)?;
            fs::create_dir_all(&self.cache_dir)?;
        }
        Ok(())
    }

    // ============= ZENITH PATTERN: RATE LIMITING (Same as GameShopCache) =============

    /// Throttle requests to avoid rate limiting (from Zenith)
    pub async fn throttle_request(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let delay = {
            let mut last_request = self.last_request_time.lock().await;
            let consecutive_errors = self.consecutive_errors.lock().await;

            let time_since_last = if *last_request > now || *last_request == 0 {
                0
            } else {
                now - *last_request
            };

            let base_delay = self.config.request_delay_ms;
            let backoff_multiplier = 2_u64.pow((*consecutive_errors).min(5));
            let required_delay = base_delay * backoff_multiplier;

            if time_since_last < required_delay {
                let delay = required_delay.saturating_sub(time_since_last);
                *last_request = now + delay;
                Some(delay)
            } else {
                *last_request = now;
                None
            }
        };

        if let Some(delay_ms) = delay {
            if delay_ms > 500 {
                println!("[RateLimit] ⏱️ Throttling: waiting {}ms before next request", delay_ms);
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }
    }

    /// Record API error for circuit breaker (from Zenith)
    pub async fn record_error(&self) {
        let mut consecutive_errors = self.consecutive_errors.lock().await;
        *consecutive_errors += 1;

        println!("[RateLimit] ⚠️ API error recorded. Consecutive errors: {}", *consecutive_errors);

        if *consecutive_errors >= self.config.circuit_breaker_threshold {
            let mut circuit_open = self.circuit_breaker_open.lock().await;
            *circuit_open = true;
            println!("[RateLimit] 🔴 Circuit breaker OPENED - Stopping API calls!");
        }
    }

    /// Reset error count on successful request (from Zenith)
    pub async fn reset_error_count(&self) {
        let mut consecutive_errors = self.consecutive_errors.lock().await;
        if *consecutive_errors > 0 {
            println!("[RateLimit] ✅ Resetting error count from {}", *consecutive_errors);
            *consecutive_errors = 0;
        }

        let mut circuit_open = self.circuit_breaker_open.lock().await;
        *circuit_open = false;
    }

    /// Check if circuit breaker is open (from Zenith)
    pub async fn is_circuit_breaker_open(&self) -> bool {
        *self.circuit_breaker_open.lock().await
    }

    /// Get or create request lock (from Zenith)
    pub async fn get_or_create_request_lock(&self, cache_key: &str) -> Arc<Mutex<()>> {
        let mut in_flight = self.in_flight_requests.lock().await;
        
        match in_flight.get(cache_key) {
            Some(existing_lock) => {
                println!("[RateLimit] ⏳ Request already in progress for {}", cache_key);
                existing_lock.clone()
            }
            None => {
                let lock = Arc::new(Mutex::new(()));
                in_flight.insert(cache_key.to_string(), lock.clone());
                println!("[RateLimit] 🔒 Created new request lock for {}", cache_key);
                lock
            }
        }
    }

    /// Remove request lock after completion (from Zenith)
    pub async fn remove_request_lock(&self, cache_key: &str) {
        let mut in_flight = self.in_flight_requests.lock().await;
        let removed = in_flight.remove(cache_key);
        
        if removed.is_some() {
            println!("[RateLimit] 🔓 Removed request lock for {}", cache_key);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cached_item_validation() {
        let item = CachedItem::new("test data".to_string());
        assert!(item.is_valid(3600)); // Valid for 1 hour
        
        // Test with expired timestamp
        let expired_item = CachedItem {
            data: "test".to_string(),
            cached_at: Utc::now().timestamp() - 90000, // 25 hours ago
        };
        assert!(!expired_item.is_valid_default()); // Should be expired
    }
}

