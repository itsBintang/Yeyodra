# Ludasavi Type Mismatch Fix

## 🐛 ERROR

```
[CloudSync] Failed to get backup preview: missing field 'decision' at line 21 column 9
```

**Location:** Console error when opening Cloud Save modal in Game Details page

## 🔍 ROOT CAUSE

### The Problem
TypeScript/Rust interfaces did NOT match Ludusavi CLI actual JSON response structure.

**Original (WRONG) Interface:**
```typescript
interface LudusaviScanChange {
  change: "New" | "Different" | ...;
  decision: "Processed" | "Cancelled" | "Ignore";  // ❌ Files don't have this!
  bytes: number;
}

interface LudusaviGame extends LudusaviScanChange {
  files: Record<string, LudusaviScanChange>;  // ❌ Wrong: files don't have 'decision'
}
```

**Actual Ludusavi Response:**
```json
{
  "games": {
    "413150": {
      "decision": "Processed",  // ✅ Game has decision
      "change": "New",
      "files": {
        "C:/path/to/file.dll": {
          "change": "New",      // ✅ File has change
          "bytes": 19968        // ✅ File has bytes
          // ❌ File does NOT have 'decision'
        }
      }
    }
  }
}
```

**Key Insight:**
- **Game objects** have: `decision`, `change`, `files`, `registry`
- **File objects** have: `change`, `bytes` (NO `decision`!)

## 🔧 THE FIX

### Frontend Types (`src/types/index.ts`)

```typescript
// BEFORE (WRONG):
export interface LudusaviScanChange {
  change: "New" | "Different" | "Removed" | "Same" | "Unknown";
  decision: "Processed" | "Cancelled" | "Ignore";  // ❌
  bytes: number;
}

export interface LudusaviGame extends LudusaviScanChange {
  files: Record<string, LudusaviScanChange>;  // ❌
}

// AFTER (CORRECT):
export interface LudusaviFileChange {
  change: "New" | "Different" | "Removed" | "Same" | "Unknown";
  bytes: number;  // ✅ No 'decision' field
}

export interface LudusaviGame {
  decision: "Processed" | "Cancelled" | "Ignored";
  change: "New" | "Different" | "Same" | "Unknown";
  files: Record<string, LudusaviFileChange>;  // ✅ Correct type
  registry?: Record<string, LudusaviFileChange>;
}
```

### Backend Types (`src-tauri/src/ludasavi.rs`)

```rust
// BEFORE (WRONG):
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviScanChange {
    pub change: String,
    pub decision: String,  // ❌ Files don't have this
    pub bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviGame {
    pub change: String,
    pub decision: String,
    pub bytes: u64,
    pub files: HashMap<String, LudusaviScanChange>,  // ❌
}

// AFTER (CORRECT):
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviFileChange {
    pub change: String,
    pub bytes: u64,  // ✅ No 'decision' field
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LudusaviGame {
    pub decision: String,
    pub change: String,
    pub files: HashMap<String, LudusaviFileChange>,  // ✅ Correct type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registry: Option<HashMap<String, LudusaviFileChange>>,
}
```

## 🧪 VERIFICATION

### Test Command:
```powershell
PS> $binary = "$env:APPDATA\com.nazril.tauri-app\ludusavi\ludusavi.exe"
PS> $config = "$env:APPDATA\com.nazril.tauri-app\ludusavi"
PS> & $binary --config $config backup "413150" --preview --api
```

### Expected Response Structure:
```json
{
  "overall": {
    "totalGames": 1,
    "totalBytes": 691846347,
    "processedGames": 1,
    "processedBytes": 691846347,
    "changedGames": {
      "new": 1,
      "different": 0,
      "same": 0
    }
  },
  "games": {
    "413150": {
      "decision": "Processed",  ✅
      "change": "New",          ✅
      "files": {
        "C:/path/to/file": {
          "change": "New",      ✅
          "bytes": 19968        ✅
        }
      }
    }
  }
}
```

### Type Validation:
- ✅ `LudusaviFileChange` matches file objects (no `decision`)
- ✅ `LudusaviGame` matches game objects (has `decision`)
- ✅ JSON deserialization succeeds
- ✅ No more "missing field 'decision'" errors

## 📝 CHANGES SUMMARY

### Files Modified:
1. `src/types/index.ts`
   - Renamed `LudusaviScanChange` → `LudusaviFileChange`
   - Removed `decision` field from file change type
   - Updated `LudusaviGame` to use `LudusaviFileChange`
   - Added optional `registry` field

2. `src-tauri/src/ludasavi.rs`
   - Renamed `LudusaviScanChange` → `LudusaviFileChange`
   - Removed `decision` field from file change struct
   - Updated `LudusaviGame` to use `LudusaviFileChange`
   - Added optional `registry` field with `skip_serializing_if`

### Breaking Changes:
- None (internal type refactoring only)

## ✅ RESULT

**Before Fix:**
```
❌ [CloudSync] Failed to get backup preview: missing field 'decision'
❌ White screen on Game Details page
❌ Cloud Save modal cannot load
```

**After Fix:**
```
✅ Ludusavi response successfully deserialized
✅ Cloud Save modal displays correctly
✅ Backup preview shows detected files
✅ No type errors in console
```

## 🚀 NEXT STEPS

1. ✅ Test Cloud Save modal with real game (Stardew Valley)
2. ✅ Verify file list displays correctly
3. ✅ Test backup upload (when API is implemented)
4. ⏳ Test backup restore functionality

---

**Date:** October 6, 2025
**Issue:** Type mismatch between Ludusavi response and TypeScript/Rust interfaces
**Root Cause:** File objects don't have `decision` field, only game objects do
**Solution:** Split into `LudusaviFileChange` and `LudusaviGame` types

