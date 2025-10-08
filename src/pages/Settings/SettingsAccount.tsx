import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components";
import { LicenseInfo } from "@/types";
import { useToast } from "@/hooks";
import "./SettingsAccount.scss";

export function SettingsAccount() {
  const { showSuccessToast, showErrorToast } = useToast();
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    loadLicenseInfo();
  }, []);

  const loadLicenseInfo = async () => {
    setIsLoading(true);
    try {
      const licenseInfo = await invoke<LicenseInfo>("get_license_info_local");
      setLicense(licenseInfo);
    } catch (error) {
      console.error("Failed to load license:", error);
      setLicense(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateLicense = async () => {
    setIsValidating(true);
    try {
      const validatedLicense = await invoke<LicenseInfo>("validate_license_key");
      setLicense(validatedLicense);
      showSuccessToast(
        "License Valid",
        "Your license has been validated successfully",
        3000
      );
    } catch (error) {
      showErrorToast(
        "License Validation Failed",
        String(error),
        4000
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("Are you sure you want to deactivate your license? You will need to reactivate to use the app again.")) {
      return;
    }

    try {
      await invoke("deactivate_license_key");
      showSuccessToast(
        "License Deactivated",
        "Your license has been deactivated. The app will now reload.",
        2000
      );
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      showErrorToast(
        "Deactivation Failed",
        String(error),
        4000
      );
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getDaysRemaining = (expiresAt: string) => {
    try {
      const now = new Date();
      const expiryDate = new Date(expiresAt);
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 0;
    }
  };

  const isLifetimeLicense = (expiresAt: string) => {
    try {
      const now = new Date();
      const expiryDate = new Date(expiresAt);
      const yearsFromNow = (expiryDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return yearsFromNow > 100; // More than 100 years = lifetime
    } catch {
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="settings-account">
        <p className="settings-account__loading">Loading license information...</p>
      </div>
    );
  }

  if (!license) {
    return (
      <div className="settings-account">
        <p className="settings-account__error">No license found</p>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(license.expires_at);
  const isExpired = daysRemaining <= 0;
  const isLifetime = isLifetimeLicense(license.expires_at);

  return (
    <div className="settings-account">
      {/* License Information Section */}
      <div className="settings-account__section">
        <h3 className="settings-account__section-title">License Information</h3>
        
        <div className="settings-account__info-grid">
          <div className="settings-account__info-item">
            <span className="settings-account__info-label">License Key</span>
            <span className="settings-account__info-value">{license.key}</span>
          </div>

          <div className="settings-account__info-item">
            <span className="settings-account__info-label">Device ID</span>
            <span className="settings-account__info-value settings-account__info-value--mono">
              {license.device_id.substring(0, 16)}...
            </span>
          </div>

          <div className="settings-account__info-item">
            <span className="settings-account__info-label">Activated On</span>
            <span className="settings-account__info-value">
              {formatDate(license.activated_at)}
            </span>
          </div>

          <div className="settings-account__info-item">
            <span className="settings-account__info-label">Expires On</span>
            <span className="settings-account__info-value">
              {isLifetime ? (
                <span style={{ color: '#adff2f', fontWeight: 'bold' }}>♾️ LIFETIME</span>
              ) : (
                formatDate(license.expires_at)
              )}
            </span>
          </div>

          <div className="settings-account__info-item">
            <span className="settings-account__info-label">License Type</span>
            <div className="settings-account__badge-container">
              {isLifetime ? (
                <span className="settings-account__badge settings-account__badge--admin">
                  👑 ADMIN
                </span>
              ) : (
                <span className="settings-account__badge settings-account__badge--premium">
                  ✨ PREMIUM
                </span>
              )}
            </div>
          </div>

          <div className="settings-account__info-item">
            <span className="settings-account__info-label">Status</span>
            <span className={`settings-account__status ${isExpired ? "settings-account__status--expired" : "settings-account__status--active"}`}>
              {isExpired ? "Expired" : isLifetime ? "♾️ Lifetime Active" : `Active (${daysRemaining} days remaining)`}
            </span>
          </div>
        </div>

        <div className="settings-account__actions">
          <Button
            theme="outline"
            onClick={handleValidateLicense}
            disabled={isValidating}
          >
            {isValidating ? "Validating..." : "Validate License"}
          </Button>

          <Button
            theme="danger"
            onClick={handleDeactivate}
          >
            Deactivate License
          </Button>
        </div>
      </div>
    </div>
  );
}

