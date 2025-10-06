import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, TextField, SelectField, CheckboxField } from "@/components";
import type { UserPreferences } from "@/types";
import { languageNames } from "@/locales";
import { useNetworkMode } from "@/contexts/network-mode";
import { useToast } from "@/hooks";
import "./SettingsGeneral.scss";

export function SettingsGeneral() {
  const { t, i18n } = useTranslation("settings");
  const { isLowConnectionMode, toggleLowConnectionMode } = useNetworkMode();
  const { showSuccessToast, showErrorToast } = useToast();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Language options dari languageNames
  const languageOptions = Object.entries(languageNames).map(([key, name]) => ({
    key,
    value: key,
    label: name,
  }));

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await invoke<UserPreferences>("get_user_preferences");
      setPreferences(prefs);
      
      // Set current language
      if (prefs.language) {
        i18n.changeLanguage(prefs.language);
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!preferences) return;

    try {
      const updated = await invoke<UserPreferences>("update_user_preferences", {
        preferences: { ...preferences, ...updates },
      });
      setPreferences(updated);
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
  };

  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const language = event.target.value;
    await updatePreferences({ language });
    i18n.changeLanguage(language);
  };

  const handleChooseDownloadsPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: preferences?.downloadsPath || undefined,
      });

      if (selected) {
        updatePreferences({ downloadsPath: selected as string });
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    }
  };

  const handleChooseSteamPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: preferences?.steamPath || undefined,
      });

      if (selected) {
        updatePreferences({ steamPath: selected as string });
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    }
  };

  if (isLoading) {
    return <div className="settings-general__loading">{t("loading")}</div>;
  }

  return (
    <div className="settings-general">
      <TextField
        label={t("downloads_path")}
        value={preferences?.downloadsPath || t("not_set")}
        readOnly
        disabled
        rightContent={
          <Button theme="outline" onClick={handleChooseDownloadsPath}>
            {t("change")}
          </Button>
        }
      />

      <TextField
        label={t("steam_path")}
        value={preferences?.steamPath || t("auto_detected")}
        readOnly
        disabled
        rightContent={
          <Button theme="outline" onClick={handleChooseSteamPath}>
            {t("change")}
          </Button>
        }
        hint={
          preferences?.steamPath
            ? t("steam_path_custom")
            : t("steam_path_auto")
        }
      />

      <SelectField
        label={t("language")}
        value={preferences?.language || "en"}
        onChange={handleLanguageChange}
        options={languageOptions}
      />

      <div className="settings-general__section">
        <CheckboxField
          label={t("low_connection_mode")}
          checked={isLowConnectionMode}
          onChange={async () => {
            try {
              await toggleLowConnectionMode();
              const mode = !isLowConnectionMode ? "Low Connection" : "Normal";
              showSuccessToast(
                `Switched to ${mode} Mode`,
                `Download manager restarted with ${!isLowConnectionMode ? "4" : "16"} connections`,
                3000
              );
            } catch (error) {
              showErrorToast(
                "Failed to Switch Mode",
                String(error),
                4000
              );
            }
          }}
        />
        <p className="settings-general__hint">
          {t("low_connection_mode_hint")}
        </p>
      </div>
    </div>
  );
}

