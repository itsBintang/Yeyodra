import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { LicenseInfo } from "../../types";
import { Button } from "../../components/Button";
import "./SettingsLicense.scss";

export default function SettingsLicense() {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLicense = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const licenseData = await invoke<LicenseInfo>("get_license_info_local");
      setLicense(licenseData);
    } catch (err) {
      console.log("[License] No license found:", err);
      setLicense(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLicense();
  }, []);

  const handleValidate = async () => {
    if (!license) return;

    setIsLoading(true);
    setError(null);

    try {
      const validated = await invoke<LicenseInfo>("validate_license_key");
      setLicense(validated);
      alert("✓ License is valid!");
    } catch (err) {
      console.error("[License] Validation failed:", err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!license) return;

    if (!confirm("Are you sure you want to deactivate this license? You will need to reactivate to use the app.")) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await invoke("deactivate_license_key");
      setLicense(null);
      
      // Reload app to show activation page
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error("[License] Deactivation failed:", err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysRemaining = () => {
    if (!license) return null;

    const expiresAt = new Date(license.expires_at);
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return days;
  };

  const isExpired = () => {
    const days = getDaysRemaining();
    return days !== null && days <= 0;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="settings-license">
      <h2>License</h2>
      <p className="subtitle">Manage your Chaos Launcher license</p>

      {isLoading && <div className="loading">Loading license information...</div>}

      {!isLoading && !license && (
        <div className="no-license">
          <div className="icon">🔐</div>
          <h3>No Active License</h3>
          <p>This should not be visible. Please reload the app.</p>
        </div>
      )}

      {!isLoading && license && (
        <div className={`license-card ${isExpired() ? "expired" : ""}`}>
          <div className="license-header">
            <div className="status-badge">
              {isExpired() ? "❌ Expired" : "✓ Active"}
            </div>
          </div>

          <div className="license-details">
            <div className="detail-row">
              <span className="label">License Key:</span>
              <span className="value monospace">{license.key}</span>
            </div>

            <div className="detail-row">
              <span className="label">Device ID:</span>
              <span className="value monospace">
                {license.device_id.substring(0, 32)}...
              </span>
            </div>

            <div className="detail-row">
              <span className="label">Activated On:</span>
              <span className="value">{formatDate(license.activated_at)}</span>
            </div>

            <div className="detail-row">
              <span className="label">Expires On:</span>
              <span className="value">{formatDate(license.expires_at)}</span>
            </div>

            {!isExpired() && (
              <div className="detail-row">
                <span className="label">Days Remaining:</span>
                <span className="value highlight">{getDaysRemaining()} days</span>
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="license-actions">
            <Button theme="outline" onClick={handleValidate} disabled={isLoading}>
              Validate License
            </Button>
            <Button
              theme="outline"
              onClick={handleDeactivate}
              disabled={isLoading}
            >
              Deactivate License
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

