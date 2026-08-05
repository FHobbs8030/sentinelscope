import { useCallback, useEffect, useRef, useState } from "react";

import {
  API_ERROR_CODES,
  ApiError,
  getApiErrorMessage,
} from "../services/api/apiClient";

import { getBackendHealth } from "../services/api/healthApi";
import { announceBackendRecovery } from "../services/runtime/backendConnectionEvents";

export const BACKEND_HEALTH_STATES = Object.freeze({
  CHECKING: "checking",
  ONLINE: "online",
  OFFLINE: "offline",
});

const DEFAULT_POLL_INTERVAL_MS = 30000;

const useBackendHealth = ({
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
} = {}) => {
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState(BACKEND_HEALTH_STATES.CHECKING);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState(null);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const isMountedRef = useRef(false);
  const requestControllerRef = useRef(null);
  const previousStatusRef = useRef(BACKEND_HEALTH_STATES.CHECKING);

  const checkBackendHealth = useCallback(async () => {
    requestControllerRef.current?.abort();

    const requestController = new AbortController();

    requestControllerRef.current = requestController;

    if (isMountedRef.current) {
      setIsChecking(true);

      setStatus((currentStatus) => {
        return currentStatus === BACKEND_HEALTH_STATES.ONLINE
          ? currentStatus
          : BACKEND_HEALTH_STATES.CHECKING;
      });
    }

    try {
      const response = await getBackendHealth({
        signal: requestController.signal,
      });

      if (!isMountedRef.current || requestController.signal.aborted) {
        return false;
      }

      const backendIsOnline = response?.status === "online";

      const nextStatus = backendIsOnline
        ? BACKEND_HEALTH_STATES.ONLINE
        : BACKEND_HEALTH_STATES.OFFLINE;

      const backendRecovered =
        backendIsOnline &&
        previousStatusRef.current === BACKEND_HEALTH_STATES.OFFLINE;

      const checkedAt = new Date();

      previousStatusRef.current = nextStatus;

      setHealth(response);
      setStatus(nextStatus);
      setError(
        backendIsOnline ? null : "The backend did not report an online status.",
      );
      setLastCheckedAt(checkedAt);

      if (backendRecovered) {
        announceBackendRecovery({
          service: response?.service ?? null,
          recoveredAt: checkedAt.toISOString(),
        });
      }

      return backendIsOnline;
    } catch (requestError) {
      const requestWasCancelled =
        requestController.signal.aborted ||
        (requestError instanceof ApiError &&
          requestError.code === API_ERROR_CODES.ABORTED);

      if (requestWasCancelled || !isMountedRef.current) {
        return false;
      }

      previousStatusRef.current = BACKEND_HEALTH_STATES.OFFLINE;

      setHealth(null);
      setStatus(BACKEND_HEALTH_STATES.OFFLINE);
      setError(
        getApiErrorMessage(
          requestError,
          "Unable to verify the SentinelScope backend connection.",
        ),
      );
      setLastCheckedAt(new Date());

      return false;
    } finally {
      if (
        isMountedRef.current &&
        requestControllerRef.current === requestController
      ) {
        setIsChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const initialCheckId = window.setTimeout(() => {
      void checkBackendHealth();
    }, 0);

    const intervalId =
      pollIntervalMs > 0
        ? window.setInterval(() => {
            void checkBackendHealth();
          }, pollIntervalMs)
        : null;

    const handleBrowserOnline = () => {
      void checkBackendHealth();
    };

    const handleBrowserOffline = () => {
      requestControllerRef.current?.abort();
      previousStatusRef.current = BACKEND_HEALTH_STATES.OFFLINE;

      if (!isMountedRef.current) {
        return;
      }

      setHealth(null);
      setStatus(BACKEND_HEALTH_STATES.OFFLINE);
      setIsChecking(false);
      setError("The device is offline.");
      setLastCheckedAt(new Date());
    };

    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("offline", handleBrowserOffline);

    return () => {
      isMountedRef.current = false;

      window.clearTimeout(initialCheckId);
      requestControllerRef.current?.abort();

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }

      window.removeEventListener("online", handleBrowserOnline);
      window.removeEventListener("offline", handleBrowserOffline);
    };
  }, [checkBackendHealth, pollIntervalMs]);

  return {
    health,
    status,
    isChecking,
    isOnline: status === BACKEND_HEALTH_STATES.ONLINE,
    isOffline: status === BACKEND_HEALTH_STATES.OFFLINE,
    error,
    lastCheckedAt,
    refresh: checkBackendHealth,
  };
};

export default useBackendHealth;
