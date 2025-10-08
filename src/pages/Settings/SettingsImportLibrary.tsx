import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components";
import { useToast } from "@/hooks";
import { useLibrary } from "@/hooks/useLibrary";
import "./SettingsImportLibrary.scss";

interface ScannedGame {
  app_id: string;
  title: string;
  install_path: string | null;
  is_already_in_library: boolean;
}

interface ScanResult {
  games: ScannedGame[];
  total_found: number;
  already_in_library: number;
}

export function SettingsImportLibrary() {
  const { showSuccessToast, showErrorToast } = useToast();
  const { updateLibrary } = useLibrary();
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());

  const handleScan = async (onlyFetchNew = false) => {
    setIsScanning(true);
    
    if (!onlyFetchNew) {
      setScanResult(null);
      setSelectedGames(new Set());
    }

    try {
      // Step 1: Scan folder for App IDs
      const result = await invoke<ScanResult>("scan_steam_library_folder");
      
      // Step 2: Only fetch names for NEW games (not already in library)
      const newGames = result.games.filter((g) => !g.is_already_in_library);
      const alreadyInLibraryGames = result.games.filter((g) => g.is_already_in_library);
      
      if (newGames.length > 0) {
        showSuccessToast(
          `Found ${newGames.length} new games, fetching names...`
        );

        // Fetch names only for new games
        const newAppIds = newGames.map((g) => g.app_id);
        const gameNames = await invoke<Array<[string, string]>>("fetch_game_names", {
          appIds: newAppIds,
        });

        // Update only new games with real names
        const nameMap = new Map(gameNames);
        const updatedNewGames = newGames.map((game) => ({
          ...game,
          title: nameMap.get(game.app_id) || game.title,
        }));

        // Combine: updated new games + already in library games (keep placeholder names)
        const allGames = [...updatedNewGames, ...alreadyInLibraryGames];

        const updatedResult = {
          ...result,
          games: allGames,
        };

        setScanResult(updatedResult);

        // Auto-select new games
        const newGameIds = updatedNewGames.map((g) => g.app_id);
        setSelectedGames(new Set(newGameIds));

        showSuccessToast(
          `Found ${result.total_found} games (${newGames.length} new, ${result.already_in_library} already in library)`
        );
      } else {
        // No new games, just show the result
        setScanResult(result);
        showSuccessToast(
          `All ${result.total_found} games are already in your library!`
        );
      }
    } catch (error) {
      console.error("Scan failed:", error);
      showErrorToast(`Scan failed: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleImport = async () => {
    if (!scanResult || selectedGames.size === 0) return;

    setIsImporting(true);

    try {
      // Get selected games data
      const gamesToImport = scanResult.games.filter((g) =>
        selectedGames.has(g.app_id)
      );

      const importedCount = await invoke<number>("import_scanned_games", {
        games: gamesToImport,
      });

      // Refresh library in Redux store (auto-updates all library views!)
      await updateLibrary();

      showSuccessToast(
        `Successfully imported ${importedCount} games! Check "My Library" 🎮`
      );

      // Just re-scan without fetching names again (lightweight refresh)
      const result = await invoke<ScanResult>("scan_steam_library_folder");
      setScanResult(result);
      setSelectedGames(new Set()); // Clear selection
    } catch (error) {
      console.error("Import failed:", error);
      showErrorToast(`Import failed: ${error}`);
    } finally {
      setIsImporting(false);
    }
  };

  const toggleGame = (appId: string) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(appId)) {
      newSelected.delete(appId);
    } else {
      newSelected.add(appId);
    }
    setSelectedGames(newSelected);
  };

  const selectAll = () => {
    if (!scanResult) return;
    const notInLibrary = scanResult.games
      .filter((g) => !g.is_already_in_library)
      .map((g) => g.app_id);
    setSelectedGames(new Set(notInLibrary));
  };

  const deselectAll = () => {
    setSelectedGames(new Set());
  };

  return (
    <div className="settings-import-library">
      <div className="settings-import-library__header">
        <p className="settings-import-library__description">
          Scan your SteamTools folder to automatically import installed games to
          your library.
        </p>
        <p className="settings-import-library__path">
          Scan path:{" "}
          <code>C:\Program Files (x86)\Steam\config\stplug-in</code>
        </p>
      </div>

      <div className="settings-import-library__actions">
        <Button
          onClick={() => handleScan(false)}
          disabled={isScanning || isImporting}
          theme="primary"
        >
          {isScanning ? "Scanning..." : "Scan SteamTools Folder"}
        </Button>

        {scanResult && scanResult.games.length > 0 && (
          <>
            <Button onClick={selectAll} disabled={isImporting} theme="outline">
              Select All New
            </Button>
            <Button onClick={deselectAll} disabled={isImporting} theme="outline">
              Deselect All
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || selectedGames.size === 0}
              theme="primary"
            >
              {isImporting
                ? "Importing..."
                : `Import Selected (${selectedGames.size})`}
            </Button>
          </>
        )}
      </div>

      {scanResult && (
        <div className="settings-import-library__results">
          <div className="settings-import-library__stats">
            <div className="settings-import-library__stats-item">
              <label>Found</label>
              <strong>{scanResult.total_found}</strong>
            </div>
            <div className="settings-import-library__stats-item">
              <label>New Games</label>
              <strong>{scanResult.total_found - scanResult.already_in_library}</strong>
            </div>
            <div className="settings-import-library__stats-item">
              <label>Already in Library</label>
              <strong>{scanResult.already_in_library}</strong>
            </div>
          </div>

          <div className="settings-import-library__game-list">
            {scanResult.games.map((game) => (
              <div
                key={game.app_id}
                className={`game-item ${
                  game.is_already_in_library ? "game-item--in-library" : ""
                } ${selectedGames.has(game.app_id) ? "game-item--selected" : ""}`}
                onClick={() => !game.is_already_in_library && toggleGame(game.app_id)}
              >
                <input
                  type="checkbox"
                  checked={selectedGames.has(game.app_id)}
                  disabled={game.is_already_in_library}
                  onChange={() => {}}
                />
                <div className="game-item__info">
                  <span className="game-item__title">{game.title}</span>
                  <span className="game-item__app-id">AppID: {game.app_id}</span>
                </div>
                {game.is_already_in_library && (
                  <span className="game-item__badge">Already in Library</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {scanResult && scanResult.games.length === 0 && (
        <div className="settings-import-library__empty">
          <p>No games found in SteamTools folder.</p>
          <p>Make sure you have downloaded games using SteamTools.</p>
        </div>
      )}
    </div>
  );
}

