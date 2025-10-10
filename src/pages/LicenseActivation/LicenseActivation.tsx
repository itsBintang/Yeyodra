import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LicenseInfo } from "../../types";
import "./LicenseActivation.scss";

export default function LicenseActivation() {
  const [licenseKey, setLicenseKey] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    // Get device ID on mount
    invoke<string>("get_device_id")
      .then((id) => setDeviceId(id))
      .catch((err) => console.error("Failed to get device ID:", err));
  }, []);

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await invoke<LicenseInfo>("activate_license_key", {
        key: licenseKey.trim(),
      });

      console.log("[LicenseActivation] License activated:", result);
      setIsActivated(true);
      
      // Reload the app to show main content
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("[LicenseActivation] Activation failed:", err);
      setError(typeof err === "string" ? err : "Failed to activate license");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleActivate();
    }
  };

  return (
    <div className="license-activation">
      <div className="license-activation__container">
        <div className="license-activation__logo">
          <h1>Yeyodra</h1>
        </div>

        {isActivated ? (
          <div className="license-activation__success">
            <svg
              className="license-activation__success-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h2>License Activated!</h2>
            <p>Redirecting to app...</p>
          </div>
        ) : (
          <>
            <div className="license-activation__header">
              <h2>Activate License</h2>
              <p>Enter your license key to continue</p>
            </div>

            <div className="license-activation__form">
              <div className="license-activation__field">
                <label>Device ID</label>
                <input
                  type="text"
                  value={deviceId}
                  readOnly
                  className="license-activation__input license-activation__input--readonly"
                />
                <small>This is your unique device identifier</small>
              </div>

              <div className="license-activation__field">
                <label>License Key</label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="YEYODRA-XXXX-XXXX-XXXX"
                  className="license-activation__input"
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && (
                <div className="license-activation__error">
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {error}
                </div>
              )}

              <button
                onClick={handleActivate}
                disabled={loading || !licenseKey.trim()}
                className="license-activation__button"
              >
                {loading ? (
                  <>
                    <span className="license-activation__spinner"></span>
                    Activating...
                  </>
                ) : (
                  "Activate License"
                )}
              </button>
            </div>

            <div className="license-activation__footer">
              <p>
                Don't have a license key?{" "}
                <a
                  href="https://nzr.web.id"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get one here
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

