import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/store";
import { loadUserProfile } from "@/features/userSlice";
import { Avatar } from "@/components";
import "./SidebarProfile.scss";

export function SidebarProfile() {
  const navigate = useNavigate();
  const { t } = useTranslation("sidebar");
  const dispatch = useAppDispatch();
  
  const { userProfile, isInitialized } = useAppSelector((state) => state.user);

  // Load user profile from backend on mount
  useEffect(() => {
    if (!isInitialized) {
      dispatch(loadUserProfile());
    }
  }, [dispatch, isInitialized]);

  const handleProfileClick = () => {
    if (!userProfile) return;
    navigate(`/profile/${userProfile.id}`);
  };

  return (
    <div className="sidebar-profile">
      <button
        type="button"
        className="sidebar-profile__button"
        onClick={handleProfileClick}
      >
        <div className="sidebar-profile__button-content">
          <Avatar
            size={35}
            src={userProfile?.profileImageUrl}
            alt={userProfile?.displayName}
          />

          <div className="sidebar-profile__button-information">
            <p className="sidebar-profile__button-title">
              {userProfile?.displayName || t("loading")}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

