import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components";
import { useToast } from "@/hooks";
import "./SettingsCloudSave.scss";

export function SettingsCloudSave() {
  const { showSuccessToast, showErrorToast } = useToast();
  const [isUpdatingManifest, setIsUpdatingManifest] = useState(false);

  const handleUpdateManifest = async () => {
    setIsUpdatingManifest(true);
    try {
      await invoke("update_ludusavi_manifest");
      showSuccessToast(
        `Game database updated successfully! Cloud save can now detect the latest games.`
      );
    } catch (error) {
      console.error("Failed to update manifest:", error);
      showErrorToast(`Failed to update game database: ${error}`);
    } finally {
      setIsUpdatingManifest(false);
    }
  };

  return (
    <div className="settings-cloud-save">
      <div className="settings-cloud-save__section">
        <h3 className="settings-cloud-save__section-title">Game Database</h3>
        <p className="settings-cloud-save__description">
          Update the game database to enable cloud save detection for newly released games.
          This downloads the latest save file locations and configurations.
        </p>

        <Button
          theme="primary"
          onClick={handleUpdateManifest}
          disabled={isUpdatingManifest}
        >
          {isUpdatingManifest ? "Updating..." : "Update Game Database"}
        </Button>

        <div className="settings-cloud-save__hint">
          <span className="settings-cloud-save__hint-icon">ℹ️</span>
          <p>
            The game database is automatically updated on app startup. 
            Use this button if you want to manually update it.
          </p>
        </div>
      </div>

      <div className="settings-cloud-save__section">
        <h3 className="settings-cloud-save__section-title">How Cloud Save Works</h3>
        <div className="settings-cloud-save__info">
          <p>
            Cloud Save feature automatically detects and backs up your game saves using an advanced detection system.
            The database contains save file locations and patterns for thousands of games across all platforms.
          </p>
          
          <div className="settings-cloud-save__features">
            <div className="settings-cloud-save__feature-item">
              <span className="settings-cloud-save__feature-icon">💾</span>
              <div>
                <h4>Automatic Detection</h4>
                <p>Automatically finds save files for supported games</p>
              </div>
            </div>

            <div className="settings-cloud-save__feature-item">
              <span className="settings-cloud-save__feature-icon">☁️</span>
              <div>
                <h4>Local Backups</h4>
                <p>Creates local backups of your game saves</p>
              </div>
            </div>

            <div className="settings-cloud-save__feature-item">
              <span className="settings-cloud-save__feature-icon">🔄</span>
              <div>
                <h4>Easy Restore</h4>
                <p>Restore your saves anytime from backup history</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

