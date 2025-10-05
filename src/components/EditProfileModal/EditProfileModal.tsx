import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { DeviceCameraIcon } from "@primer/octicons-react";
import { useAppDispatch, useAppSelector } from "@/store";
import { updateUserProfile } from "@/features/userSlice";
import { Modal, Button, TextField, Avatar } from "@/components";
import "./EditProfileModal.scss";

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { t } = useTranslation("profile");
  const dispatch = useAppDispatch();
  const { userProfile } = useAppSelector((state) => state.user);

  const [displayName, setDisplayName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with current values
  useEffect(() => {
    if (userProfile && visible) {
      setDisplayName(userProfile.displayName);
      setProfileImageUrl(userProfile.profileImageUrl);
    }
  }, [userProfile, visible]);

  const handleSelectProfileImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        // Convert file path to asset URL for Tauri
        const assetUrl = convertFileSrc(selected);
        setProfileImageUrl(assetUrl);
      }
    } catch (error) {
      console.error("Failed to select image:", error);
    }
  };


  const handleSave = async () => {
    if (!displayName.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const updates = {
        displayName: displayName.trim(),
        profileImageUrl,
      };

      // Update Redux
      dispatch(updateUserProfile(updates));

      // Save to localStorage for persistence
      const currentProfile = { ...userProfile, ...updates };
      localStorage.setItem("userProfile", JSON.stringify(currentProfile));

      onClose();
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal visible={visible} onClose={handleCancel} title={t("edit_profile")}>
      <form className="edit-profile-modal__form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <button
          type="button"
          className="edit-profile-modal__avatar-container"
          onClick={handleSelectProfileImage}
        >
          <Avatar
            size={128}
            src={profileImageUrl}
            alt={displayName}
          />
          <div className="edit-profile-modal__avatar-overlay">
            <DeviceCameraIcon size={38} />
          </div>
        </button>

        <TextField
          label={t("display_name")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("enter_display_name")}
        />

        <Button
          type="submit"
          theme="primary"
          disabled={isSaving || !displayName.trim()}
          className="edit-profile-modal__submit"
        >
          {isSaving ? t("saving") : t("save_changes")}
        </Button>
      </form>
    </Modal>
  );
}
