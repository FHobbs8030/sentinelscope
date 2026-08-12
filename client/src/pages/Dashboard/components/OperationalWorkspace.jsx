import { useCallback, useEffect, useRef, useState } from "react";

import "./OperationalWorkspace.css";

import ScanLaunchPanel from "./ScanLaunchPanel";
import RecentScansPanel from "./RecentScansPanel";
import ScanResultsModal from "./ScanResultsModal";
import FindingsSeverityPanel from "./FindingsSeverityPanel";
import OperationsSummaryPanel from "./OperationsSummaryPanel";
import { ownsMissionRuntime } from "../../../services/orchestration/runtimeOwnership";
import { TERMINAL_SCAN_STATES } from "../../../services/runtime/scanStateMachine";

import ActivityFeed from "../../../components/ActivityFeed";

import useScans from "../../../hooks/useScans";
import useMissions from "../../../hooks/useMissions";

import { subscribeToScanQueueDrained } from "../../../services/scanQueueEvents";

import { scanMatchesIdentity } from "../../../utils/operationalIdentity";

const SCAN_RESULTS_FINISH_DELAY_MS = 360;
const SCAN_RESULTS_SETTLE_DELAY_MS = 160;
const OPERATIONS_SCROLL_TIMEOUT_MS = 1800;

const waitForScrollToSettle = (element) => {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const startedAt = performance.now();

    let previousTop = null;
    let stableFrameCount = 0;
    let animationFrameId = null;

    const checkPosition = () => {
      const currentTop = element.getBoundingClientRect().top;
      const elapsed = performance.now() - startedAt;

      if (
        previousTop !== null &&
        Math.abs(currentTop - previousTop) < 0.5
      ) {
        stableFrameCount += 1;
      } else {
        stableFrameCount = 0;
      }

      previousTop = currentTop;

      const hasSettled =
        elapsed >= 180 && stableFrameCount >= 4;
      const hasTimedOut =
        elapsed >= OPERATIONS_SCROLL_TIMEOUT_MS;

      if (hasSettled || hasTimedOut) {
        resolve();
        return;
      }

      animationFrameId = window.requestAnimationFrame(checkPosition);
    };

    animationFrameId = window.requestAnimationFrame(checkPosition);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  });
};

function OperationalWorkspace({ focusType, focusId }) {
  const { scans, metrics } = useScans();
  const { metrics: missionMetrics } = useMissions();

  const [selectedScan, setSelectedScan] = useState(null);
  const [isScanResultsOpen, setIsScanResultsOpen] = useState(false);

  const autoOpenTimerRef = useRef(null);
  const settleTimerRef = useRef(null);
  const handledExternalFocusRef = useRef(null);
  const observedActiveScanIdsRef = useRef(new Set());
  const isMountedRef = useRef(true);

  const totalTargets = new Set(scans.map((scan) => scan.target).filter(Boolean))
    .size;

  const focusOperationsWorkspace = useCallback(async () => {
    window.dispatchEvent(
      new CustomEvent("dashboard:section-focus", {
        detail: {
          sectionId: "dashboard-operations",
        },
      }),
    );

    const operationsSection = document.getElementById(
      "dashboard-operations",
    );

    if (!operationsSection) {
      return;
    }

    const prefersReducedMotion =
      document.documentElement.dataset.motion === "reduced" ||
      (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
        false);

    await new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        operationsSection.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });

        resolve();
      });
    });

    if (!prefersReducedMotion) {
      await waitForScrollToSettle(operationsSection);
    }
  }, []);

  const openScanResults = useCallback((scan) => {
    if (!scan) {
      return;
    }

    setSelectedScan(scan);
    setIsScanResultsOpen(true);
  }, []);

  const closeScanResults = useCallback(() => {
    setIsScanResultsOpen(false);
  }, []);

  const handleScanFinished = useCallback(
    (scan) => {
      if (!scan) {
        return;
      }

      if (autoOpenTimerRef.current) {
        window.clearTimeout(autoOpenTimerRef.current);
      }

      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }

      const prefersReducedMotion =
        document.documentElement.dataset.motion === "reduced" ||
        (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
          false);

      autoOpenTimerRef.current = window.setTimeout(
        () => {
          autoOpenTimerRef.current = null;

          void focusOperationsWorkspace().then(() => {
            if (!isMountedRef.current) {
              return;
            }

            settleTimerRef.current = window.setTimeout(
              () => {
                if (isMountedRef.current) {
                  openScanResults(scan);
                }

                settleTimerRef.current = null;
              },
              prefersReducedMotion ? 0 : SCAN_RESULTS_SETTLE_DELAY_MS,
            );
          });
        },
        prefersReducedMotion ? 0 : SCAN_RESULTS_FINISH_DELAY_MS,
      );
    },
    [focusOperationsWorkspace, openScanResults],
  );

  useEffect(() => {
    const unsubscribeQueueDrained = subscribeToScanQueueDrained(
      ({ scan }) => {
        if (scan) {
          handleScanFinished(scan);
        }
      },
    );

    return unsubscribeQueueDrained;
  }, [handleScanFinished]);

  useEffect(() => {
    scans.forEach((scan) => {
      if (!scan?.id || !scan?.missionId) {
        return;
      }

      const scanId = String(scan.id);
      const isTerminal = TERMINAL_SCAN_STATES.includes(scan.status);

      if (!isTerminal) {
        if (!ownsMissionRuntime(scan.missionId)) {
          observedActiveScanIdsRef.current.add(scanId);
        }

        return;
      }

      if (!observedActiveScanIdsRef.current.has(scanId)) {
        return;
      }

      observedActiveScanIdsRef.current.delete(scanId);

      handleScanFinished(scan);
    });
  }, [handleScanFinished, scans]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (autoOpenTimerRef.current) {
        window.clearTimeout(autoOpenTimerRef.current);
      }

      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (focusType !== "scan" || !focusId) {
      handledExternalFocusRef.current = null;
      return;
    }

    const focusKey = String(focusId);

    if (handledExternalFocusRef.current === focusKey) {
      return;
    }

    const focusedScan = scans.find((scan) =>
      scanMatchesIdentity(scan, focusKey),
    );

    if (!focusedScan) {
      return;
    }

    handledExternalFocusRef.current = focusKey;

    let isCancelled = false;
    let modalFrameId = null;

    void focusOperationsWorkspace().then(() => {
      if (isCancelled) {
        return;
      }

      modalFrameId = window.requestAnimationFrame(() => {
        openScanResults(focusedScan);
      });
    });

    return () => {
      isCancelled = true;

      if (modalFrameId !== null) {
        window.cancelAnimationFrame(modalFrameId);
      }
    };
  }, [
    focusId,
    focusOperationsWorkspace,
    focusType,
    openScanResults,
    scans,
  ]);

  return (
    <section className="operations-workspace">
      <div className="operations-workspace-header">
        <div>
          <h2 className="operations-workspace-title">Operational Workspace</h2>

          <p className="operations-workspace-subtitle">
            Live operational telemetry, scan execution and mission activity.
          </p>
        </div>

        <div className="operations-workspace-stats">
          <span>
            <strong>{metrics.activeScans}</strong> Active Scans
          </span>

          <span>
            <strong>{totalTargets}</strong> Targets
          </span>

          <span>
            <strong>{missionMetrics.runningMissions}</strong> Running Missions
          </span>
        </div>
      </div>

      <div className="operations-row">
        <div className="operations-launch-slot">
          <ScanLaunchPanel />
        </div>

        <div className="operations-scans-slot">
          <RecentScansPanel
            focusType={focusType}
            focusId={focusId}
            onViewScan={openScanResults}
          />
        </div>

        <div className="operations-activity-slot">
          <ActivityFeed />
        </div>
      </div>

      <OperationsSummaryPanel />

      <FindingsSeverityPanel />

      <ScanResultsModal
        scan={selectedScan}
        isOpen={isScanResultsOpen}
        onClose={closeScanResults}
      />
    </section>
  );
}

export default OperationalWorkspace;
