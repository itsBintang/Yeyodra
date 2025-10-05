import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { TrashIcon, XIcon } from "@primer/octicons-react";
import { Modal } from "../Modal/Modal";
import { TextField } from "../TextField/TextField";
import { Button } from "../Button";
import { useLibrary, useToast } from "@/hooks";
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
  const { showSuccessToast, showErrorToast } = useToast();
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

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
        
        // Get filename from path for display
        const filename = (selected as string).split(/[\\/]/).pop() || "Executable";
        showSuccessToast(
          "Executable Set",
          `${filename} has been set as the game executable. You can now use the Play button.`,
          4000
        );
      }
    } catch (error) {
      console.error("Failed to select executable:", error);
      showErrorToast(
        "Failed to Set Executable",
        typeof error === "string" ? error : "An error occurred while setting the executable",
        5000
      );
    }
  };

  const handleClearExecutable = async () => {
    try {
      await invoke("update_library_game_executable", {
        shop: game.shop,
        objectId: game.objectId,
        executablePath: null,
      });
      onGameUpdate();
      
      showSuccessToast(
        "Executable Removed",
        "Game executable has been removed. You can set a new one anytime.",
        3000
      );
    } catch (error) {
      console.error("Failed to clear executable:", error);
      showErrorToast(
        "Failed to Remove Executable",
        typeof error === "string" ? error : "An error occurred while removing the executable",
        5000
      );
    }
  };

  const handleRemoveGame = async () => {
    if (isRemoving) return;
    
    setIsRemoving(true);
    try {
      // Remove SteamTools files first
      await invoke<{ success: boolean; message: string }>("remove_game", {
        appId: game.objectId,
      });
      
      // Update game state first (this will mark isInstalled = false)
      await onGameUpdate();
      
      // Then remove from library
      await invoke("remove_library_game", {
        shop: game.shop,
        objectId: game.objectId,
      });
      
      // Update library list
      await updateLibrary();
      
      showSuccessToast(t("remove_game"), "Game removed successfully");
      setShowRemoveConfirmation(false);
      onClose();
      navigate("/");
    } catch (error) {
      console.error("Failed to remove game:", error);
      showErrorToast(t("remove_game"), `Failed to remove game: ${error}`);
    } finally {
      setIsRemoving(false);
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button theme="outline" onClick={handleSelectExecutable}>
                    {t("select")}
                  </Button>
                  {game.executablePath && (
                    <Button 
                      theme="outline" 
                      onClick={handleClearExecutable}
                      title="Remove executable"
                    >
                      <XIcon size={16} />
                    </Button>
                  )}
                </div>
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
              <TrashIcon size={16} />
              {t("remove_game")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Game Confirmation Modal */}
      <Modal
        visible={showRemoveConfirmation}
        title={t("remove_game")}
        onClose={() => setShowRemoveConfirmation(false)}
      >
        <div className="game-options-modal__confirmation">
          <p>{t("remove_game_confirmation", { game_name: game.title })}</p>
          <div className="game-options-modal__confirmation-actions">
            <Button 
              theme="danger" 
              onClick={handleRemoveGame}
              disabled={isRemoving}
            >
              {isRemoving ? t("removing") : t("remove")}
            </Button>
            <Button
              theme="outline"
              onClick={() => setShowRemoveConfirmation(false)}
              disabled={isRemoving}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

