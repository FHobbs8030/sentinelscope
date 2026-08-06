import { useCallback, useEffect, useMemo, useState } from "react";

import FindingsContext from "./FindingsContext";

import {
  API_ERROR_CODES,
  ApiError,
  getApiErrorMessage,
} from "../services/api/apiClient";

import { getFindings } from "../services/api/findingsApi";

import { subscribeToBackendRecovery } from "../services/runtime/backendConnectionEvents";

import {
  calculateFindingExposureScore,
  calculateSeverityMetrics,
} from "../utils/findings/severityMetrics";

function FindingsProvider({ children }) {
  const [findings, setFindings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);

  const loadFindings = useCallback(async (requestOptions = {}) => {
    const { signal } = requestOptions;

    try {
      const findingData = await getFindings(requestOptions);

      if (signal?.aborted) {
        return false;
      }

      setFindings(findingData);
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

      console.error("[FindingsProvider] Failed to hydrate findings", err);

      setError(
        getApiErrorMessage(
          err,
          "Unable to load finding intelligence. Try again.",
        ),
      );

      return false;
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const refreshFindings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    return loadFindings();
  }, [loadFindings]);

  useEffect(() => {
    const requestController = new AbortController();

    const requestTimer = window.setTimeout(() => {
      void loadFindings({
        signal: requestController.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(requestTimer);
      requestController.abort();
    };
  }, [loadFindings]);

  useEffect(() => {
    const unsubscribeRecovery = subscribeToBackendRecovery(() => {
      void refreshFindings();
    });

    return unsubscribeRecovery;
  }, [refreshFindings]);

  const severityMetrics = useMemo(() => {
    return calculateSeverityMetrics(findings);
  }, [findings]);

  const findingExposureScore = useMemo(() => {
    return calculateFindingExposureScore(findings);
  }, [findings]);

  const contextValue = useMemo(
    () => ({
      findings,
      setFindings,
      severityMetrics,
      totalFindings: severityMetrics.total,
      findingExposureScore,
      isLoading,
      hasLoaded,
      error,
      refreshFindings,
    }),
    [
      findings,
      severityMetrics,
      findingExposureScore,
      isLoading,
      hasLoaded,
      error,
      refreshFindings,
    ],
  );

  return (
    <FindingsContext.Provider value={contextValue}>
      {children}
    </FindingsContext.Provider>
  );
}

export default FindingsProvider;
