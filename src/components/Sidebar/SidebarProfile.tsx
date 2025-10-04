import { useNavigate } from "react-router-dom";
import { PeopleIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import "./SidebarProfile.scss";

export function SidebarProfile() {
  const navigate = useNavigate();
  const { t } = useTranslation("sidebar");

  // Placeholder for user details - you'll implement this later
  const userDetails = null;
  const friendRequestCount = 0;

  const handleProfileClick = () => {
    if (userDetails === null) {
      // Handle sign in
      console.log("Sign in");
      return;
    }

    navigate(`/profile/${userDetails}`);
  };

  return (
    <div className="sidebar-profile">
      <button
        type="button"
        className="sidebar-profile__button"
        onClick={handleProfileClick}
      >
        <div className="sidebar-profile__button-content">
          <div
            className="sidebar-profile__avatar"
            style={{
              width: 35,
              height: 35,
              borderRadius: "50%",
              backgroundColor: "#2a2a2a",
            }}
          />

          <div className="sidebar-profile__button-information">
            <p className="sidebar-profile__button-title">
              {userDetails ? "User Name" : t("sign_in")}
            </p>
          </div>
        </div>
      </button>

      {userDetails && (
        <button
          type="button"
          className="sidebar-profile__friends-button"
          title={t("friends")}
        >
          {friendRequestCount > 0 && (
            <small className="sidebar-profile__friends-button-badge">
              {friendRequestCount > 99 ? "99+" : friendRequestCount}
            </small>
          )}
          <PeopleIcon size={16} />
        </button>
      )}
    </div>
  );
}

