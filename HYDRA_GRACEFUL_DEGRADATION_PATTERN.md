# Hydra Graceful Degradation Pattern - Game Details Page Tetap Berfungsi Saat Rate Limit

## 🎯 **FUNDAMENTAL DISCOVERY**

Ketika kamu kena rate limit dari Steam API, **Hydra page game detail TETAP BERFUNGSI** dengan normal! Ini karena Hydra menggunakan pattern **Graceful Degradation** (degradasi yang anggun).

---

## 📊 **Bagaimana Hydra Handle Rate Limit?**

### **1. Promise.all() Pattern - Tidak Saling Bergantung**

```typescript
// src/renderer/src/context/game-details/game-details.context.tsx
// Line 124-173

const shopDetailsPromise = window.electron
  .getGameShopDetails(objectId, shop, getSteamLanguage(i18n.language))
  .then((result) => {
    if (abortController.signal.aborted) return;
    
    setShopDetails(result);  // ✅ Set data kalau berhasil
    
    if (result?.content_descriptors.ids.includes(
      SteamContentDescriptor.AdultOnlySexualContent
    ) && !userPreferences?.disableNsfwAlert) {
      setHasNSFWContentBlocked(true);
    }
    
    if (result?.assets) {
      setIsLoading(false);
    }
  });
  // ❌ TIDAK ADA .catch() - Error diabaikan!

const statsPromise = window.electron
  .getGameStats(objectId, shop)
  .then((result) => {
    if (abortController.signal.aborted) return null;
    setStats(result);  // ✅ Set stats kalau berhasil
    return result;
  });
  // ❌ TIDAK ADA .catch() - Error diabaikan!

Promise.all([shopDetailsPromise, statsPromise])
  .then(([_, stats]) => {
    // Merge stats.assets into shopDetails if available
    if (stats) {
      const assets = stats.assets;
      if (assets) {
        window.electron.saveGameShopAssets(objectId, shop, assets);
        
        setShopDetails((prev) => {
          if (!prev) return null;  // ⚠️ Kalau shopDetails gagal, return null
          return {
            ...prev,
            assets,  // Merge assets from Hydra API
          };
        });
      }
    }
  })
  .finally(() => {
    if (abortController.signal.aborted) return;
    setIsLoading(false);  // ✅ Loading SELALU selesai, error atau tidak!
  });
```

### **KEY INSIGHT:**
```
❌ Yeyodra Pattern (OLD):
  Steam API fail → throw error → Whole page shows error

✅ Hydra Pattern (GRACEFUL):
  Steam API fail → SILENT → Page tetap render → Gunakan data yang ada
```

---

## 🔧 **2. Conditional Rendering - Fallback Strategy**

### **Di `game-details-content.tsx`:**

```typescript
// Line 35-79: aboutTheGame dengan multiple fallback

const aboutTheGame = useMemo(() => {
  const aboutTheGame = shopDetails?.about_the_game;  // Try Steam API data
  
  if (aboutTheGame) {
    // Parse and sanitize HTML
    const document = new DOMParser().parseFromString(aboutTheGame, "text/html");
    // ... image/video processing
    return document.body.outerHTML;
  }
  
  // ✅ FALLBACK 1: Custom game, show empty
  if (game?.shop === "custom") {
    return "";
  }
  
  // ✅ FALLBACK 2: Show generic message
  return t("no_shop_details");  // "Could not retrieve shop details."
}, [shopDetails, t, game?.shop]);
```

### **Images dengan Priority Fallback:**

```typescript
// Line 117-138: Custom asset priority

const getImageWithCustomPriority = (
  customUrl: string | null | undefined,
  originalUrl: string | null | undefined,
  fallbackUrl?: string | null | undefined
) => {
  return customUrl || originalUrl || fallbackUrl || "";
};

const heroImage = isCustomGame
  ? game?.libraryHeroImageUrl || game?.iconUrl || ""  // Custom game fallback
  : getImageWithCustomPriority(
      game?.customHeroImageUrl,      // Priority 1: Custom uploaded
      shopDetails?.assets?.libraryHeroImageUrl  // Priority 2: From API
    );

const logoImage = isCustomGame
  ? game?.logoImageUrl || ""
  : getImageWithCustomPriority(
      game?.customLogoImageUrl,
      shopDetails?.assets?.logoImageUrl
    );
```

---

## 🎨 **3. Multi-Source Data Strategy**

### **Hierarchy of Data Sources:**

```
Priority 1: Library Game Data (LOCAL)
  ↓ (if not available)
Priority 2: Stats from Hydra API (stats.assets)
  ↓ (if not available)
Priority 3: Steam API Data (shopDetails)
  ↓ (if not available)
Priority 4: Fallback/Default Values
```

### **Example - Hero Image:**

```typescript
// Full priority chain:
const heroImage = 
  game?.customHeroImageUrl ||                      // 1. User uploaded (LOCAL)
  stats?.assets?.libraryHeroImageUrl ||            // 2. Hydra API (WORKING!)
  shopDetails?.assets?.libraryHeroImageUrl ||      // 3. Steam API (RATE LIMITED ❌)
  game?.libraryHeroImageUrl ||                     // 4. Library fallback
  "";                                               // 5. Empty fallback
```

### **Key Insight:**
```
✅ Hydra API (stats.assets) TIDAK kena rate limit Steam!
✅ Ini data dari database Hydra sendiri
✅ Jadi walaupun Steam API down, assets tetap load!
```

---

## 🛡️ **4. Silent Error Handling**

### **Pattern di seluruh Hydra:**

```typescript
// ❌ TIDAK ADA INI:
.catch((error) => {
  throw error;  // Nope!
  setError(error);  // Nope!
  console.error(error);  // Maybe, but not blocking
});

// ✅ YANG ADA:
.then((result) => {
  if (result) {
    // Use data if available
    setShopDetails(result);
  }
  // No else - just ignore if failed
})
.finally(() => {
  setIsLoading(false);  // Always end loading
});
```

---

## 📋 **Complete Flow Diagram:**

```
User Opens Game Details Page
    ↓
[Loading State = true]
    ↓
Parallel Requests:
├─ Steam API (shopDetails)
│   ├─ Success? → setShopDetails(data) ✅
│   └─ Fail? → SILENT (no error thrown) 🔇
│
└─ Hydra API (stats)
    ├─ Success? → setStats(data) ✅
    └─ Fail? → SILENT (no error thrown) 🔇
    ↓
[Loading State = false]  ← ALWAYS executed
    ↓
Render Page with Available Data:
├─ shopDetails available? → Use full data ✅
├─ Only stats available? → Use stats.assets ✅
├─ Only library game? → Use library data ✅
└─ Nothing available? → Show "Could not retrieve shop details" ℹ️
    ↓
Page is FUNCTIONAL! ✅
User can still:
  - See library game info
  - Add to library
  - Open download options
  - See achievements (if synced locally)
  - Browse repacks
```

---

## 🔥 **Kenapa Ini Lebih Baik dari Yeyodra (Sekarang)?**

### **Yeyodra Pattern (Current):**

```typescript
// src/contexts/game-details.tsx

const fetchShopDetails = useCallback(async () => {
  if (shop === "custom") return;
  
  try {
    const details = await invoke<ShopDetails>(
      "get_game_shop_details",
      { objectId, language: "english" }
    );
    
    setShopDetails({ ...details, objectId });
  } catch (error) {
    console.error("Failed to fetch shop details:", error);
    // ⚠️ shopDetails tetap null
    // ⚠️ Page mungkin error atau loading forever
  }
}, [objectId, shop]);
```

### **Problem:**
```
1. ❌ Kalau Steam API fail → shopDetails = null
2. ❌ UI component mungkin expect shopDetails → crash/error
3. ❌ User lihat "Failed to load game details"
4. ❌ Padahal data lain (stats, library) mungkin tersedia!
```

---

## ✅ **Hydra Pattern (Graceful Degradation):**

```typescript
const shopDetailsPromise = window.electron
  .getGameShopDetails(objectId, shop, getSteamLanguage(i18n.language))
  .then((result) => {
    if (abortController.signal.aborted) return;
    setShopDetails(result);
    // ... other handling
  });
  // NO .catch() - errors are silent!

// UI always checks for null/undefined:
const aboutTheGame = useMemo(() => {
  const aboutTheGame = shopDetails?.about_the_game;  // ✅ Optional chaining
  
  if (aboutTheGame) {
    return processedHTML;
  }
  
  // ✅ Graceful fallback
  return t("no_shop_details");
}, [shopDetails, t, game?.shop]);
```

### **Benefits:**
```
1. ✅ Steam API fail → SILENT → No error thrown
2. ✅ Page tetap render dengan data yang ada
3. ✅ User lihat "Could not retrieve shop details" (bukan error page)
4. ✅ Semua fungsi lain TETAP BEKERJA!
5. ✅ User bisa add to library, download, dll
```

---

## 🎯 **Implementation Plan untuk Yeyodra:**

### **Step 1: Silent Error Handling**

```typescript
// src/contexts/game-details.tsx

const fetchShopDetails = useCallback(async () => {
  if (shop === "custom") return;
  
  try {
    const details = await invoke<ShopDetails>(
      "get_game_shop_details",
      { objectId, language: "english" }
    );
    
    setShopDetails({ ...details, objectId });
  } catch (error) {
    // ✅ HYDRA PATTERN: Silent + informative log
    const errorMsg = String(error);
    if (errorMsg.includes("429")) {
      console.warn("⚠️ Rate limited by Steam API. Page will work with limited data.");
    } else if (errorMsg.includes("503")) {
      console.warn("⚠️ Steam API temporarily unavailable. Page will work with limited data.");
    } else if (errorMsg.includes("Circuit breaker")) {
      console.warn("⚠️ Circuit breaker open. Page will work with cached/limited data.");
    }
    
    // ✅ Don't throw, don't block - just log
    // shopDetails stays null, but page continues
  }
}, [objectId, shop]);
```

### **Step 2: Always End Loading**

```typescript
useEffect(() => {
  const fetchData = async () => {
    setIsLoading(true);
    
    // Parallel fetch (don't await each one)
    const promises = [
      fetchShopDetails(),    // May fail silently
      fetchStats(),          // May fail silently
      fetchAchievements(),   // May fail silently
    ];
    
    // Wait for all (even if some fail)
    await Promise.allSettled(promises);
    
    // ✅ ALWAYS end loading
    setIsLoading(false);
  };
  
  fetchData();
}, [objectId, shop]);
```

### **Step 3: Conditional Rendering dengan Fallbacks**

```typescript
// src/pages/GameDetails/GameDetails.tsx

// ❌ OLD (breaks on error):
if (!shopDetails) {
  return <ErrorPage />;
}

// ✅ NEW (graceful degradation):
const gameDescription = shopDetails?.detailed_description || 
                        game?.description || 
                        "Could not retrieve shop details.";

const heroImage = shopDetails?.header_image || 
                  stats?.assets?.libraryHeroImageUrl ||
                  game?.libraryHeroImageUrl ||
                  defaultImage;
```

---

## 🎨 **UI Messaging Strategy:**

### **Hydra Approach:**

```typescript
// Di bagian description:
{shopDetails?.about_the_game ? (
  <div dangerouslySetInnerHTML={{ __html: processedHTML }} />
) : (
  <p className="game-details__no-data">
    {t("no_shop_details")}  // "Could not retrieve shop details."
  </p>
)}

// Di bagian screenshots:
{shopDetails?.screenshots && shopDetails.screenshots.length > 0 ? (
  <GallerySlider screenshots={shopDetails.screenshots} />
) : (
  <div className="game-details__no-screenshots">
    {/* Just hide or show placeholder - no error */}
  </div>
)}
```

### **Key Principle:**
```
❌ Don't show:  "ERROR: Failed to load!"
✅ Show instead: "Could not retrieve shop details" (calm, informative)

❌ Don't block:  Entire page
✅ Block only:   Specific section yang butuh data itu
```

---

## 🏆 **Summary:**

| Aspect | Yeyodra (Current) | Hydra (Graceful) |
|--------|-------------------|------------------|
| **Error Handling** | Throw/Log → Block | Silent → Continue |
| **Loading State** | May hang | Always ends |
| **Data Sources** | Single (Steam API) | Multi (Stats, Library, Steam) |
| **Fallback Strategy** | None | Multi-level fallbacks |
| **User Experience** | Error page | Degraded but functional |
| **Rate Limit Impact** | Page breaks | Only missing photos/details |
| **Functionality** | Blocked | Still works (add, download, etc) |

---

## 💡 **Key Takeaway:**

**Hydra TIDAK mencegah rate limit**  
**Hydra membuat page TETAP BERFUNGSI walaupun kena rate limit**

Ini adalah **Graceful Degradation** pattern:
1. ✅ Try best case (fetch all data)
2. ✅ If fail, use what's available
3. ✅ Never block user completely
4. ✅ Show informative (not alarming) messages
5. ✅ Keep core functionality working

**Result:**  
- User kena rate limit? → "Could not retrieve shop details"
- Tapi masih bisa:
  - ✅ Lihat game dari library
  - ✅ Add to library
  - ✅ Download repacks
  - ✅ See achievements (local)
  - ✅ Browse screenshots dari Hydra API (bukan Steam!)

---

**Status**: ✅ Analysis Complete  
**Next Step**: Implement graceful degradation pattern di Yeyodra  
**Priority**: HIGH - Ini yang bikin UX Hydra jauh lebih baik!


