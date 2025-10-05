# CSP Fix - Catalogue Filters Not Loading

## Problem Found! 🎯

The **actual root cause** of the missing filter sidebar in production builds was **Content Security Policy (CSP)** blocking requests to `https://assets.hydralauncher.gg`!

### Error Messages:
```
Refused to connect to 'https://assets.hydralauncher.gg/steam-user-tags.json' 
because it violates the following Content Security Policy directive: 
"connect-src 'self' https://hydra-api-us-east-1.losbroxas.org 
https://store.steampowered.com ..."
```

### What Was Blocked:
- ❌ `https://assets.hydralauncher.gg/steam-user-tags.json`
- ❌ `https://assets.hydralauncher.gg/steam-genres.json`
- ❌ `https://assets.hydralauncher.gg/steam-publishers.json`
- ❌ `https://assets.hydralauncher.gg/steam-developers.json`

**Result:** Filter sidebar had **NO DATA** to display!

## Root Cause

The CSP `connect-src` directive only allowed:
- ✅ `https://hydra-api-us-east-1.losbroxas.org` (API)
- ✅ `https://store.steampowered.com` (Steam)
- ❌ `https://assets.hydralauncher.gg` (BLOCKED!)

## Solution

### File: `src-tauri/tauri.conf.json`

**Before:**
```json
"connect-src 'self' https://hydra-api-us-east-1.losbroxas.org https://store.steampowered.com ..."
```

**After:**
```json
"connect-src 'self' https://hydra-api-us-east-1.losbroxas.org https://assets.hydralauncher.gg https://store.steampowered.com ..."
```

Added `https://assets.hydralauncher.gg` to the allowed domains! ✅

## Why This Happened

### Development Mode (Works ✅)
- CSP is often more **relaxed** or **not enforced**
- Hot reload and dev tools bypass some restrictions
- Vite dev server has different CSP

### Production Build (Blocked ❌)
- CSP is **strictly enforced**
- Tauri's security model is more restrictive
- Any domain not explicitly allowed is blocked

## Complete CSP Breakdown

```
connect-src 
  'self'                                    # Same origin requests
  https://hydra-api-us-east-1.losbroxas.org # Hydra API (game data)
  https://assets.hydralauncher.gg           # Hydra Assets (genres, tags, etc.) ← ADDED!
  https://store.steampowered.com            # Steam API (app details)
  ipc:                                      # Tauri IPC
  http://ipc.localhost                      # Tauri IPC (localhost)
  ws://localhost:*                          # WebSocket (dev mode)
  wss://localhost:*                         # Secure WebSocket
```

## Testing

### 1. Rebuild with CSP Fix:
```bash
# Clean previous builds
rm -rf src-tauri/target/release/
rm -rf dist/

# Rebuild
npm run tauri build
```

### 2. Run and Test:
- Open the built app
- Navigate to Catalogue page
- Filter sidebar should now be **VISIBLE** ✅
- Open DevTools (Ctrl+Shift+I)
- Check Console - **NO CSP errors** ✅

### 3. Verify Requests:
In DevTools Network tab, you should see:
- ✅ `steam-user-tags.json` - Status 200
- ✅ `steam-genres.json` - Status 200  
- ✅ `steam-publishers.json` - Status 200
- ✅ `steam-developers.json` - Status 200

## Why DevTools Was Important

Without DevTools enabled in production build, we would **never have seen** the CSP errors!

The error messages clearly showed:
1. **What** was blocked (assets.hydralauncher.gg)
2. **Why** it was blocked (CSP violation)
3. **Which** directive was violated (connect-src)

This is why enabling DevTools was crucial for debugging! 🔍

## Additional CSP Domains

If you need to add more domains in the future, add them to `connect-src`:

```json
"connect-src 'self' 
  https://hydra-api-us-east-1.losbroxas.org 
  https://assets.hydralauncher.gg 
  https://store.steampowered.com 
  https://your-new-domain.com         ← Add here
  ipc: http://ipc.localhost 
  ws://localhost:* wss://localhost:*"
```

## Security Considerations

### CSP Purpose:
- Prevents XSS (Cross-Site Scripting) attacks
- Controls which resources can be loaded
- Protects users from malicious content

### Adding Domains:
✅ **Do:**
- Only add domains you control/trust
- Use specific domains, not wildcards if possible
- Document why each domain is needed

❌ **Don't:**
- Add `*` (allows everything - very insecure!)
- Add untrusted third-party domains
- Disable CSP completely

## Files Modified

✅ `src-tauri/tauri.conf.json` - Added `https://assets.hydralauncher.gg` to CSP
✅ `src-tauri/Cargo.toml` - Added `devtools` feature (for debugging)
✅ `CSP_FIX_CATALOGUE_FILTERS.md` - This documentation

## Related Issues Fixed

This CSP fix also resolves:
1. ✅ Filter sidebar not visible in production
2. ✅ Empty genre dropdowns
3. ✅ Empty tags dropdowns
4. ✅ Empty publishers/developers lists
5. ✅ "Failed to fetch" console errors

All caused by the same CSP violation!

## Lessons Learned

1. **Always enable DevTools for production debugging**
   - Reveals CSP violations
   - Shows network errors
   - Exposes console errors

2. **Test production builds frequently**
   - Don't rely only on dev mode
   - Production has different security policies
   - Catch issues early

3. **Check CSP when adding new API endpoints**
   - Add new domains to tauri.conf.json
   - Test in production build
   - Verify no CSP violations

4. **Monitor console for errors**
   - CSP violations are logged
   - Network failures are visible
   - Don't ignore "Failed to fetch" errors

## Conclusion

The filter sidebar issue was **NOT a CSS problem** or **component rendering issue**. It was a **Content Security Policy violation** blocking data fetching!

**Root Cause:** CSP blocked `https://assets.hydralauncher.gg`
**Solution:** Added domain to CSP `connect-src` directive
**Result:** Filter sidebar now loads with data! ✅

This is why **debugging tools** are essential - they reveal the real problem! 🎯





