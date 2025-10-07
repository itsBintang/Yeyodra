import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useAppSelector } from "@/store";
import { Sidebar, Header, Toast } from "./components";
import { closeToast } from "@/features/toastSlice";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { LicenseInfo } from "./types";
import LicenseActivation from "./pages/LicenseActivation/LicenseActivation";
import "./App.scss";

export function App() {
  const contentRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const dispatch = useAppDispatch();
  const toast = useAppSelector((state) => state.toast);
  const [isLicensed, setIsLicensed] = useState(false);
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
          console.log("[Auth] License expired");
          setIsLicensed(false);
        } else {
          console.log("[Auth] License valid");
          setIsLicensed(true);
        }
      } catch (err) {
        console.log("[Auth] No license found");
        setIsLicensed(false);
      } finally {
        setLicenseChecked(true);
      }
    };

    if (!licenseChecked) {
      checkLicense();
    }
  }, [licenseChecked]);

  // Background validation every 1 minute (for testing)
  useEffect(() => {
    if (!isLicensed || !licenseChecked) return;

    const validateInBackground = async () => {
      try {
        console.log("[Auth] Background validation...");
        await invoke("validate_license_key");
        console.log("[Auth] Background validation passed");
      } catch (err) {
        console.error("[Auth] Background validation failed:", err);
        // License invalid - force re-activation
        setIsLicensed(false);
        alert("Your license is no longer valid. Please reactivate.");
      }
    };

    // Validate immediately on mount
    validateInBackground();

    // Then validate every 1 minute (for testing - change to 30 * 60 * 1000 for production)
    // Production: 30 minutes
const interval = setInterval(validateInBackground, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isLicensed, licenseChecked]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [location.pathname, location.search]);

  const handleCloseToast = () => {
    dispatch(closeToast());
  };

  // Show license activation page if not licensed
  if (licenseChecked && !isLicensed) {
    return <LicenseActivation />;
  }

  // Show loading state while checking license
  if (!licenseChecked) {
    return null;
  }

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
    </>
  );
}

