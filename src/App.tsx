import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useAppSelector } from "@/store";
import { Sidebar, Header, Toast, LicenseActivationModal } from "./components";
import { closeToast } from "@/features/toastSlice";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { LicenseInfo } from "./types";
import "./App.scss";

export function App() {
  const contentRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const dispatch = useAppDispatch();
  const toast = useAppSelector((state) => state.toast);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseChecked, setLicenseChecked] = useState(false);

  // Check license on app startup
  useEffect(() => {
    const checkLicense = async () => {
      try {
        const license = await invoke<LicenseInfo>("get_license_info_local");
        console.log("[Auth] License found:", license);
        
        // Check if expired
        const expiresAt = new Date(license.expires_at);
        const now = new Date();
        
        if (expiresAt < now) {
          console.log("[Auth] License expired, showing activation modal");
          setShowLicenseModal(true);
        }
      } catch (err) {
        console.log("[Auth] No license found, showing activation modal");
        setShowLicenseModal(true);
      } finally {
        setLicenseChecked(true);
      }
    };

    if (!licenseChecked) {
      checkLicense();
    }
  }, [licenseChecked]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [location.pathname, location.search]);

  const handleCloseToast = () => {
    dispatch(closeToast());
  };

  const handleLicenseActivated = (license: LicenseInfo) => {
    console.log("[Auth] License activated:", license);
    setShowLicenseModal(false);
  };

  return (
    <>
      <main>
        <Sidebar />

        <article className="container">
          <Header />

          <section ref={contentRef} className="container__content">
            <Outlet />
          </section>
        </article>
      </main>

      <Toast
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        onClose={handleCloseToast}
      />

      <LicenseActivationModal
        visible={showLicenseModal}
        onClose={() => setShowLicenseModal(false)}
        onSuccess={handleLicenseActivated}
      />
    </>
  );
}

