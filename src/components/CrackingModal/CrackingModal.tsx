import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { XIcon } from "@primer/octicons-react";
import "./CrackingModal.scss";

interface CrackingModalProps {
  visible: boolean;
  onClose: () => void;
  appId: string;
  gameName: string;
  gameLogoUrl?: string;
}

interface CrackProgress {
  progress: number;
  message: string;
}

export function CrackingModal({
  visible,
  onClose,
  appId,
  gameName,
  gameLogoUrl,
}: CrackingModalProps) {
  const [gamePath, setGamePath] = useState<string>("");
  const [isCracking, setIsCracking] = useState(false);
  const [progress, setProgress] = useState<CrackProgress>({ progress: 0, message: "" });
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Listen for progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<CrackProgress>("crack-progress", (event) => {
        setProgress(event.payload);
      });
    };

    if (visible) {
      setupListener();
    }

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [visible]);

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Game Installation Folder",
      });

      if (selected && typeof selected === "string") {
        setGamePath(selected);
      }
    } catch (err) {
      console.error("Failed to browse folder:", err);
    }
  };

  const handleCrack = async () => {
    if (!gamePath) {
      setError("Please select game installation folder");
      return;
    }

    setIsCracking(true);
    setError("");
    setResult("");
    setProgress({ progress: 0, message: "Starting..." });

    try {
      await invoke<string>("cmd_apply_crack", {
        gameLocation: gamePath,
        appId: appId,
        language: "english",
      });

      setResult("Success!");
      setProgress({ progress: 100, message: "Completed!" });
    } catch (err) {
      console.error("Crack failed:", err);
      setError(`${err}`);
      setProgress({ progress: 0, message: "" });
    } finally {
      setIsCracking(false);
    }
  };

  const handleClose = () => {
    if (!isCracking) {
      setGamePath("");
      setResult("");
      setError("");
      setProgress({ progress: 0, message: "" });
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <div className="cracking-modal-overlay">
      <div className="cracking-modal">
        {/* Header */}
        <div className="cracking-modal-header">
          <h2 className="cracking-modal-title">Game Cracking</h2>
          <button onClick={handleClose} className="cracking-close-btn" disabled={isCracking}>
            <XIcon size={24} />
          </button>
        </div>

        {/* Game Info Section */}
        <div className="cracking-game-info">
          <div className="cracking-game-header">
            {gameLogoUrl && (
              <img src={gameLogoUrl} alt={gameName} className="cracking-game-logo" />
            )}
            <h3 className="cracking-game-name">{gameName}</h3>
          </div>
        </div>

        {/* Unlock Method */}
        <div className="cracking-unlock-method">
          <h4 className="cracking-section-title">Unlock Method</h4>
          <div className="cracking-method-tabs">
            <button className="cracking-method-tab active">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Goldberg
            </button>
          </div>
          <p className="cracking-method-description">
            Remove Steam DRM and emulate Steam API for offline play
          </p>
        </div>

        {/* Content */}
        <div className="cracking-modal-content">
          {/* Game Installation Folder */}
          <div className="cracking-folder-section">
            <label className="cracking-folder-label">Game Installation Folder</label>
            <div className="cracking-folder-input-group">
              <input
                type="text"
                className="cracking-folder-input"
                value={gamePath}
                onChange={(e) => setGamePath(e.target.value)}
                placeholder="Select game installation folder..."
                disabled={isCracking}
              />
              <button
                type="button"
                className="cracking-browse-button"
                onClick={handleBrowseFolder}
                disabled={isCracking}
              >
                📁 Browse
              </button>
            </div>
            <p className="cracking-folder-hint">
              Select the folder where the game is installed (contains .exe files)
            </p>
          </div>

          {/* Progress Bar */}
          {progress.progress > 0 && (
            <div className="cracking-progress-section">
              <div className="cracking-progress-bar-container">
                <div
                  className="cracking-progress-bar"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="cracking-progress-text">
                {progress.message} ({progress.progress}%)
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="cracking-error-box">
              <span className="cracking-error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {/* Success Message */}
          {result && (
            <div className="cracking-success-box">
              <span className="cracking-success-icon">✅</span>
              <p>Game cracked successfully! Original files backed up with .svrn extension.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="cracking-actions">
            <button
              type="button"
              className="cracking-action-btn cracking-action-btn--secondary"
              onClick={handleClose}
              disabled={isCracking}
            >
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                type="button"
                className="cracking-action-btn cracking-action-btn--primary"
                onClick={handleCrack}
                disabled={isCracking || !gamePath}
              >
                {isCracking ? "🔄 Cracking..." : "Start Crack"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

