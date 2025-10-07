import { Modal } from "@/components/Modal/Modal";
import { Button } from "@/components/Button";
import { useCloudSync } from "@/contexts/cloud-sync";
import { CloudIcon, UploadIcon, DownloadIcon, TrashIcon, SyncIcon, CopyIcon, FileIcon } from "@primer/octicons-react";
import { open } from "@tauri-apps/plugin-dialog";
import "./CloudSyncModal.scss";

interface CloudSyncModalProps {
  visible: boolean;
  onClose: () => void;
  gameTitle: string;
}

export function CloudSyncModal({ visible, onClose, gameTitle }: CloudSyncModalProps) {
  const {
    backupPreview,
    artifacts,
    uploadingBackup,
    restoringBackup,
    loadingPreview,
    uploadSaveGame,
    downloadGameArtifact,
    deleteGameArtifact,
    copyBackupToPath,
    importBackupFile,
    setShowCloudSyncFilesModal,
  } = useCloudSync();

  const handleUpload = async () => {
    try {
      await uploadSaveGame(null);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleRestore = async (artifactId: string) => {
    try {
      await downloadGameArtifact(artifactId);
    } catch (error) {
      console.error("Restore failed:", error);
    }
  };

  const handleDelete = async (artifactId: string) => {
    if (confirm("Are you sure you want to delete this backup?")) {
      try {
        await deleteGameArtifact(artifactId);
      } catch (error) {
        console.error("Delete failed:", error);
      }
    }
  };

  const handleCopyToPath = async (backupId: string) => {
    try {
      // Open directory picker dialog
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select destination folder for backup",
      });

      if (selectedPath) {
        await copyBackupToPath(backupId, selectedPath);
      }
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const handleImportBackup = async () => {
    try {
      // Open file picker for .tar files
      const selectedFile = await open({
        directory: false,
        multiple: false,
        title: "Select backup file to import",
        filters: [
          {
            name: "Backup Files",
            extensions: ["tar"],
          },
        ],
      });

      if (selectedFile) {
        await importBackupFile(selectedFile);
      }
    } catch (error) {
      console.error("Import failed:", error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Modal
      visible={visible}
      title="Cloud Save"
      onClose={onClose}
      className="cloud-sync-modal"
    >
      <div className="cloud-sync-modal__content">
        <div className="cloud-sync-modal__header">
          <div>
            <h2>{gameTitle}</h2>
            {loadingPreview && (
              <p className="cloud-sync-modal__status">
                <SyncIcon className="cloud-sync-modal__spinner" />
                Loading save preview...
              </p>
            )}
            {backupPreview && !loadingPreview && (
              <p className="cloud-sync-modal__status">
                {backupPreview.overall.totalGames > 0
                  ? `${backupPreview.overall.totalGames} save location(s) found - ${formatBytes(backupPreview.overall.totalBytes)}`
                  : "No save files detected"}
              </p>
            )}
          </div>
          <div className="cloud-sync-modal__actions">
            <Button
              onClick={() => setShowCloudSyncFilesModal(true)}
              theme="outline"
            >
              Manage Files
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadingBackup || !backupPreview?.overall.totalGames}
              theme="primary"
            >
              {uploadingBackup ? (
                <>
                  <SyncIcon className="cloud-sync-modal__spinner" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadIcon />
                  Create Backup
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="cloud-sync-modal__backups">
          <div className="cloud-sync-modal__backups-header">
            <h3>Your Backups ({artifacts.length})</h3>
            <Button
              onClick={handleImportBackup}
              theme="outline"
              title="Import a backup file from your friend"
            >
              <FileIcon />
              Import Backup
            </Button>
          </div>
          
          {artifacts.length === 0 ? (
            <div className="cloud-sync-modal__empty">
              <CloudIcon size={48} />
              <p>No backups yet</p>
              <p className="cloud-sync-modal__empty-hint">
                Create a backup or import one from a friend
              </p>
            </div>
          ) : (
            <ul className="cloud-sync-modal__backup-list">
              {artifacts.map((artifact) => (
                <li key={artifact.id} className="cloud-sync-modal__backup-item">
                  <div className="cloud-sync-modal__backup-info">
                    <div className="cloud-sync-modal__backup-header">
                      <strong>{artifact.label || `Backup from ${formatDate(artifact.createdAt)}`}</strong>
                      <span className="cloud-sync-modal__backup-size">
                        {formatBytes(artifact.sizeInBytes)}
                      </span>
                    </div>
                    <div className="cloud-sync-modal__backup-meta">
                      <span>📅 {formatDate(artifact.createdAt)}</span>
                      <span>📁 {artifact.fileCount} files</span>
                      <span>🖥️ {artifact.platform}</span>
                    </div>
                  </div>
                  <div className="cloud-sync-modal__backup-actions">
                    <Button
                      onClick={() => handleRestore(artifact.id)}
                      disabled={restoringBackup}
                      theme="outline"
                    >
                      <DownloadIcon />
                      Restore
                    </Button>
                    <Button
                      onClick={() => handleCopyToPath(artifact.id)}
                      theme="outline"
                      title="Copy backup to another location"
                    >
                      <CopyIcon />
                      Copy
                    </Button>
                    <Button
                      onClick={() => handleDelete(artifact.id)}
                      theme="outline"
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

