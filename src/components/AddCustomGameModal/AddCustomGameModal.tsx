import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FileDirectoryIcon } from "@primer/octicons-react";
import { Modal } from "../Modal/Modal";
import { TextField } from "../TextField/TextField";
import { Button } from "../Button";
import { useLibrary, useToast } from "@/hooks";
import type { LibraryGame } from "@/types";
import "./AddCustomGameModal.scss";

interface AddCustomGameModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddCustomGameModal({ visible, onClose }: AddCustomGameModalProps) {
  const { t } = useTranslation("add_custom_game");
  const { updateLibrary } = useLibrary();
  const { showSuccessToast, showErrorToast } = useToast();
  const navigate = useNavigate();

  const [gameName, setGameName] = useState("");
  const [executablePath, setExecutablePath] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSelectExecutable = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Executable Files",
            extensions: ["exe", "lnk"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setExecutablePath(selected);

        // Auto-fill game name from executable filename if empty
        if (!gameName.trim()) {
          const fileName = selected.split(/[\\/]/).pop() || "";
          const gameNameFromFile = fileName.replace(/\.[^/.]+$/, "");
          setGameName(gameNameFromFile);
        }
      }
    } catch (error) {
      console.error("Failed to select executable:", error);
    }
  };

  const handleGameNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGameName(event.target.value);
  };

  const handleAddGame = async () => {
    if (!gameName.trim() || !executablePath.trim()) {
      showErrorToast(t("fill_required"));
      return;
    }

    setIsAdding(true);

    try {
      const newGame = await invoke<LibraryGame>("add_custom_game_to_library", {
        title: gameName.trim(),
        executablePath: executablePath.trim(),
      });

      showSuccessToast(t("success"));
      await updateLibrary();

      // Navigate to the new custom game's details page
      navigate(`/game/custom/${newGame.objectId}`);

      // Reset form
      setGameName("");
      setExecutablePath("");
      onClose();
    } catch (error) {
      console.error("Failed to add custom game:", error);
      showErrorToast(
        error instanceof Error ? error.message : t("failed")
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    if (!isAdding) {
      setGameName("");
      setExecutablePath("");
      onClose();
    }
  };

  const isFormValid = gameName.trim() && executablePath.trim();

  return (
    <Modal
      visible={visible}
      title={t("title")}
      description={t("description")}
      onClose={handleClose}
    >
      <div className="add-custom-game-modal__container">
        <div className="add-custom-game-modal__form">
          <TextField
            label={t("executable_path")}
            placeholder={t("select_executable")}
            value={executablePath}
            readOnly
            disabled={isAdding}
            rightContent={
              <Button
                type="button"
                theme="outline"
                onClick={handleSelectExecutable}
                disabled={isAdding}
              >
                <FileDirectoryIcon />
                {t("browse")}
              </Button>
            }
          />

          <TextField
            label={t("game_title")}
            placeholder={t("enter_title")}
            value={gameName}
            onChange={handleGameNameChange}
            disabled={isAdding}
          />
        </div>

        <div className="add-custom-game-modal__actions">
          <Button
            type="button"
            theme="outline"
            onClick={handleClose}
            disabled={isAdding}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            theme="primary"
            onClick={handleAddGame}
            disabled={!isFormValid || isAdding}
          >
            {isAdding ? t("adding") : t("add")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

