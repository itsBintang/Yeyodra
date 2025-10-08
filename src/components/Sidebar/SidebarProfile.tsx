import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAppDispatch, useAppSelector } from "@/store";
import { loadUserProfile } from "@/features/userSlice";
import { Avatar } from "@/components";
import { LicenseInfo } from "@/types";
import "./SidebarProfile.scss";

export function SidebarProfile() {
  const navigate = useNavigate();
  const { t } = useTranslation("sidebar");
  const dispatch = useAppDispatch();
  
  const { userProfile, isInitialized } = useAppSelector((state) => state.user);
  const [badgeType, setBadgeType] = useState<"admin" | "premium" | null>(null);

  // Load user profile from backend on mount
  useEffect(() => {
    if (!isInitialized) {
      dispatch(loadUserProfile());
    }
  }, [dispatch, isInitialized]);

  // Check license type for badge
  useEffect(() => {
    const checkLicenseType = async () => {
      try {
        const license = await invoke<LicenseInfo>("get_license_info_local");
        
        // Check if lifetime (ADMIN) or regular (PREMIUM)
        const expiryDate = new Date(license.expires_at);
        const now = new Date();
        const yearsFromNow = (expiryDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        
        if (yearsFromNow > 100) {
          setBadgeType("admin"); // Lifetime = ADMIN
        } else {
          setBadgeType("premium"); // Regular = PREMIUM
        }
      } catch (err) {
        setBadgeType(null); // No license or error
      }
    };

    checkLicenseType();
  }, []);

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
            <div className="sidebar-profile__name-container">
              <p className="sidebar-profile__button-title">
                {userProfile?.displayName || t("loading")}
              </p>
              {badgeType && (
                <span className={`sidebar-profile__badge sidebar-profile__badge--${badgeType}`}>
                  {badgeType === "admin" ? "👑 ADMIN" : "✨ PREMIUM"}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

