import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Modal } from "../Modal/Modal";
import { TextField } from "../TextField/TextField";
import { Button } from "../Button";
import { useLibrary } from "@/hooks";
import type { LibraryGame } from "@/types";
import "./GameOptionsModal.scss";

interface GameOptionsModalProps {
  visible: boolean;
  game: LibraryGame;
  onClose: () => void;
  onGameUpdate: () => void;
}

export function GameOptionsModal({
  visible,
  game,
  onClose,
  onGameUpdate,
}: GameOptionsModalProps) {
  const { t } = useTranslation("game_options");
  const navigate = useNavigate();
  const { updateLibrary } = useLibrary();
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);

  const handleSelectExecutable = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Executable",
            extensions: ["exe"],
          },
        ],
      });

      if (selected) {
        await invoke("update_library_game_executable", {
          shop: game.shop,
          objectId: game.objectId,
          executablePath: selected as string,
        });
        onGameUpdate();
      }
    } catch (error) {
      console.error("Failed to select executable:", error);
    }
  };

  const handleRemoveFromLibrary = async () => {
    try {
      await invoke("remove_library_game", {
        shop: game.shop,
        objectId: game.objectId,
      });
      
      // Update both game details and library list (like Hydra)
      await Promise.all([
        onGameUpdate(),
        updateLibrary(),
      ]);
      
      onClose();
      navigate("/");
    } catch (error) {
      console.error("Failed to remove game from library:", error);
    }
  };

  return (
    <>
      <Modal visible={visible && !showRemoveConfirmation} title={game.title} onClose={onClose} large>
        <div className="game-options-modal">
          <div className="game-options-modal__section">
            <h2>{t("executable")}</h2>
            <p className="game-options-modal__description">
              {t("executable_description")}
            </p>
            <TextField
              value={game.executablePath || t("no_executable")}
              readOnly
              disabled
              rightContent={
                <Button theme="outline" onClick={handleSelectExecutable}>
                  {t("select")}
                </Button>
              }
            />
          </div>

          <div className="game-options-modal__section game-options-modal__danger-zone">
            <h2>{t("danger_zone")}</h2>
            <p className="game-options-modal__description">
              {t("danger_zone_description")}
            </p>
            <Button
              theme="danger"
              onClick={() => setShowRemoveConfirmation(true)}
            >
              {t("remove_from_library")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        visible={showRemoveConfirmation}
        title={t("remove_from_library")}
        onClose={() => setShowRemoveConfirmation(false)}
      >
        <div className="game-options-modal__confirmation">
          <p>{t("remove_game_confirmation", { game_name: game.title })}</p>
          <div className="game-options-modal__confirmation-actions">
            <Button theme="danger" onClick={handleRemoveFromLibrary}>
              {t("remove")}
            </Button>
            <Button
              theme="outline"
              onClick={() => setShowRemoveConfirmation(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

