import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "@/hooks/useToast";
import type { LudusaviBackup, LocalBackup } from "@/types";

export enum CloudSyncState {
  New,
  Different,
  Same,
  Unknown,
}

export interface CloudSyncContextValue {
  backupPreview: LudusaviBackup | null;
  artifacts: LocalBackup[];
  showCloudSyncModal: boolean;
  backupState: CloudSyncState;
  restoringBackup: boolean;
  uploadingBackup: boolean;
  loadingPreview: boolean;
  setShowCloudSyncModal: (show: boolean) => void;
  getGameBackupPreview: () => Promise<void>;
  uploadSaveGame: (downloadOptionTitle: string | null, label?: string | null) => Promise<void>;
  downloadGameArtifact: (gameArtifactId: string) => Promise<void>;
  getGameArtifacts: () => Promise<void>;
  deleteGameArtifact: (gameArtifactId: string) => Promise<void>;
  copyBackupToPath: (backupId: string, destinationPath: string) => Promise<void>;
  selectGameBackupPath: (backupPath: string | null) => Promise<void>;
  importBackupFile: (sourceFilePath: string) => Promise<void>;
  showCloudSyncFilesModal: boolean;
  setShowCloudSyncFilesModal: (show: boolean) => void;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

export function useCloudSync() {
  const context = useContext(CloudSyncContext);
  if (!context) {
    throw new Error("useCloudSync must be used within CloudSyncProvider");
  }
  return context;
}

interface CloudSyncProviderProps {
  children: ReactNode;
  objectId: string;
  shop: string;
}

export function CloudSyncProvider({ children, objectId, shop }: CloudSyncProviderProps) {
  const [backupPreview, setBackupPreview] = useState<LudusaviBackup | null>(null);
  const [artifacts, setArtifacts] = useState<LocalBackup[]>([]);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [showCloudSyncFilesModal, setShowCloudSyncFilesModal] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const { showSuccessToast, showErrorToast } = useToast();

  // Get backup preview
  const getGameBackupPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      console.log("[CloudSync] Getting backup preview for:", { objectId, shop });
      const preview = await invoke<LudusaviBackup>("get_game_backup_preview", {
        objectId,
        shop,
      });
      console.log("[CloudSync] Backup preview:", preview);
      setBackupPreview(preview);
    } catch (error) {
      console.error("[CloudSync] Failed to get backup preview:", error);
      showErrorToast("Failed to get backup preview", String(error));
    } finally {
      setLoadingPreview(false);
    }
  }, [objectId, shop, showErrorToast]);

  // Get game artifacts
  const getGameArtifacts = useCallback(async () => {
    try {
      console.log("[CloudSync] Getting artifacts for:", { objectId, shop });
      const result = await invoke<LocalBackup[]>("get_game_artifacts", {
        objectId,
        shop,
      });
      console.log("[CloudSync] Artifacts:", result);
      setArtifacts(result);
    } catch (error) {
      console.error("[CloudSync] Failed to get artifacts:", error);
      // Don't show error toast here, just log it
    }
  }, [objectId, shop]);

  // Upload save game
  const uploadSaveGame = useCallback(
    async (downloadOptionTitle: string | null, label?: string | null) => {
      setUploadingBackup(true);
      try {
        console.log("[CloudSync] Uploading save game:", { objectId, shop, downloadOptionTitle, label });
        await invoke("upload_save_game", {
          objectId,
          shop,
          downloadOptionTitle,
          label,
        });
        showSuccessToast("Backup created successfully! (Saved locally)");
        // Refresh artifacts and preview
        await Promise.all([getGameArtifacts(), getGameBackupPreview()]);
      } catch (error) {
        console.error("[CloudSync] Failed to upload save game:", error);
        showErrorToast("Failed to upload backup", String(error));
      } finally {
      setUploadingBackup(false);
    }
    },
    [objectId, shop, showSuccessToast, showErrorToast, getGameArtifacts, getGameBackupPreview]
  );

  // Download game artifact
  const downloadGameArtifact = useCallback(
    async (gameArtifactId: string) => {
      setRestoringBackup(true);
      try {
        console.log("[CloudSync] Downloading artifact:", gameArtifactId);
        await invoke("download_game_artifact", {
          objectId,
          shop,
          gameArtifactId,
        });
        showSuccessToast("Backup restored successfully!");
        await getGameBackupPreview();
      } catch (error) {
        console.error("[CloudSync] Failed to download artifact:", error);
        showErrorToast("Failed to restore backup", String(error));
      } finally {
        setRestoringBackup(false);
      }
    },
    [objectId, shop, showSuccessToast, showErrorToast, getGameBackupPreview]
  );

  // Delete game artifact
  const deleteGameArtifact = useCallback(
    async (gameArtifactId: string) => {
      try {
        console.log("[CloudSync] Deleting artifact:", gameArtifactId);
        await invoke("delete_game_artifact", {
          gameArtifactId,
        });
        showSuccessToast("Backup deleted successfully!");
        await Promise.all([getGameArtifacts(), getGameBackupPreview()]);
      } catch (error) {
        console.error("[CloudSync] Failed to delete artifact:", error);
        showErrorToast("Failed to delete backup", String(error));
      }
    },
    [showSuccessToast, showErrorToast, getGameArtifacts, getGameBackupPreview]
  );

  // Copy backup to custom path
  const copyBackupToPath = useCallback(
    async (backupId: string, destinationPath: string) => {
      try {
        console.log("[CloudSync] Copying backup to path:", { backupId, destinationPath });
        const copiedPath = await invoke<string>("copy_backup_to_path", {
          backupId,
          destinationPath,
        });
        showSuccessToast(`Backup copied successfully to: ${copiedPath}`);
      } catch (error) {
        console.error("[CloudSync] Failed to copy backup:", error);
        showErrorToast("Failed to copy backup", String(error));
      }
    },
    [showSuccessToast, showErrorToast]
  );

  // Select game backup path
  const selectGameBackupPath = useCallback(
    async (backupPath: string | null) => {
      try {
        console.log("[CloudSync] Setting backup path:", backupPath);
        await invoke("select_game_backup_path", {
          shop,
          objectId,
          backupPath,
        });
        showSuccessToast("Custom backup path set successfully!");
        await getGameBackupPreview();
      } catch (error) {
        console.error("[CloudSync] Failed to set backup path:", error);
        showErrorToast("Failed to set backup path", String(error));
      }
    },
    [shop, objectId, showSuccessToast, showErrorToast, getGameBackupPreview]
  );

  // Import backup file
  const importBackupFile = useCallback(
    async (sourceFilePath: string) => {
      try {
        console.log("[CloudSync] Importing backup file:", sourceFilePath);
        const backupId = await invoke<string>("import_backup_file", {
          sourceFilePath,
          objectId,
        });
        showSuccessToast(`Backup imported successfully! (ID: ${backupId})`);
        // Refresh artifacts list
        await Promise.all([getGameArtifacts(), getGameBackupPreview()]);
      } catch (error) {
        console.error("[CloudSync] Failed to import backup:", error);
        showErrorToast("Failed to import backup", String(error));
      }
    },
    [objectId, showSuccessToast, showErrorToast, getGameArtifacts, getGameBackupPreview]
  );

  // Calculate backup state
  const backupState = (() => {
    if (!backupPreview) return CloudSyncState.Unknown;
    if (backupPreview.overall.changedGames.new > 0) return CloudSyncState.New;
    if (backupPreview.overall.changedGames.different > 0) return CloudSyncState.Different;
    if (backupPreview.overall.changedGames.same > 0) return CloudSyncState.Same;
    return CloudSyncState.Unknown;
  })();

  // Load preview and artifacts when modal opens
  useEffect(() => {
    if (showCloudSyncModal) {
      getGameBackupPreview();
      getGameArtifacts();
    }
  }, [showCloudSyncModal, getGameBackupPreview, getGameArtifacts]);

  const value: CloudSyncContextValue = {
    backupPreview,
    artifacts,
    showCloudSyncModal,
    backupState,
    restoringBackup,
    uploadingBackup,
    loadingPreview,
    setShowCloudSyncModal,
    getGameBackupPreview,
    uploadSaveGame,
    downloadGameArtifact,
    getGameArtifacts,
    deleteGameArtifact,
    copyBackupToPath,
    selectGameBackupPath,
    importBackupFile,
    showCloudSyncFilesModal,
    setShowCloudSyncFilesModal,
  };

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

