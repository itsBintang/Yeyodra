import { useState } from "react";
import { Modal } from "@/components/Modal/Modal";
import { Button } from "@/components/Button";
import { useCloudSync } from "@/contexts/cloud-sync";
import { open } from "@tauri-apps/plugin-dialog";
import { FileDirectoryIcon, CheckIcon } from "@primer/octicons-react";
import "./CloudSyncFilesModal.scss";

interface CloudSyncFilesModalProps {
  visible: boolean;
  onClose: () => void;
}

enum FileMappingMethod {
  Automatic = "AUTOMATIC",
  Manual = "MANUAL",
}

export function CloudSyncFilesModal({ visible, onClose }: CloudSyncFilesModalProps) {
  const { backupPreview, selectGameBackupPath } = useCloudSync();
  const [selectedMethod, setSelectedMethod] = useState<FileMappingMethod>(
    backupPreview?.customBackupPath ? FileMappingMethod.Manual : FileMappingMethod.Automatic
  );
  const [customPath, setCustomPath] = useState<string | null>(
    backupPreview?.customBackupPath || null
  );

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Save Game Folder",
      });

      if (selected && typeof selected === "string") {
        setCustomPath(selected);
        await selectGameBackupPath(selected);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    }
  };

  const handleMethodChange = async (method: FileMappingMethod) => {
    setSelectedMethod(method);
    if (method === FileMappingMethod.Automatic) {
      setCustomPath(null);
      await selectGameBackupPath(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const files = backupPreview
    ? Object.entries(backupPreview.games).flatMap(([, game]) =>
        Object.entries(game.files).map(([path, fileInfo]) => ({
          path,
          ...fileInfo,
        }))
      )
    : [];

  return (
    <Modal
      visible={visible}
      title="Manage Save Files"
      onClose={onClose}
      className="cloud-sync-files-modal"
    >
      <div className="cloud-sync-files-modal__content">
        <div className="cloud-sync-files-modal__method-section">
          <h3>Mapping Method</h3>
          <div className="cloud-sync-files-modal__methods">
            <Button
              onClick={() => handleMethodChange(FileMappingMethod.Automatic)}
              theme={selectedMethod === FileMappingMethod.Automatic ? "primary" : "outline"}
              className="cloud-sync-files-modal__method-button"
            >
              {selectedMethod === FileMappingMethod.Automatic && <CheckIcon />}
              Automatic Detection
            </Button>
            <Button
              onClick={() => handleMethodChange(FileMappingMethod.Manual)}
              theme={selectedMethod === FileMappingMethod.Manual ? "primary" : "outline"}
              className="cloud-sync-files-modal__method-button"
            >
              {selectedMethod === FileMappingMethod.Manual && <CheckIcon />}
              Manual Path
            </Button>
          </div>
        </div>

        <div className="cloud-sync-files-modal__path-section">
          {selectedMethod === FileMappingMethod.Automatic ? (
            <div className="cloud-sync-files-modal__info">
              <p>
                Ludusavi will automatically detect save file locations based on its database of
                known games.
              </p>
            </div>
          ) : (
            <div className="cloud-sync-files-modal__manual-path">
              <div className="cloud-sync-files-modal__path-input">
                <input
                  type="text"
                  value={customPath || ""}
                  readOnly
                  placeholder="Select a folder..."
                  className="cloud-sync-files-modal__input"
                />
                <Button onClick={handleSelectFolder} theme="outline">
                  <FileDirectoryIcon />
                  Browse
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="cloud-sync-files-modal__files-section">
          <h3>Detected Save Files ({files.length})</h3>
          {files.length === 0 ? (
            <p className="cloud-sync-files-modal__no-files">
              No save files detected. Try changing the mapping method or ensure the game has been
              launched at least once.
            </p>
          ) : (
            <ul className="cloud-sync-files-modal__file-list">
              {files.map((file, index) => (
                <li key={index} className="cloud-sync-files-modal__file-item">
                  <div className="cloud-sync-files-modal__file-info">
                    <span className="cloud-sync-files-modal__file-name">
                      {file.path.split(/[/\\]/).pop()}
                    </span>
                    <span className="cloud-sync-files-modal__file-path">{file.path}</span>
                  </div>
                  <span className="cloud-sync-files-modal__file-size">
                    {formatBytes(file.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

