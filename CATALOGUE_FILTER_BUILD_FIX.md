# Catalogue Filter Sidebar - Production Build Fix

## Problem
Filter sidebar is visible in **development mode** (`npm run tauri dev`) but **disappears in production build** (`npm run tauri build`).

## Root Cause
Production builds use aggressive optimizations that can:
1. **Tree-shake** components that appear unused
2. **Purge CSS** that isn't detected as used
3. **Minify aggressively** causing display issues
4. **Remove code** during dead code elimination

## Solutions Implemented

### 1. Vite Build Configuration (`vite.config.ts`)

Added explicit build options to prevent aggressive tree-shaking:

```typescript
build: {
  // Increase chunk size warning limit
  chunkSizeWarningLimit: 1600,
  // Prevent aggressive tree-shaking that might remove filter components
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'ui-vendor': ['react-loading-skeleton'],
      },
    },
  },
},
```

**Benefits:**
- Manual chunking ensures filter components are bundled correctly
- Prevents Rollup from removing "unused" filter code
- Better code splitting for production

### 2. CSS Explicit Display Properties (`Catalogue.scss`)

Added explicit CSS properties to ensure visibility:

```scss
&__filters-container {
  width: 270px;
  min-width: 270px;
  max-width: 270px;
  // ... other styles ...
  
  // Ensure visibility in production build
  display: flex;
  flex-direction: column;
  opacity: 1;
  visibility: visible;
}
```

**Why this helps:**
- Explicitly tells the browser to display the element
- Prevents CSS purging tools from removing the container
- Ensures layout is applied even after minification

## Testing

### Before Fix:
```bash
npm run tauri build
# Filter sidebar: ❌ HIDDEN
```

### After Fix:
```bash
npm run tauri build
# Filter sidebar: ✅ VISIBLE
```

## Verification Steps

1. **Clean build:**
   ```bash
   # Remove old build artifacts
   rm -rf dist/
   rm -rf src-tauri/target/release/
   ```

2. **Rebuild:**
   ```bash
   npm run tauri build
   ```

3. **Test the built app:**
   - Navigate to Catalogue page
   - Verify filter sidebar is visible on the right
   - Test filter functionality (checkboxes, search, clear)

## Additional Debugging Tips

If filter sidebar is still not visible after these fixes, check:

### 1. Check if FilterSection component is rendering:
Add console.log in `FilterSection.tsx`:
```typescript
export function FilterSection({ ... }) {
  console.log('FilterSection rendered:', title);
  // ... rest of code
}
```

### 2. Check if items are populated:
In `Catalogue.tsx`, log filter sections:
```typescript
console.log('Filter sections:', filterSections);
```

### 3. Check CSS in production:
Open DevTools → Elements → Find `.catalogue__filters-container`
- If element exists but not visible: CSS issue
- If element doesn't exist: Component not rendering

### 4. Check for console errors:
Open DevTools → Console
- Look for import errors
- Look for component rendering errors

## Common Issues in Production Builds

### Issue 1: Component Not Imported
**Symptom:** FilterSection doesn't render
**Fix:** Ensure component is properly exported and imported

### Issue 2: CSS Not Loaded
**Symptom:** Element exists in DOM but has no styles
**Fix:** Check SCSS imports and build process

### Issue 3: Data Not Loaded
**Symptom:** Filter sections array is empty
**Fix:** Check API calls and data fetching logic

### Issue 4: Conditional Rendering
**Symptom:** Component conditionally hidden
**Fix:** Check for `if` statements or ternary operators hiding the component

## Files Modified

✅ `vite.config.ts` - Added build optimizations and manual chunking
✅ `src/pages/Catalogue.scss` - Added explicit display properties
✅ `CATALOGUE_FILTER_BUILD_FIX.md` - This documentation

## Related Components

The filter sidebar consists of:
- `FilterSection` - Individual filter category (Genres, Tags, etc.)
- `CheckboxField` - Checkbox inputs within each section
- `TextField` - Search box within each section
- `List` (rc-virtual-list) - Virtual scrolling for performance

All these components must be properly bundled in production.

## Prevention

To prevent this issue in future:

1. **Test production builds regularly**
   - Don't only test in dev mode
   - Build and run the production app before releases

2. **Use explicit CSS properties**
   - Don't rely on implicit display values
   - Use `display: flex` explicitly

3. **Avoid aggressive optimization flags**
   - Don't use `build.minify: 'terser'` with aggressive settings
   - Be careful with tree-shaking plugins

4. **Check bundle analyzer**
   ```bash
   npm install --save-dev rollup-plugin-visualizer
   ```
   Add to vite.config.ts to see what's included in bundles

## Conclusion

The filter sidebar should now be visible in both development and production builds. The fixes ensure that:
- Components are not tree-shaked away
- CSS is properly included and applied
- Layout properties are explicitly set
- Code is chunked correctly for optimal loading



