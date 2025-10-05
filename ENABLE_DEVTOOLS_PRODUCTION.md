# Enable DevTools in Production Build - Tauri v2

## Overview
By default, DevTools is only available in development mode (`npm run tauri dev`). To debug issues in production builds, you need to explicitly enable the `devtools` feature.

## Implementation

### 1. Enable DevTools Feature

**File: `src-tauri/Cargo.toml`**

Add `"devtools"` to the Tauri features array:

```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset", "devtools"] }
```

### 2. Rebuild the Application

```bash
# Clean previous builds (recommended)
rm -rf src-tauri/target/release/
rm -rf dist/

# Build with DevTools enabled
npm run tauri build
```

### 3. Access DevTools in Production Build

Once the build is complete and the app is running:

**Windows & Linux:**
- Press `Ctrl + Shift + I`
- Or right-click → "Inspect Element"

**macOS:**
- Press `Command + Option + I`
- Or right-click → "Inspect Element"

## Use Cases

### Debug CSS Issues
1. Open DevTools
2. Go to Elements tab
3. Inspect `.catalogue__filters-container`
4. Check computed styles
5. Verify display, visibility, opacity values

### Debug Component Rendering
1. Open DevTools Console
2. Check for JavaScript errors
3. Use React DevTools (if installed)
4. Check component tree

### Debug Network Requests
1. Open DevTools Network tab
2. Check API calls
3. Verify response data
4. Check for failed requests

### Debug Performance
1. Open DevTools Performance tab
2. Record page load
3. Check for bottlenecks
4. Analyze render times

## Important Notes

⚠️ **Security Warning:**
- DevTools exposes internal app structure
- Can be used to inspect sensitive data
- Can be used to modify app behavior

⚠️ **macOS App Store:**
- DevTools uses private APIs on macOS
- Apps with DevTools enabled may be **rejected from App Store**
- Only use for debugging, disable before App Store submission

⚠️ **Performance:**
- DevTools adds overhead to the bundle
- Slightly larger app size (~1-2MB)
- Minimal runtime performance impact

## Disable DevTools for Release

Before releasing to production or App Store:

**File: `src-tauri/Cargo.toml`**

Remove `"devtools"` from features:

```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
# "devtools" removed
```

Then rebuild:
```bash
npm run tauri build
```

## Conditional DevTools (Advanced)

If you want DevTools only in specific build configurations:

**File: `src-tauri/Cargo.toml`**

```toml
[features]
default = []
debug-build = ["tauri/devtools"]

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
```

Then build with:
```bash
# With DevTools
cargo build --release --features debug-build

# Without DevTools (production)
cargo build --release
```

## Debugging Catalogue Filter Issue

With DevTools enabled, you can now:

1. **Check if element exists:**
   ```javascript
   document.querySelector('.catalogue__filters-container')
   ```

2. **Check computed styles:**
   ```javascript
   const el = document.querySelector('.catalogue__filters-container');
   window.getComputedStyle(el).display; // Should be "flex"
   window.getComputedStyle(el).visibility; // Should be "visible"
   ```

3. **Check if FilterSection renders:**
   - Open React DevTools
   - Find FilterSection components
   - Check props and state

4. **Check console for errors:**
   - Look for import errors
   - Look for rendering errors
   - Look for API errors

## Alternative: Remote Debugging

If you can't enable DevTools in the build, use remote debugging:

### Chrome Remote Debugging
```bash
# Run app with remote debugging
npm run tauri dev -- --remote-debugging-port=9222
```

Then open in Chrome:
```
chrome://inspect
```

### VSCode Debugging
Add to `.vscode/launch.json`:
```json
{
  "type": "chrome",
  "request": "attach",
  "name": "Attach to Tauri",
  "port": 9222,
  "webRoot": "${workspaceFolder}/src"
}
```

## Files Modified

✅ `src-tauri/Cargo.toml` - Added `devtools` feature
✅ `ENABLE_DEVTOOLS_PRODUCTION.md` - This documentation

## Next Steps

1. Rebuild the app with DevTools enabled
2. Run the production build
3. Open DevTools (Ctrl+Shift+I / Cmd+Opt+I)
4. Inspect the Catalogue page
5. Debug the filter sidebar issue
6. Once fixed, remove `devtools` feature for final release

## Resources

- [Tauri v2 Debug Documentation](https://tauri.app/develop/debug/)
- [Tauri Features Documentation](https://tauri.app/reference/config/)
- [Chrome DevTools Guide](https://developer.chrome.com/docs/devtools/)



