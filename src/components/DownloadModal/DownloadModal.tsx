import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { DownloadIcon } from "@primer/octicons-react";
import { Button, Modal } from "@/components";
import { useToast } from "@/hooks";
import "./DownloadModal.scss";

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  appId: string;
  gameName: string;
  gameImageUrl?: string | null;
  hasRepacks?: boolean;
  onDownloadComplete?: () => void; // NEW: Callback to refresh game state
}

export function DownloadModal({
  visible,
  onClose,
  appId,
  gameName,
  gameImageUrl,
  hasRepacks = false,
  onDownloadComplete,
}: DownloadModalProps) {
  const { t } = useTranslation("game_details");
  const { showSuccessToast, showErrorToast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [steamtoolsEnabled, setSteamtoolsEnabled] = useState(true);

  // Check if steamtools is enabled
  useEffect(() => {
    if (visible) {
      invoke<{ steamtoolsEnabled: boolean }>("get_user_preferences")
        .then((prefs) => {
          setSteamtoolsEnabled(prefs.steamtoolsEnabled);
        })
        .catch((err) => console.error("Failed to load preferences:", err));
    }
  }, [visible]);

  const handleDownloadSteamTools = async () => {
    setIsDownloading(true);

    try {
      const result = await invoke<{ success: boolean; message: string }>(
        "download_game_steamtools",
        { 
          appId,
          gameTitle: gameName,
          iconUrl: gameImageUrl
        }
      );

      if (result.success) {
        showSuccessToast(result.message);
        
        // Trigger game state refresh to update button to "Play"
        if (onDownloadComplete) {
          onDownloadComplete();
        }
        
        onClose();
      } else {
        showErrorToast(result.message);
      }
    } catch (error) {
      console.error("Download failed:", error);
      showErrorToast(`Download failed: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadRepacks = () => {
    // TODO: Implement repack download modal
    showErrorToast("Repack download not implemented yet");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      title={t("download_options")}
      onClose={onClose}
    >
      <div className="download-modal__container">
        {/* SteamTools Option */}
        <div className="download-modal__option">
          <div className="download-modal__option-header">
            <h3>{t("download_steamtools")}</h3>
            {!steamtoolsEnabled && (
              <span className="download-modal__disabled-badge">
                {t("disabled")}
              </span>
            )}
          </div>

          {!steamtoolsEnabled && (
            <p className="download-modal__warning">
              {t("steamtools_disabled_warning")}
            </p>
          )}

          <Button
            onClick={handleDownloadSteamTools}
            disabled={!steamtoolsEnabled || isDownloading}
            theme="primary"
          >
            <DownloadIcon />
            {isDownloading ? t("downloading") : t("download_steamtools")}
          </Button>
        </div>

        {/* Repacks Option (if available) */}
        {hasRepacks && (
          <>
            <div className="download-modal__separator">
              <span>{t("or")}</span>
            </div>

            <div className="download-modal__option">
              <div className="download-modal__option-header">
                <h3>{t("download_from_repacks")}</h3>
              </div>

              <p className="download-modal__option-description">
                {t("repacks_description")}
              </p>

              <Button onClick={handleDownloadRepacks} theme="outline">
                <DownloadIcon />
                {t("browse_repacks")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

