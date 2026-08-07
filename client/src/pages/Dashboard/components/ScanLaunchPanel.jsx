import { useEffect, useRef, useState } from "react";

import "./ScanOperationsSection.css";

import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";

import useMissions from "../../../hooks/useMissions";
import useMissionQueue from "../../../hooks/useMissionQueue";
import useScans from "../../../hooks/useScans";

import {
  cancelQueuedMission,
  launchMission,
} from "../../../services/orchestration/reconOrchestrator";

const ACTIVE_MISSION_STATES = new Set([
  "queued",
  "initializing",
  "running",
]);

const TERMINAL_SCAN_STATES = new Set([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);

function ScanLaunchPanel({ onScanFinished }) {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState("full");
  const [profile, setProfile] = useState("General");
  const [severity, setSeverity] = useState("medium");
  const [targetError, setTargetError] = useState("");
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [isStartingScan, setIsStartingScan] = useState(false);

  const completionReportedRef = useRef(null);

  const { missions = [] } = useMissions();
  const queueSnapshot = useMissionQueue();
  const { scans = [] } = useScans();

  const {
    activeMission: queuedActiveMission,
    queuedMissions,
    metrics: queueMetrics,
  } = queueSnapshot;

  const queueBusy = queueMetrics.busy;

  const activeMission = activeMissionId
    ? missions.find((mission) => {
        return [
          mission?.id,
          mission?.clientMissionId,
          mission?.mongoId,
          mission?._id,
        ].some(
          (missionId) =>
            missionId && String(missionId) === String(activeMissionId),
        );
      })
    : null;

  const activeMissionScanIds = [
    activeMission?.scanId,
    activeMission?.scanMongoId,
  ]
    .filter(Boolean)
    .map(String);

  const activeScan = activeMissionId
    ? scans.find((scan) => {
        if (
          scan?.missionId &&
          String(scan.missionId) === String(activeMissionId)
        ) {
          return true;
        }

        return [scan?.id, scan?.mongoId, scan?._id]
          .filter(Boolean)
          .map(String)
          .some((scanId) => activeMissionScanIds.includes(scanId));
      }) ?? null
    : null;

  const activeScanStatus = String(activeScan?.status || "").toLowerCase();

  const isScanActive =
    isStartingScan ||
    queueBusy ||
    (activeScan
      ? !TERMINAL_SCAN_STATES.has(activeScanStatus)
      : Boolean(
          activeMission &&
            ACTIVE_MISSION_STATES.has(
              String(activeMission.state).toLowerCase(),
            ),
        ));

  useEffect(() => {
    if (
      !activeMissionId ||
      !activeScan ||
      !TERMINAL_SCAN_STATES.has(activeScanStatus)
    ) {
      return;
    }

    const completionKey =
      activeScan.mongoId ?? activeScan._id ?? activeScan.id ?? null;

    if (
      !completionKey ||
      completionReportedRef.current === String(completionKey)
    ) {
      return;
    }

    completionReportedRef.current = String(completionKey);
    setActiveMissionId(null);

    onScanFinished?.(activeScan);
  }, [
    activeMissionId,
    activeScan,
    activeScanStatus,
    onScanFinished,
  ]);

  const handleStartScan = async (event) => {
    event?.preventDefault();

    if (isScanActive) {
      return;
    }

    const normalizedTarget = target.trim();

    if (!normalizedTarget) {
      setTargetError(
        "Enter an IP address, hostname, or domain before starting a scan.",
      );

      return;
    }

    setTargetError("");
    setIsStartingScan(true);

    try {
      const mission = await launchMission({
        target: normalizedTarget,
        type: scanType,
        profile,
        severity,
      });

      completionReportedRef.current = null;
      setActiveMissionId(mission.id);
      setTarget("");
    } catch (error) {
      console.error("[ScanLaunchPanel] Failed to start scan", error);

      setTargetError("Unable to start the scan. Try again.");
    } finally {
      setIsStartingScan(false);
    }
  };

  const handleQueueScan = async () => {
    if (!queueBusy || isStartingScan) {
      return;
    }

    const normalizedTarget = target.trim();

    if (!normalizedTarget) {
      setTargetError(
        "Enter an IP address, hostname, or domain before adding it to the queue.",
      );

      return;
    }

    setTargetError("");
    setIsStartingScan(true);

    try {
      await launchMission({
        target: normalizedTarget,
        type: scanType,
        profile,
        severity,
      });

      setTarget("");
    } catch (error) {
      console.error("[ScanLaunchPanel] Failed to queue scan", error);

      setTargetError("Unable to add the scan to the queue. Try again.");
    } finally {
      setIsStartingScan(false);
    }
  };

  const handleRemoveQueuedScan = async (missionId) => {
    try {
      await cancelQueuedMission(missionId);
    } catch (error) {
      console.error(
        "[ScanLaunchPanel] Failed to remove queued scan",
        error,
      );

      setTargetError(
        "Unable to remove the queued scan. It remains in the queue.",
      );
    }
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
        <Button
          type="submit"
          className={`scan-start-button ${
            isScanActive ? "scan-start-button--active" : ""
          }`}
          disabled={isScanActive}
        >
          <span
            className="scan-start-button__indicator"
            aria-hidden="true"
          />

          {isScanActive ? "Scanning…" : "Start Scan"}
        </Button>

        {queueBusy ? (
          <button
            className="scan-queue-action"
            type="button"
            disabled={isStartingScan}
            onClick={() => {
              void handleQueueScan();
            }}
          >
            + Queue Scan
          </button>
        ) : null}

        <button
          className="scan-secondary-action"
          type="button"
          disabled
          title="Target import is planned for a future release."
        >
          Import Targets — Planned
        </button>
      </div>

      {queueBusy ? (
        <section
          className="scan-queue-panel"
          aria-label="Scan execution queue"
        >
          <div className="scan-queue-panel__header">
            <div>
              <span className="scan-queue-panel__eyebrow">
                Scan Queue
              </span>

              <strong className="scan-queue-panel__summary">
                {queueMetrics.active} active · {queueMetrics.queued} queued
                {queueMetrics.recovered
                  ? ` · ${queueMetrics.recovered} recovered`
                  : ""}
              </strong>
            </div>

            <span
              className="scan-queue-panel__live"
              aria-label="Queue processor active"
            >
              <span aria-hidden="true" />
              FIFO
            </span>
          </div>

          <div className="scan-queue-panel__items">
            {queuedActiveMission ? (
              <div className="scan-queue-item scan-queue-item--active">
                <span
                  className="scan-queue-item__indicator"
                  aria-hidden="true"
                />

                <div className="scan-queue-item__copy">
                  <strong>{queuedActiveMission.target}</strong>
                  <span>Scanning / preparing runtime</span>
                </div>

                <span className="scan-queue-item__state">
                  {queuedActiveMission.queueRecovered
                    ? "Recovered · Active"
                    : "Active"}
                </span>
              </div>
            ) : null}

            {queuedMissions.slice(0, 5).map((mission, index) => (
              <div className="scan-queue-item" key={mission.id}>
                <span className="scan-queue-item__position">
                  {index + 1}
                </span>

                <div className="scan-queue-item__copy">
                  <strong>{mission.target}</strong>
                  <span>
                    {mission.type || "recon"} · {mission.severity || "medium"}
                  </span>
                </div>

                <span className="scan-queue-item__state">
                  {mission.queueRecovered
                    ? "Recovered · Waiting"
                    : "Waiting"}
                </span>

                <button
                  className="scan-queue-item__remove"
                  type="button"
                  title={`Remove ${mission.target} from the queue`}
                  onClick={() => {
                    void handleRemoveQueuedScan(mission.id);
                  }}
                >
                  Remove
                </button>
              </div>
            ))}

            {queuedMissions.length > 5 ? (
              <div className="scan-queue-panel__more">
                +{queuedMissions.length - 5} more queued
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </form>
  );
}

export default ScanLaunchPanel;
