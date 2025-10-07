import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { LicenseInfo } from "../../types";
import { Modal } from "../Modal/Modal";
import { TextField } from "../TextField/TextField";
import { Button } from "../Button";
import "./LicenseActivationModal.scss";

interface LicenseActivationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (license: LicenseInfo) => void;
}

export default function LicenseActivationModal({
  visible,
  onClose,
  onSuccess,
}: LicenseActivationModalProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load device ID on mount
  useState(() => {
    if (visible && !deviceId) {
      invoke<string>("get_device_id")
        .then((id) => setDeviceId(id))
        .catch((err) => console.error("Failed to get device ID:", err));
    }
  });

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setIsActivating(true);
    setError(null);

    try {
      const license = await invoke<LicenseInfo>("activate_license_key", {
        key: licenseKey.trim(),
      });

      console.log("[License] Activated successfully:", license);
      onSuccess(license);
      onClose();
      setLicenseKey("");
    } catch (err) {
      console.error("[License] Activation failed:", err);
      setError(String(err));
    } finally {
      setIsActivating(false);
    }
  };

  const handleClose = () => {
    if (!isActivating) {
      setLicenseKey("");
      setError(null);
      onClose();
    }
  };

  return (
    <Modal visible={visible} onClose={handleClose}>
      <div className="license-activation-modal">
        <h2>Activate License</h2>
        <p className="subtitle">
          Enter your license key to activate Chaos Launcher
        </p>

        <div className="form-section">
          <TextField
            label="License Key"
            placeholder="CHAOS-XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            disabled={isActivating}
            autoFocus
          />

          {deviceId && (
            <div className="device-info">
              <small>Device ID: {deviceId.substring(0, 16)}...</small>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-actions">
          <Button
            theme="outline"
            onClick={handleClose}
            disabled={isActivating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleActivate}
            disabled={isActivating || !licenseKey.trim()}
          >
            {isActivating ? "Activating..." : "Activate"}
          </Button>
        </div>

        <div className="help-text">
          <p>
            Don't have a license key?{" "}
            <a href="#" onClick={(e) => e.preventDefault()}>
              Purchase one here
            </a>
          </p>
        </div>
      </div>
    </Modal>
  );
}

