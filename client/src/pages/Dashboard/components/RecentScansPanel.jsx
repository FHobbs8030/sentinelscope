import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./ScanOperationsSection.css";

import useScans from "../../../hooks/useScans";
import {
  getStableScanId,
  scanMatchesIdentity,
} from "../../../utils/operationalIdentity";

import scanEventBus, {
  SCAN_EVENTS,
} from "../../../services/runtime/scanEventBus";

const MOBILE_SCAN_PAGE_SIZE = 5;
const NEW_SCAN_FOCUS_DURATION_MS = 7000;

const getStableScanKey = (scan, index) => {
  return getStableScanId(scan) || `scan-${index}`;
};

function RecentScansPanel({ focusType, focusId }) {
  const navigate = useNavigate();

  const { scans, isLoading, error, refreshScans } = useScans();

  const [visibleMobileScanCount, setVisibleMobileScanCount] = useState(
    MOBILE_SCAN_PAGE_SIZE,
  );
  const [focusedScanId, setFocusedScanId] = useState(null);

  const panelRef = useRef(null);
  const handledFocusIdRef = useRef(null);
  const focusTimerRef = useRef(null);

  const externalFocusedScanId =
    focusType === "scan" && focusId ? String(focusId) : null;

  const effectiveFocusedScanId = externalFocusedScanId || focusedScanId;

  useEffect(() => {
    const unsubscribe = scanEventBus.subscribe(
      SCAN_EVENTS.SCAN_CREATED,
      (event) => {
        const createdScanId = event.payload?.scan?.id;

        if (!createdScanId) {
          return;
        }

        if (focusTimerRef.current) {
          window.clearTimeout(focusTimerRef.current);
          focusTimerRef.current = null;
        }

        handledFocusIdRef.current = null;
        setFocusedScanId(String(createdScanId));
      },
    );

    return () => {
      unsubscribe();

      if (focusTimerRef.current) {
        window.clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  const focusedMobileScanIndex = effectiveFocusedScanId
    ? scans.findIndex((scan) =>
        scanMatchesIdentity(scan, effectiveFocusedScanId),
      )
    : -1;

  const effectiveVisibleMobileScanCount = Math.max(
    visibleMobileScanCount,
    focusedMobileScanIndex >= 0 ? focusedMobileScanIndex + 1 : 0,
  );

  useEffect(() => {
    if (
      !effectiveFocusedScanId ||
      handledFocusIdRef.current === effectiveFocusedScanId
    ) {
    return;
  }

  const matchingScan = scans.find((scan) =>
    scanMatchesIdentity(scan, effectiveFocusedScanId),
  );

  if (!matchingScan) {
    return;
  }

  const focusTargets = panelRef.current?.querySelectorAll(
    '[data-new-scan-focus="true"]',
  );

  const visibleTarget = Array.from(focusTargets || []).find(
    (element) => element.getClientRects().length > 0,
  );

  if (!visibleTarget) {
    return;
  }

  handledFocusIdRef.current = effectiveFocusedScanId;

  const prefersReducedMotion =
    document.documentElement.dataset.motion === "reduced" ||
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  visibleTarget.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "center",
  });

  /*
    URL-driven focus remains active while ?focus=scan&id=... is present.

    Newly created scan auto-focus remains temporary.
  */
  if (externalFocusedScanId) {
    if (focusTimerRef.current) {
      window.clearTimeout(focusTimerRef.current);
    }

    focusTimerRef.current = window.setTimeout(() => {
      navigate("/", { replace: true });

      handledFocusIdRef.current = null;
      focusTimerRef.current = null;
    }, NEW_SCAN_FOCUS_DURATION_MS);

    return;
  }

  focusTimerRef.current = window.setTimeout(() => {
    setFocusedScanId((currentScanId) =>
      currentScanId === effectiveFocusedScanId ? null : currentScanId,
    );

    if (handledFocusIdRef.current === effectiveFocusedScanId) {
      handledFocusIdRef.current = null;
    }

    focusTimerRef.current = null;
  }, NEW_SCAN_FOCUS_DURATION_MS);
  }, [
    effectiveFocusedScanId,
    externalFocusedScanId,
    navigate,
    scans,
    effectiveVisibleMobileScanCount,
  ]);

  const mobileScans = scans.slice(0, effectiveVisibleMobileScanCount);

  const remainingMobileScans = Math.max(
    0,
    scans.length - effectiveVisibleMobileScanCount,
  );

  const hasAdditionalMobileScans = remainingMobileScans > 0;
  const canCollapseMobileScans =
    effectiveVisibleMobileScanCount > MOBILE_SCAN_PAGE_SIZE;
  const nextMobileScanCount = Math.min(
    MOBILE_SCAN_PAGE_SIZE,
    remainingMobileScans,
  );

  const formatStatusLabel = (status = "") => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatScanType = (type = "") => {
    switch (type.toLowerCase()) {
      case "full":
        return "Full Recon";

      case "recon":
        return "Recon Scan";

      case "enumeration":
        return "Enumeration Scan";

      case "vulnerability":
        return "Vulnerability Scan";

      default:
        return type;
    }
  };

  const formatStartedTime = (startedAt) => {
    if (!startedAt) {
      return "Just now";
    }

    const started = new Date(startedAt);
    const now = new Date();

    const diffMinutes = Math.floor((now.getTime() - started.getTime()) / 60000);

    if (diffMinutes < 1) {
      return "Just now";
    }

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);

    return `${diffDays}d ago`;
  };

  const viewScan = (scan) => {
    const scanId = getStableScanId(scan);

    if (!scanId) {
      return;
    }

    const params = new URLSearchParams({
      focus: "scan",
      id: String(scanId),
    });

    navigate(`/?${params.toString()}`);

    window.dispatchEvent(
      new CustomEvent("dashboard:section-focus", {
        detail: {
          sectionId: "dashboard-operations",
        },
      }),
    );
  };

  const retryLoad = () => {
    void refreshScans();
  };

  if (isLoading && scans.length === 0) {
    return (
      <div className="recent-scans-panel">
        <div className="scan-loading-state" role="status" aria-live="polite">
          Loading scan telemetry...
        </div>
      </div>
    );
  }

  if (error && scans.length === 0) {
    return (
      <div className="recent-scans-panel">
        <div className="scan-error-state" role="alert" aria-live="assertive">
          <span>{error}</span>

          <button
            type="button"
            className="scan-action-button"
            onClick={retryLoad}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recent-scans-panel" ref={panelRef}>
      {error ? (
        <div className="scan-error-state" role="alert" aria-live="polite">
          <span>{error} Showing the last available scan telemetry.</span>

          <button
            type="button"
            className="scan-action-button"
            onClick={retryLoad}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="operations-table-container desktop-scans-table">
        <table className="recent-scans-table">
          <thead>
            <tr className="scan-table-header">
              <th>Target</th>
              <th>Type</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Started</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {scans.map((scan, index) => {
              const isFocusedScan = scanMatchesIdentity(
                scan,
                effectiveFocusedScanId,
              );

              return (
                <tr
                  key={getStableScanKey(scan, index)}
                  className={`scan-table-row${
                    isFocusedScan ? " scan-new-focus" : ""
                  }`}
                  data-new-scan-focus={isFocusedScan ? "true" : undefined}
                >
                  <td
                    className="scan-table-cell target-cell"
                    data-label="Target"
                    title={scan.target}
                  >
                    {scan.target}
                  </td>

                  <td className="scan-table-cell" data-label="Type">
                    <span
                      className={`scan-type-badge scan-type-${(
                        scan.type ||
                        scan.scanType ||
                        "full"
                      ).toLowerCase()}`}
                    >
                      {formatScanType(scan.type || scan.scanType || "full")}
                    </span>
                  </td>

                  <td className="scan-table-cell" data-label="Status">
                    <span
                      className={`status-chip status-${(
                        scan.status || "completed"
                      ).toLowerCase()}`}
                    >
                      {formatStatusLabel(scan.status || "completed")}
                    </span>
                  </td>

                  <td className="scan-table-cell" data-label="Progress">
                    <div className="progress-wrapper">
                      <span className="progress-label">
                        {scan.progress || 0}%
                      </span>

                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${scan.progress || 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="scan-table-cell" data-label="Started">
                    {formatStartedTime(scan.startedAt)}
                  </td>

                  <td className="scan-table-cell" data-label="Actions">
                    <button
                      type="button"
                      className="scan-action-button"
                      disabled={!getStableScanId(scan)}
                      onClick={() => {
                        viewScan(scan);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-scans-list">
        {mobileScans.map((scan, index) => {
          const scanType = scan.type || scan.scanType || "full";
          const scanStatus = scan.status || "completed";
          const scanProgress = scan.progress || 0;
          const isFocusedScan = scanMatchesIdentity(
            scan,
            effectiveFocusedScanId,
          );

          return (
            <article
              key={`mobile-${getStableScanKey(scan, index)}`}
              className={`mobile-scan-card${
                isFocusedScan ? " scan-new-focus" : ""
              }`}
              data-new-scan-focus={isFocusedScan ? "true" : undefined}
            >
              <div className="mobile-scan-target" title={scan.target}>
                {scan.target}
              </div>

              <div className="mobile-scan-meta">
                <div className="mobile-scan-field">
                  <span className="mobile-scan-label">Type</span>

                  <span
                    className={`scan-type-badge scan-type-${scanType.toLowerCase()}`}
                  >
                    {formatScanType(scanType)}
                  </span>
                </div>

                <div className="mobile-scan-field">
                  <span className="mobile-scan-label">Status</span>

                  <span
                    className={`status-chip status-${scanStatus.toLowerCase()}`}
                  >
                    {formatStatusLabel(scanStatus)}
                  </span>
                </div>

                <div className="mobile-scan-field mobile-scan-progress-field">
                  <span className="mobile-scan-label">Progress</span>

                  <div className="progress-wrapper">
                    <span className="progress-label">{scanProgress}%</span>

                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${scanProgress}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mobile-scan-field">
                  <span className="mobile-scan-label">Started</span>

                  <span className="mobile-scan-value">
                    {formatStartedTime(scan.startedAt)}
                  </span>
                </div>

                <div className="mobile-scan-field">
                  <span className="mobile-scan-label">Actions</span>

                  <button
                    type="button"
                    className="scan-action-button"
                    disabled={!getStableScanId(scan)}
                    onClick={() => {
                      viewScan(scan);
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {hasAdditionalMobileScans || canCollapseMobileScans ? (
          <div className="mobile-scans-actions">
            <button
              type="button"
              className="mobile-scans-toggle"
              aria-expanded={
                effectiveVisibleMobileScanCount > MOBILE_SCAN_PAGE_SIZE
              }
              onClick={() => {
                if (hasAdditionalMobileScans) {
                  setVisibleMobileScanCount(
                    Math.min(
                      effectiveVisibleMobileScanCount +
                        MOBILE_SCAN_PAGE_SIZE,
                      scans.length,
                    ),
                  );

                  return;
                }

                setVisibleMobileScanCount(MOBILE_SCAN_PAGE_SIZE);
              }}
            >
              {hasAdditionalMobileScans
                ? `Show ${nextMobileScanCount} more scan${
                    nextMobileScanCount === 1 ? "" : "s"
                  }`
                : `Show recent ${MOBILE_SCAN_PAGE_SIZE}`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default RecentScansPanel;
