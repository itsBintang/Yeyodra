import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { CheckboxField } from "@/components";
import "./SettingsDownloadSources.scss";

interface UserPreferences {
  downloadsPath?: string;
  steamPath?: string;
  language?: string;
  steamtoolsEnabled: boolean;
}

export function SettingsDownloadSources() {
  const { t } = useTranslation("settings");
  const [steamtoolsEnabled, setSteamtoolsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await invoke<UserPreferences>("get_user_preferences");
      setSteamtoolsEnabled(prefs.steamtoolsEnabled);
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const handleToggleSteamTools = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      await invoke<UserPreferences>("update_user_preferences", {
        preferences: {
          steamtoolsEnabled: enabled,
        },
      });
      setSteamtoolsEnabled(enabled);
    } catch (error) {
      console.error("Failed to update preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="settings-download-sources">
      <p className="settings-download-sources__description">
        {t("download_sources_description")}
      </p>

      <div className="settings-download-sources__list">
        <div className="settings-download-sources__item">
          <div className="settings-download-sources__item-info">
            <h3>Steam</h3>
            <p>{t("steam_source_description")}</p>
          </div>
          <CheckboxField
            label=""
            checked={steamtoolsEnabled}
            onChange={handleToggleSteamTools}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

