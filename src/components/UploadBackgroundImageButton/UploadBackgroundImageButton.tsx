import { useState } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { UploadIcon } from "@primer/octicons-react";
import { useAppDispatch } from "@/store";
import { updateUserProfile } from "@/features/userSlice";
import { Button } from "@/components";
import "./UploadBackgroundImageButton.scss";

export function UploadBackgroundImageButton() {
  const { t } = useTranslation("profile");
  const dispatch = useAppDispatch();
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadBackground = async () => {
    try {
      setIsUploading(true);
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
        const assetUrl = convertFileSrc(selected);
        dispatch(updateUserProfile({ backgroundImageUrl: assetUrl }));
      }
    } catch (error) {
      console.error("Failed to upload background:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Button
      theme="outline"
      className="upload-background-image-button"
      onClick={handleUploadBackground}
      disabled={isUploading}
    >
      <UploadIcon />
      {isUploading ? t("uploading_banner") : t("upload_banner")}
    </Button>
  );
}
