import { useCallback, useEffect, useMemo, useState } from "react";

import {
  API_ERROR_CODES,
  ApiError,
  getApiErrorMessage,
} from "../services/api/apiClient";

import { getScans } from "../services/api/scansApi";

import { subscribeToBackendRecovery } from "../services/runtime/backendConnectionEvents";

import { bootstrapRuntime } from "../services/runtime/runtimeBootstrap";
import scanRuntimeEngine from "../services/runtime/scanRuntimeEngine";
import { TERMINAL_SCAN_STATES } from "../services/runtime/scanStateMachine";

import { rebuildRuntimeScans } from "./runtimeRecovery";

const ACTIVE_SCAN_STATES = [
  "queued",
  "initializing",
  "recon",
  "enumeration",
  "analysis",
  "exploitation",
  "reporting",
];

const useScans = () => {
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadScans = useCallback(async (requestOptions = {}) => {
    const { signal } = requestOptions;

    try {
      const persistedScans = await getScans(requestOptions);

      if (signal?.aborted) {
        return false;
      }

      const runtimeScans = rebuildRuntimeScans(persistedScans);

      bootstrapRuntime(runtimeScans);

      setScans(scanRuntimeEngine.getScans());
      setError(null);

      return true;
    } catch (err) {
      const wasCancelled =
        signal?.aborted ||
        (err instanceof ApiError && err.code === API_ERROR_CODES.ABORTED);

      if (wasCancelled) {
        return false;
      }

      console.error("Failed to load scans:", err);

      setError(
        getApiErrorMessage(err, "Unable to load scan telemetry. Try again."),
      );

      return false;
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const refreshScans = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    return loadScans();
  }, [loadScans]);

  const selectScanById = useCallback(async (scanId) => {
    try {
      const currentScans = scanRuntimeEngine.getScans();

      const scan = currentScans.find((item) => item.id === scanId) ?? null;

      setSelectedScan(scan);

      return scan;
    } catch (err) {
      console.error("Failed to retrieve scan:", err);

      setError("Unable to retrieve scan details.");

      return null;
    }
  }, []);

  const clearSelectedScan = useCallback(() => {
    setSelectedScan(null);
  }, []);

  const getScansByTarget = useCallback((target) => {
    try {
      const currentScans = scanRuntimeEngine.getScans();

      return currentScans.filter((scan) =>
        scan.target?.toLowerCase().includes(target.toLowerCase()),
      );
    } catch (err) {
      console.error("Failed to retrieve target scans:", err);

      setError("Unable to retrieve target scan data.");

      return [];
    }
  }, []);

  const getScansByType = useCallback((type) => {
    try {
      const currentScans = scanRuntimeEngine.getScans();

      return currentScans.filter(
        (scan) => scan.type?.toLowerCase() === type.toLowerCase(),
      );
    } catch (err) {
      console.error("Failed to retrieve scan type data:", err);

      setError("Unable to retrieve scan type data.");

      return [];
    }
  }, []);

  const addScan = useCallback((scan) => {
    scanRuntimeEngine.addScan(scan);
  }, []);

  const cancelScan = useCallback((scanId) => {
    scanRuntimeEngine.cancelScan(scanId);
  }, []);

  const removeScan = useCallback((scanId) => {
    scanRuntimeEngine.removeScan(scanId);
  }, []);

  const activeScans = useMemo(() => {
    return scans.filter((scan) => ACTIVE_SCAN_STATES.includes(scan.status));
  }, [scans]);

  const completedScans = useMemo(() => {
    return scans.filter((scan) => scan.status === "completed");
  }, [scans]);

  const failedScans = useMemo(() => {
    return scans.filter((scan) => scan.status === "failed");
  }, [scans]);

  const interruptedScans = useMemo(() => {
    return scans.filter((scan) => scan.status === "interrupted");
  }, [scans]);

  const criticalScans = useMemo(() => {
    return scans.filter((scan) => scan.severity?.toLowerCase() === "critical");
  }, [scans]);

  const queuedScans = useMemo(() => {
    return scans.filter((scan) => scan.status === "queued");
  }, [scans]);

  const initializingScans = useMemo(() => {
    return scans.filter((scan) => scan.status === "initializing");
  }, [scans]);

  const runningScans = useMemo(() => {
    return scans.filter(
      (scan) =>
        scan.status !== "queued" &&
        scan.status !== "completed" &&
        scan.status !== "failed" &&
        scan.status !== "cancelled" &&
        scan.status !== "interrupted",
    );
  }, [scans]);

  const liveScans = useMemo(() => {
    return scans.filter((scan) => !TERMINAL_SCAN_STATES.includes(scan.status));
  }, [scans]);

  const criticalFindingsCount = useMemo(() => {
    return scans.reduce((total, scan) => {
      if (scan.severity?.toLowerCase() === "critical") {
        return total + (scan.findingsCount ?? 0);
      }

      return total;
    }, 0);
  }, [scans]);

  const metrics = useMemo(() => {
    const totalScans = scans.length;
    const completedCount = completedScans.length;
    const failedCount = failedScans.length;
    const activeCount = activeScans.length;
    const interruptedCount = interruptedScans.length;

    const successRate =
      totalScans > 0 ? Math.round((completedCount / totalScans) * 100) : 0;

    const averageFindings =
      totalScans > 0
        ? Math.round(
            scans.reduce(
              (total, scan) => total + (scan.findingsCount ?? 0),
              0,
            ) / totalScans,
          )
        : 0;

    return {
      totalScans,
      activeScans: activeCount,
      completedScans: completedCount,
      failedScans: failedCount,
      interruptedScans: interruptedCount,
      successRate,
      criticalFindings: criticalFindingsCount,
      averageFindings,
    };
  }, [
    scans,
    activeScans,
    completedScans,
    failedScans,
    interruptedScans,
    criticalFindingsCount,
  ]);

  useEffect(() => {
    const requestController = new AbortController();

    const requestTimer = window.setTimeout(() => {
      void loadScans({
        signal: requestController.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(requestTimer);
      requestController.abort();
    };
  }, [loadScans]);

  useEffect(() => {
    const unsubscribeRecovery = subscribeToBackendRecovery(() => {
      void refreshScans();
    });

    return unsubscribeRecovery;
  }, [refreshScans]);

  useEffect(() => {
    const unsubscribeRuntime = scanRuntimeEngine.subscribe((updatedScans) => {
      setScans(updatedScans);

      setSelectedScan((previousSelectedScan) => {
        if (!previousSelectedScan) {
          return null;
        }

        return (
          updatedScans.find((scan) => scan.id === previousSelectedScan.id) ??
          null
        );
      });
    });

    return unsubscribeRuntime;
  }, []);

  return {
    scans,
    activeScans,
    completedScans,
    failedScans,
    interruptedScans,
    criticalScans,
    queuedScans,
    initializingScans,
    runningScans,
    liveScans,
    metrics,
    selectedScan,
    isLoading,
    error,
    refreshScans,
    selectScanById,
    clearSelectedScan,
    getScansByTarget,
    getScansByType,
    addScan,
    cancelScan,
    removeScan,
    criticalFindingsCount,
  };
};

export default useScans;
