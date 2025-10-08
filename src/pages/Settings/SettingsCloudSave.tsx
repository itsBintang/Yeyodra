import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Button } from "@/components";
import { useToast } from "@/hooks";
import "./SettingsCloudSave.scss";

export function SettingsCloudSave() {
  const { t } = useTranslation("settings");
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
        <h3 className="settings-cloud-save__section-title">{t("game_database")}</h3>
        <p className="settings-cloud-save__description">
          {t("cloud_save_description")}
        </p>

        <Button
          theme="primary"
          onClick={handleUpdateManifest}
          disabled={isUpdatingManifest}
        >
          {isUpdatingManifest ? t("updating") : t("update_game_database")}
        </Button>

        <div className="settings-cloud-save__hint">
          <span className="settings-cloud-save__hint-icon">ℹ️</span>
          <p>
            {t("database_hint")}
          </p>
        </div>
      </div>

      <div className="settings-cloud-save__section">
        <h3 className="settings-cloud-save__section-title">{t("how_cloud_save_works")}</h3>
        <div className="settings-cloud-save__info">
          <p>
            {t("cloud_save_info")}
          </p>
          
          <div className="settings-cloud-save__features">
            <div className="settings-cloud-save__feature-item">
              <span className="settings-cloud-save__feature-icon">💾</span>
              <div>
                <h4>{t("automatic_detection")}</h4>
                <p>{t("automatic_detection_description")}</p>
              </div>
            </div>

            <div className="settings-cloud-save__feature-item">
              <span className="settings-cloud-save__feature-icon">☁️</span>
              <div>
                <h4>{t("local_backups")}</h4>
                <p>{t("local_backups_description")}</p>
              </div>
            </div>

            <div className="settings-cloud-save__feature-item">
              <span className="settings-cloud-save__feature-icon">🔄</span>
              <div>
                <h4>{t("easy_restore")}</h4>
                <p>{t("easy_restore_description")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

