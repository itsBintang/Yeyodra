# Analisis Fundamental Ludasavi di Hydra

**Tanggal:** 6 Oktober 2025  
**Status:** 🔍 CRITICAL ROOT CAUSE FOUND

## 🎯 ROOT CAUSE DISCOVERY

### Masalah Utama
Cloud save di Chaos **GAGAL mendeteksi save games** karena kita pass **Steam App ID** ("413150") ke Ludusavi, padahal Ludusavi CLI **MEMBUTUHKAN GAME TITLE** ("Stardew Valley").

### Bukti Testing

#### ✅ Test Sukses dengan Game Title:
```bash
PS> cd "C:\Users\Nazril\Documents\ProjekV2\Chaos\ludusavi"
PS> .\ludusavi.exe backup "Stardew Valley" --preview --api

{
  "overall": {
    "totalGames": 1,
    "totalBytes": 3116130,
    "processedGames": 1,
    "processedBytes": 3116130,
    "changedGames": {
      "new": 1,
      "different": 0,
      "same": 0
    }
  },
  "games": {
    "Stardew Valley": {
      "decision": "Processed",
      "change": "New",
      "files": {
        "C:/Users/Nazril/AppData/Roaming/StardewValley/Saves/...": {
          "change": "New",
          "bytes": 3073797
        },
        ...
      }
    }
  }
}
```

#### ❌ Test Gagal dengan Steam App ID:
```bash
PS> .\ludusavi.exe backup "413150" --preview --api

{
  "errors": {
    "unknownGames": [
      "413150"
    ]
  },
  "overall": {
    "totalGames": 0,
    "totalBytes": 0,
    "processedGames": 0,
    "processedBytes": 0,
    "changedGames": {
      "new": 0,
      "different": 0,
      "same": 0
    }
  },
  "games": {}
}
No info for these games:
  - 413150
```

### Struktur Ludusavi Manifest

Ludusavi memiliki database manifest yang berisi mapping game dengan struktur:

```json
{
  "Stardew Valley": {           // ← GAME TITLE sebagai KEY
    "files": { ... },
    "installDir": {"Stardew Valley": {}},
    "steam": {"id": 413150},    // ← Steam App ID sebagai METADATA
    "gog": {"id": 1453375253},
    "cloud": {"gog": true, "steam": true}
  }
}
```

**Key Insight:**
- Game **TITLE** adalah **PRIMARY KEY** dalam Ludusavi database
- Steam App **ID** hanya sebagai **METADATA** untuk lookup instalasi
- Ludusavi CLI menerima parameter `[GAMES]...` yang berupa **GAME TITLES**, bukan IDs

---

## 📊 Analisis Hydra Implementation

### 1. Hydra's Ludusavi Service (`src/main/services/ludusavi.ts`)

```typescript
export class Ludusavi {
  private static ludusaviResourcesPath = app.isPackaged
    ? path.join(process.resourcesPath, "ludusavi")
    : path.join(__dirname, "..", "..", "ludusavi");

  private static configPath = path.join(
    SystemPath.getPath("userData"),
    "ludusavi"
  );
  
  private static binaryName =
    process.platform === "win32" ? "ludusavi.exe" : "ludusavi";
  
  private static binaryPath = path.join(this.configPath, this.binaryName);

  // CRITICAL: Hydra pass objectId ke ludusavi
  public static async backupGame(
    _shop: GameShop,
    objectId: string,          // ← Parameter ini!
    backupPath?: string | null,
    winePrefix?: string | null,
    preview?: boolean
  ): Promise<LudusaviBackup> {
    return new Promise((resolve, reject) => {
      const args = [
        "--config",
        this.configPath,
        "backup",
        objectId,              // ← Ini di-pass ke ludusavi!
        "--api",
        "--force",
      ];

      if (preview) args.push("--preview");
      if (backupPath) args.push("--path", backupPath);
      if (winePrefix) args.push("--wine-prefix", winePrefix);

      cp.execFile(
        this.binaryPath,
        args,
        (err: cp.ExecFileException | null, stdout: string) => {
          if (err) {
            return reject(err);
          }
          return resolve(JSON.parse(stdout) as LudusaviBackup);
        }
      );
    });
  }
}
```

### 2. Hydra's Cloud Sync Service (`src/main/services/cloud-sync.ts`)

```typescript
export class CloudSync {
  private static async bundleBackup(
    shop: GameShop,
    objectId: string,
    winePrefix: string | null
  ) {
    const backupPath = path.join(backupsPath, `${shop}-${objectId}`);

    // Remove existing backup
    if (fs.existsSync(backupPath)) {
      try {
        await fs.promises.rm(backupPath, { recursive: true });
      } catch (error) {
        logger.error("Failed to remove backup path", error);
      }
    }

    // CRITICAL: Pass objectId to ludusavi
    await Ludusavi.backupGame(shop, objectId, backupPath, winePrefix);

    const tarLocation = path.join(backupsPath, `${crypto.randomUUID()}.tar`);

    await tar.create(
      {
        gzip: false,
        file: tarLocation,
        cwd: backupPath,
      },
      ["."]
    );

    return tarLocation;
  }

  public static async uploadSaveGame(
    objectId: string,
    shop: GameShop,
    downloadOptionTitle: string | null,
    label?: string
  ) {
    // ... subscription check ...

    // Retrieve game from database
    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));

    const bundleLocation = await this.bundleBackup(
      shop,
      objectId,           // ← Still pass objectId!
      game?.winePrefixPath ?? null
    );

    // ... upload logic ...
  }
}
```

### 3. Hydra's Game Type (`src/types/level.types.ts`)

```typescript
export interface Game {
  title: string;                    // ← Game title STORED in database
  iconUrl: string | null;
  libraryHeroImageUrl: string | null;
  logoImageUrl: string | null;
  customIconUrl?: string | null;
  customLogoImageUrl?: string | null;
  customHeroImageUrl?: string | null;
  originalIconPath?: string | null;
  originalLogoPath?: string | null;
  originalHeroPath?: string | null;
  shop: GameShop;
  objectId: string;
  downloadPath: string | null;
  winePrefixPath?: string | null;
  ...
}
```

**CRITICAL FINDING:**
Hydra **STORES game title** in the `Game` object in their database! Tapi mereka **TETAP PASS objectId** ke ludusavi. **KENAPA INI BISA BERHASIL DI HYDRA?**

---

## 🤔 Hipotesis: Kenapa Hydra Berhasil?

### Kemungkinan 1: Hydra Menggunakan Custom Game Mapping
Hydra mungkin **add custom game ke ludusavi config** dengan objectId sebagai name:

```yaml
customGames:
  - name: "413150"              # Steam App ID sebagai name
    files:
      - "C:/path/to/saves"
    registry: []
```

Tapi ini **TIDAK MASUK AKAL** karena:
1. Manifest Ludusavi sudah punya mapping Stardew Valley
2. Tidak ada kode di Hydra yang melakukan ini secara otomatis untuk semua games

### Kemungkinan 2: Hydra Menggunakan Manifest yang Support Steam ID Lookup
Ludusavi manifest mungkin support **lookup by Steam ID**. Mari saya test:

```bash
PS> .\ludusavi.exe backup "413150" --preview --api
# Result: ERROR - unknownGames: ["413150"]
```

**TERBUKTI SALAH** - Ludusavi tidak support lookup by Steam ID directly.

### Kemungkinan 3: **HYDRA SEBENARNYA PASS GAME TITLE!** ⚠️

Mari saya re-check implementasi Hydra lebih detail. Ada kemungkinan:
1. Hydra menggunakan `game.title` dari database, **BUKAN objectId**
2. Atau ada layer mapping yang saya miss

**PERLU VERIFIKASI LEBIH LANJUT** - Check bagaimana Hydra sebenarnya call ludusavi dengan parameter apa.

---

## 🔧 Solusi untuk Chaos

Berdasarkan analisis fundamental ini, ada **2 pendekatan** yang bisa digunakan:

### Pendekatan 1: Pass Game Title ke Ludusavi (RECOMMENDED) ✅

**Implementasi:**
1. Rust backend harus menerima `game_title` sebagai parameter **SELAIN** `object_id`
2. Pass `game_title` ke ludusavi CLI, bukan `object_id`
3. Frontend pass `game.title` dari `LibraryGame` interface

**Keuntungan:**
- ✅ Sesuai dengan cara kerja ludusavi yang native
- ✅ Langsung support semua games di ludusavi manifest (~20,000+ games)
- ✅ Tidak perlu maintain custom game mapping

**Kekurangan:**
- ⚠️ Perlu update semua Tauri command signatures
- ⚠️ Perlu update frontend untuk pass title

### Pendekatan 2: Add Custom Game Mapping (NOT RECOMMENDED) ❌

**Implementasi:**
1. Untuk setiap game, add custom game ke ludusavi config:
   ```yaml
   customGames:
     - name: "413150"
       files: ["<path>"]
   ```

**Keuntungan:**
- ✅ Tetap bisa pass `object_id` dari frontend

**Kekurangan:**
- ❌ Harus maintain mapping untuk SEMUA games
- ❌ Save path harus di-detect manual
- ❌ Tidak leverage ludusavi manifest database
- ❌ Kompleks dan error-prone

---

## 📝 Action Plan

### Step 1: Update Rust Backend Signatures
Update all Tauri commands untuk menerima `game_title`:

```rust
#[tauri::command]
pub async fn get_game_backup_preview(
    object_id: String,
    shop: String,
    game_title: String,          // ← ADD THIS
    wine_prefix_path: Option<String>,
    app_handle: AppHandle,
) -> Result<LudusaviBackup, String> {
    let ludasavi = Ludasavi::new(app_handle);
    
    ludasavi
        .get_backup_preview(&game_title, wine_prefix_path.as_deref())  // ← Use game_title
        .await
        .map_err(|e| e.to_string())
}
```

### Step 2: Update Rust Ludasavi Service
Update `ludasavi.rs` untuk gunakan game title:

```rust
impl Ludasavi {
    pub async fn backup_game(
        &self,
        game_title: &str,        // ← Change from object_id
        backup_path: Option<&str>,
        wine_prefix: Option<&str>,
        preview: bool,
    ) -> Result<LudusaviBackup> {
        let mut args = vec![
            "--config",
            &self.get_config_path()?.to_string_lossy(),
            "backup",
            game_title,              // ← Use game_title
            "--api",
            "--force",
        ];
        // ... rest of implementation
    }
}
```

### Step 3: Update Frontend Context
Update `cloud-sync.tsx` untuk pass game title:

```typescript
const getBackupPreview = async () => {
  if (!gameContext.game) return;
  
  setLoading(true);
  try {
    const preview = await window.electron.getGameBackupPreview(
      gameContext.game.objectId,
      gameContext.game.shop,
      gameContext.game.title,              // ← ADD THIS
      winePrefix
    );
    setBackupPreview(preview);
  } catch (error) {
    console.error("[CloudSync] Failed to get backup preview:", error);
  } finally {
    setLoading(false);
  }
};
```

### Step 4: Update All Other Commands
Apply same pattern to:
- `upload_save_game`
- `download_game_artifact`  
- `select_game_backup_path`

---

## 🎯 Conclusion

**ROOT CAUSE:** Kita pass Steam App ID (`object_id`) ke ludusavi, padahal ludusavi membutuhkan **game title**.

**SOLUTION:** Update backend dan frontend untuk pass `game.title` ke ludusavi, bukan `object_id`.

**NEXT STEPS:**
1. Verifikasi apakah `LibraryGame` interface di Chaos sudah menyimpan `title`
2. Implement perubahan di backend (Rust)
3. Implement perubahan di frontend (TypeScript)
4. Test dengan Stardew Valley
5. Document dalam checkpoint MD

---

**CATATAN PENTING:** Sebelum implementasi, saya perlu **VERIFY** apakah Hydra memang benar-benar pass objectId atau sebenarnya ada mapping yang saya miss. Mari saya check satu kali lagi dengan lebih teliti.


