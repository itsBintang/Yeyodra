import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { XIcon, CheckIcon, LockIcon, UnlockIcon } from "@primer/octicons-react";
import { useToast } from "@/hooks";
import { useTranslation } from "react-i18next";
import "./DlcManager.scss";

interface DlcInfo {
  appId: string;
  name: string;
  headerImage: string;
}

interface DlcManagerProps {
  visible: boolean;
  onClose: () => void;
  appId: string;
  gameName: string;
  gameLogoUrl?: string | null;
}

export function DlcManager({ 
  visible, 
  onClose, 
  appId, 
  gameName,
  gameLogoUrl = ""
}: DlcManagerProps) {
  const { t } = useTranslation("dlc");
  const { showSuccessToast, showErrorToast } = useToast();
  
  const [dlcs, setDlcs] = useState<DlcInfo[]>([]);
  const [installedDlcs, setInstalledDlcs] = useState<Set<string>>(new Set());
  const [selectedDlcs, setSelectedDlcs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockMethod, setUnlockMethod] = useState<"lua" | "creamapi">("lua");

  // Fetch DLC data on mount
  useEffect(() => {
    if (visible) {
      fetchDlcData();
    }
  }, [visible, appId]);

  const fetchDlcData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch DLC list with cache
      const dlcList: DlcInfo[] = await invoke("get_game_dlcs_with_cache", {
        appId,
      });
      
      if (dlcList.length === 0) {
        setError(t("no_dlcs_available"));
        setIsLoading(false);
        return;
      }
      
      setDlcs(dlcList);
      
      // Get currently installed DLCs
      const installed: string[] = await invoke("get_installed_dlc_list", {
        appId,
      });
      
      const installedSet = new Set(installed);
      setInstalledDlcs(installedSet);
      setSelectedDlcs(new Set(installedSet));
      
    } catch (err) {
      console.error("Failed to load DLC data:", err);
      setError(t("failed_to_load", { error: String(err) }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDlc = (dlcId: string) => {
    setSelectedDlcs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dlcId)) {
        newSet.delete(dlcId);
      } else {
        newSet.add(dlcId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedDlcs(new Set(dlcs.map((dlc) => dlc.appId)));
  };

  const handleSelectNone = () => {
    setSelectedDlcs(new Set());
  };

  const handleSelectLocked = () => {
    const locked = dlcs.filter(dlc => !installedDlcs.has(dlc.appId));
    setSelectedDlcs(new Set(locked.map(dlc => dlc.appId)));
  };

  const handleSelectUnlocked = () => {
    setSelectedDlcs(new Set(installedDlcs));
  };

  const handleUnlockSelected = async () => {
    if (selectedDlcs.size === 0) return;
    
    setIsSaving(true);
    
    try {
      const result: string = await invoke("sync_dlc_selection", {
        appId,
        selectedDlcIds: Array.from(selectedDlcs),
      });
      
      showSuccessToast(result);
      setInstalledDlcs(new Set(selectedDlcs));
      
    } catch (err) {
      console.error("Failed to save DLC selection:", err);
      showErrorToast(t("failed_to_save", { error: String(err) }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedDlcs.size === 0) return;
    
    setIsSaving(true);
    
    try {
      const result: string = await invoke("sync_dlc_selection", {
        appId,
        selectedDlcIds: [],
      });
      
      showSuccessToast(result);
      setInstalledDlcs(new Set());
      setSelectedDlcs(new Set());
      
    } catch (err) {
      console.error("Failed to remove DLCs:", err);
      showErrorToast(t("failed_to_save", { error: String(err) }));
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    if (installedDlcs.size !== selectedDlcs.size) return true;
    for (const id of installedDlcs) {
      if (!selectedDlcs.has(id)) return true;
    }
    return false;
  };

  if (!visible) return null;

  return (
    <div className="dlc-manager-overlay">
      <div className="dlc-manager-modal">
        {/* Header */}
        <div className="dlc-manager-header">
          <h2 className="dlc-manager-title">{t("title")}</h2>
          <button onClick={onClose} className="dlc-close-btn" disabled={isSaving}>
            <XIcon size={24} />
          </button>
        </div>

        {/* Game Info Section */}
        <div className="dlc-game-info">
          <div className="dlc-game-header">
            {gameLogoUrl && (
              <img src={gameLogoUrl} alt={gameName} className="dlc-game-logo" />
            )}
            <h3 className="dlc-game-name">{gameName}</h3>
          </div>
        </div>

        {/* Unlock Method */}
        <div className="dlc-unlock-method">
          <h4 className="dlc-section-title">{t("unlock_method")}</h4>
          <div className="dlc-method-tabs">
            <button
              className={`dlc-method-tab ${unlockMethod === "lua" ? "active" : ""}`}
              onClick={() => setUnlockMethod("lua")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h18v18H3V3zm16 16V5H5v14h14z"/>
                <path d="M7 7h4v4H7V7zm6 0h4v4h-4V7zM7 13h4v4H7v-4zm6 0h4v4h-4v-4z"/>
              </svg>
              {t("lua_method")}
            </button>
            <button
              className={`dlc-method-tab ${unlockMethod === "creamapi" ? "active" : ""}`}
              onClick={() => setUnlockMethod("creamapi")}
              disabled
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              {t("creamapi_method")}
            </button>
          </div>
          <p className="dlc-method-description">
            {t("inject_description")}
          </p>
        </div>

        {/* Content */}
        <div className="dlc-manager-content">
          {isLoading && (
            <div className="dlc-loading">
              <div className="spinner" />
              <p>{t("loading")}</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="dlc-error">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && dlcs.length > 0 && (
            <>
              {/* Action Buttons */}
              <div className="dlc-actions-bar">
                <button className="dlc-action-btn" onClick={handleSelectAll}>
                  {t("select_all")}
                </button>
                <button className="dlc-action-btn" onClick={handleSelectNone}>
                  {t("select_none")}
                </button>
                <button className="dlc-action-btn" onClick={handleSelectLocked}>
                  {t("select_locked")}
                </button>
                <button className="dlc-action-btn" onClick={handleSelectUnlocked}>
                  {t("select_unlocked")}
                </button>
                <button
                  className="dlc-action-btn dlc-action-btn--unlock"
                  onClick={handleUnlockSelected}
                  disabled={isSaving || !hasChanges() || selectedDlcs.size === 0}
                >
                  <UnlockIcon size={16} />
                  {t("unlock_selected")}
                </button>
                <button
                  className="dlc-action-btn dlc-action-btn--remove"
                  onClick={handleRemoveSelected}
                  disabled={isSaving || selectedDlcs.size === 0}
                >
                  {t("remove_selected")}
                </button>
              </div>

              {/* DLC Grid - 2 columns */}
              <div className="dlc-grid dlc-grid--two-column">
                {dlcs.map((dlc) => {
                  const isSelected = selectedDlcs.has(dlc.appId);
                  const isUnlocked = installedDlcs.has(dlc.appId);
                  const isLocked = !isUnlocked;

                  return (
                    <div
                      key={dlc.appId}
                      className={`dlc-card ${isSelected ? "selected" : ""}`}
                      onClick={() => handleToggleDlc(dlc.appId)}
                    >
                      {/* Selection Indicator - Top Left */}
                      <div className="dlc-selection-indicator">
                        {isSelected ? (
                          <div className="dlc-check-icon">
                            <CheckIcon size={16} />
                          </div>
                        ) : (
                          <div className="dlc-x-icon">
                            <XIcon size={16} />
                          </div>
                        )}
                      </div>

                      {/* Method Badge - Top Right (only show for CreamAPI method) */}
                      {unlockMethod === "creamapi" && (
                        <>
                          {isUnlocked && (
                            <div className="dlc-creamapi-badge unlocked">
                              <CheckIcon size={12} />
                              CREAMAPI
                            </div>
                          )}
                          {!isUnlocked && (
                            <div className="dlc-creamapi-badge">
                              CREAMAPI
                            </div>
                          )}
                        </>
                      )}

                      {/* DLC Image */}
                      <div className="dlc-card-image">
                        <img
                          src={dlc.headerImage}
                          alt={dlc.name}
                          onError={(e) => {
                            e.currentTarget.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${dlc.appId}/header.jpg`;
                          }}
                        />
                        <div className="dlc-card-overlay" />
                      </div>

                      {/* DLC Info */}
                      <div className="dlc-card-info">
                        <h4 className="dlc-card-title">{dlc.name}</h4>
                        <p className="dlc-card-id">ID: {dlc.appId}</p>
                      </div>

                      {/* Lock Icon - Bottom Right */}
                      {isLocked && (
                        <div className="dlc-lock-icon">
                          <LockIcon size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
