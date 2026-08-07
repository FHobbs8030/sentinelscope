import { useCallback, useEffect, useMemo, useState } from "react";

import AlertsContext from "./AlertsContext";

import {
  acknowledgeAlert,
  closeAlert,
  getAlerts,
  investigateAlert,
  resolveAlert,
} from "../services/api/alertsApi";

import {
  API_ERROR_CODES,
  ApiError,
  getApiErrorMessage,
} from "../services/api/apiClient";

import { generateCorrelationAssessment } from "../services/intelligence/correlationEngine";
import { subscribeToAlertCreated } from "../services/alertEvents";
import { subscribeToBackendRecovery } from "../services/runtime/backendConnectionEvents";

import {
  calculateAlertMetrics,
  calculateAlertRiskScore,
} from "../utils/alertMetrics";

function AlertsProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [campaignAssessment, setCampaignAssessment] = useState(null);

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  const loadAlerts = useCallback(async (requestOptions = {}) => {
    const { signal } = requestOptions;

    try {
      const alertData = await getAlerts(requestOptions);

      if (signal?.aborted) {
        return false;
      }

      setAlerts(alertData);
      setCampaignAssessment(generateCorrelationAssessment(alertData));

      setHasLoaded(true);
      setError(null);

      return true;
    } catch (err) {
      const wasCancelled =
        signal?.aborted ||
        (err instanceof ApiError && err.code === API_ERROR_CODES.ABORTED);

      if (wasCancelled) {
        return false;
      }

      console.error("[AlertsProvider] Failed to hydrate alerts", err);

      setError(
        getApiErrorMessage(
          err,
          "Unable to load alert intelligence. Try again.",
        ),
      );

      return false;
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    return loadAlerts();
  }, [loadAlerts]);

  const runAlertAction = useCallback(
    async (action, alertId, fallbackMessage) => {
      try {
        setIsUpdating(true);
        setError(null);

        await action(alertId);

        return loadAlerts();
      } catch (err) {
        console.error(`Failed to update alert ${alertId}:`, err);

        setError(getApiErrorMessage(err, fallbackMessage));

        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [loadAlerts],
  );

  const runAlertBulkAction = useCallback(
    async (action, alertIds, failureLabel) => {
      const normalizedAlertIds = [
        ...new Set(
          alertIds
            .filter(Boolean)
            .map((alertId) => String(alertId)),
        ),
      ];

      if (normalizedAlertIds.length === 0) {
        return {
          succeededIds: [],
          failedIds: [],
        };
      }

      try {
        setIsUpdating(true);
        setError(null);

        const results = await Promise.allSettled(
          normalizedAlertIds.map((alertId) => action(alertId)),
        );

        const succeededIds = [];
        const failedIds = [];

        results.forEach((result, index) => {
          const alertId = normalizedAlertIds[index];

          if (result.status === "fulfilled") {
            succeededIds.push(alertId);
          } else {
            failedIds.push(alertId);
          }
        });

        await loadAlerts();

        if (failedIds.length > 0) {
          setError(
            `${failedIds.length} of ${normalizedAlertIds.length} selected alerts could not be ${failureLabel}.`,
          );
        }

        return {
          succeededIds,
          failedIds,
        };
      } catch (err) {
        console.error("Failed to update selected alerts:", err);

        setError(
          getApiErrorMessage(
            err,
            "Unable to update the selected alerts. Try again.",
          ),
        );

        return {
          succeededIds: [],
          failedIds: normalizedAlertIds,
        };
      } finally {
        setIsUpdating(false);
      }
    },
    [loadAlerts],
  );

  const acknowledge = useCallback(
    async (alertId) => {
      return runAlertAction(
        acknowledgeAlert,
        alertId,
        "Unable to acknowledge the alert. Try again.",
      );
    },
    [runAlertAction],
  );

  const investigate = useCallback(
    async (alertId) => {
      return runAlertAction(
        investigateAlert,
        alertId,
        "Unable to begin the alert investigation. Try again.",
      );
    },
    [runAlertAction],
  );

  const resolve = useCallback(
    async (alertId) => {
      return runAlertAction(
        resolveAlert,
        alertId,
        "Unable to resolve the alert. Try again.",
      );
    },
    [runAlertAction],
  );

  const close = useCallback(
    async (alertId) => {
      return runAlertAction(
        closeAlert,
        alertId,
        "Unable to close the alert. Try again.",
      );
    },
    [runAlertAction],
  );

  const acknowledgeMany = useCallback(
    async (alertIds) => {
      return runAlertBulkAction(
        acknowledgeAlert,
        alertIds,
        "acknowledged",
      );
    },
    [runAlertBulkAction],
  );

  const investigateMany = useCallback(
    async (alertIds) => {
      return runAlertBulkAction(
        investigateAlert,
        alertIds,
        "moved into investigation",
      );
    },
    [runAlertBulkAction],
  );

  const resolveMany = useCallback(
    async (alertIds) => {
      return runAlertBulkAction(
        resolveAlert,
        alertIds,
        "resolved",
      );
    },
    [runAlertBulkAction],
  );

  const closeMany = useCallback(
    async (alertIds) => {
      return runAlertBulkAction(
        closeAlert,
        alertIds,
        "closed",
      );
    },
    [runAlertBulkAction],
  );

  const metrics = useMemo(() => {
    return calculateAlertMetrics(alerts);
  }, [alerts]);

  const alertRiskScore = useMemo(() => {
    return calculateAlertRiskScore(alerts);
  }, [alerts]);

  useEffect(() => {
    const requestController = new AbortController();

    const requestTimer = window.setTimeout(() => {
      void loadAlerts({
        signal: requestController.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(requestTimer);
      requestController.abort();
    };
  }, [loadAlerts]);

  useEffect(() => {
    const unsubscribeRecovery = subscribeToBackendRecovery(() => {
      void refreshAlerts();
    });

    return unsubscribeRecovery;
  }, [refreshAlerts]);

  useEffect(() => {
    let refreshTimerId = null;

    const unsubscribeAlertCreated = subscribeToAlertCreated(() => {
      if (refreshTimerId !== null) {
        window.clearTimeout(refreshTimerId);
      }

      refreshTimerId = window.setTimeout(() => {
        refreshTimerId = null;
        void loadAlerts();
      }, 120);
    });

    return () => {
      unsubscribeAlertCreated();

      if (refreshTimerId !== null) {
        window.clearTimeout(refreshTimerId);
      }
    };
  }, [loadAlerts]);

  const contextValue = useMemo(
    () => ({
      alerts,
      setAlerts,
      metrics,
      alertRiskScore,
      campaignAssessment,
      loading,
      hasLoaded,
      isUpdating,
      error,
      refreshAlerts,
      acknowledge,
      investigate,
      resolve,
      close,
      acknowledgeMany,
      investigateMany,
      resolveMany,
      closeMany,
    }),
    [
      alerts,
      metrics,
      alertRiskScore,
      campaignAssessment,
      loading,
      hasLoaded,
      isUpdating,
      error,
      refreshAlerts,
      acknowledge,
      investigate,
      resolve,
      close,
      acknowledgeMany,
      investigateMany,
      resolveMany,
      closeMany,
    ],
  );

  return (
    <AlertsContext.Provider value={contextValue}>
      {children}
    </AlertsContext.Provider>
  );
}

export default AlertsProvider;
