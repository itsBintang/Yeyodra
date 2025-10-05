import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PencilIcon } from "@primer/octicons-react";
import { useAppSelector } from "@/store";
import { Avatar, Button, EditProfileModal, UploadBackgroundImageButton } from "@/components";
import "./ProfileHero.scss";

interface ProfileHeroProps {
  userId?: string;
}

export function ProfileHero({ userId: _userId }: ProfileHeroProps) {
  const { t } = useTranslation("profile");
  const { userProfile } = useAppSelector((state) => state.user);
  const [showEditModal, setShowEditModal] = useState(false);

  // Generate hero background from avatar (simple gradient)
  const heroBackground = useMemo(() => {
    if (!userProfile?.displayName) return "#151515";
    
    // Generate color from name
    let hash = 0;
    for (let i = 0; i < userProfile.displayName.length; i++) {
      hash = userProfile.displayName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue}, 30%, 15%), hsl(${hue}, 30%, 10%))`;
  }, [userProfile?.displayName]);

  if (!userProfile) {
    return null;
  }

  const handleAvatarClick = () => {
    setShowEditModal(true);
  };

  return (
    <>
      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      <section
        className="profile-hero__content-box"
        style={{ background: !userProfile.backgroundImageUrl ? heroBackground : undefined }}
      >
        {userProfile.backgroundImageUrl && (
          <img
            src={userProfile.backgroundImageUrl}
            alt=""
            className="profile-hero__background-image"
          />
        )}

        <div
          className={`profile-hero__background-overlay ${
            !userProfile.backgroundImageUrl
              ? "profile-hero__background-overlay--transparent"
              : ""
          }`}
        >
          <div className="profile-hero__user-information">
            <button
              type="button"
              className="profile-hero__avatar-button"
              onClick={handleAvatarClick}
            >
              <Avatar
                size={96}
                alt={userProfile.displayName}
                src={userProfile.profileImageUrl}
              />
            </button>

            <div className="profile-hero__information">
              <h2 className="profile-hero__display-name">
                {userProfile.displayName}
              </h2>
            </div>

            <UploadBackgroundImageButton />
          </div>
        </div>

        <div
          className={`profile-hero__hero-panel ${
            !userProfile.backgroundImageUrl ? "profile-hero__hero-panel--transparent" : ""
          }`}
          style={{
            background: !userProfile.backgroundImageUrl ? heroBackground : undefined,
          }}
        >
          <div className="profile-hero__actions">
            <Button
              theme="outline"
              onClick={() => setShowEditModal(true)}
            >
              <PencilIcon />
              {t("edit_profile")}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
