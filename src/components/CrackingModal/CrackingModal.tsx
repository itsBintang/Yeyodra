import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Modal } from "../Modal/Modal";
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
  const [isSetupComplete, setIsSetupComplete] = useState(true); // Assume ready by default

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
      // Check if setup is complete
      const isReady = await invoke<boolean>("cmd_check_cracker_ready");
      
      if (!isReady) {
        setProgress({ progress: 0, message: "Setting up cracker dependencies..." });
        await invoke("cmd_setup_cracker");
      }

      const crackResult = await invoke<string>("cmd_apply_crack", {
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

  return (
    <Modal visible={visible} onClose={handleClose}>
      <div className="cracking-modal">
        <div className="cracking-modal__header">
          {gameLogoUrl && (
            <img
              src={gameLogoUrl}
              alt={gameName}
              className="cracking-modal__game-logo"
            />
          )}
          <div className="cracking-modal__title-container">
            <h2 className="cracking-modal__title">Game Cracking</h2>
            <p className="cracking-modal__subtitle">{gameName}</p>
          </div>
        </div>

        <div className="cracking-modal__content">
          <div className="cracking-modal__section">
            <label className="cracking-modal__label">
              Game Installation Folder
            </label>
            <div className="cracking-modal__path-input-group">
              <input
                type="text"
                className="cracking-modal__path-input"
                value={gamePath}
                onChange={(e) => setGamePath(e.target.value)}
                placeholder="Select game installation folder..."
                disabled={isCracking}
              />
              <button
                type="button"
                className="cracking-modal__browse-button"
                onClick={handleBrowseFolder}
                disabled={isCracking}
              >
                📁 Browse
              </button>
            </div>
            <p className="cracking-modal__hint">
              Select the folder where the game is installed (contains .exe files)
            </p>
          </div>

          {progress.progress > 0 && (
            <div className="cracking-modal__progress">
              <div className="cracking-modal__progress-bar-container">
                <div
                  className="cracking-modal__progress-bar"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="cracking-modal__progress-text">
                {progress.message} ({progress.progress}%)
              </p>
            </div>
          )}

          {error && (
            <div className="cracking-modal__error">
              <span className="cracking-modal__error-icon">⚠️</span>
              {error}
            </div>
          )}

          {result && (
            <div className="cracking-modal__success">
              <span className="cracking-modal__success-icon">✅</span>
              <p>Game cracked successfully! Original files backed up with .svrn extension.</p>
            </div>
          )}
        </div>

        <div className="cracking-modal__footer">
          <button
            type="button"
            className="cracking-modal__button cracking-modal__button--secondary"
            onClick={handleClose}
            disabled={isCracking}
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              className="cracking-modal__button cracking-modal__button--primary"
              onClick={handleCrack}
              disabled={isCracking || !gamePath}
            >
              {isCracking ? "🔄 Cracking..." : "Start Crack"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

