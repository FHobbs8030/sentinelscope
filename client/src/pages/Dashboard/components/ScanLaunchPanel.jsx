import { useState } from "react";

import "./ScanOperationsSection.css";

import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";

import { launchMission } from "../../../services/orchestration/reconOrchestrator";

function ScanLaunchPanel() {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState("full");
  const [profile, setProfile] = useState("General");
  const [severity, setSeverity] = useState("medium");
  const [targetError, setTargetError] = useState("");

  const handleStartScan = (event) => {
    event?.preventDefault();

    const normalizedTarget = target.trim();

    if (!normalizedTarget) {
      setTargetError(
        "Enter an IP address, hostname, or domain before starting a scan.",
      );

      return;
    }

    setTargetError("");

    launchMission({
      target: normalizedTarget,
      type: scanType,
      profile,
      severity,
    });

    setTarget("");
  };

  return (
    <form className="scan-launch-panel" onSubmit={handleStartScan}>
      <div className="scan-panel-header">
        <div>
          <h2 className="scan-panel-title">Start New Scan</h2>

          <p className="scan-panel-subtitle">
            Configure a target and launch an operational scan.
          </p>
        </div>
      </div>

      <div className="scan-form-grid">
        <div className="scan-target-field">
          <Input
            label="Target"
            value={target}
            onChange={(event) => {
              const nextTarget = event.target.value;

              setTarget(nextTarget);

              if (targetError && nextTarget.trim()) {
                setTargetError("");
              }
            }}
            placeholder="example.com or 192.168.1.1"
            helperText="Enter an IP address, hostname, or domain."
          />

          {targetError ? (
            <p className="scan-target-error" role="alert">
              {targetError}
            </p>
          ) : null}
        </div>

        <label className="scan-field">
          <span className="scan-field-label">Scan Type</span>

          <select
            className="scan-select"
            value={scanType}
            onChange={(event) => setScanType(event.target.value)}
          >
            <option value="full">Full Scan</option>
            <option value="recon">Recon Scan</option>
            <option value="enumeration">Enumeration Scan</option>
            <option value="vulnerability">Vulnerability Scan</option>
          </select>
        </label>

        <label className="scan-field">
          <span className="scan-field-label">
            Profile
            <span className="scan-field-status">Metadata only</span>
          </span>

          <select
            className="scan-select"
            value={profile}
            onChange={(event) => setProfile(event.target.value)}
          >
            <option value="General">General</option>
            <option value="Quick">Quick</option>
            <option value="Comprehensive">Comprehensive</option>
            <option value="Critical">Critical</option>
          </select>

          <span className="scan-field-helper">
            Saved with the scan record. Profile does not currently change
            runtime behavior.
          </span>
        </label>

        <label className="scan-field">
          <span className="scan-field-label">Severity</span>

          <select
            className="scan-select"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
      </div>

      <div className="scan-panel-actions">
        <Button type="submit">Start Scan</Button>

        <button
          className="scan-secondary-action"
          type="button"
          disabled
          title="Target import is planned for a future release."
        >
          Import Targets — Planned
        </button>
      </div>
    </form>
  );
}

export default ScanLaunchPanel;
