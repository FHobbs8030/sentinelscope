import { useCallback, useEffect, useMemo, useState } from "react";

import FindingsContext from "./FindingsContext";

import {
  API_ERROR_CODES,
  ApiError,
  getApiErrorMessage,
} from "../services/api/apiClient";

import {
  getFindingsPage,
  getFindingsSummary,
} from "../services/api/findingsApi";

import { subscribeToBackendRecovery } from "../services/runtime/backendConnectionEvents";

const DEFAULT_FINDINGS_PAGE_SIZE = 50;
const FINDING_SEARCH_LIMIT = 25;

const createEmptyFindingsSummary = () => ({
  total: 0,
  severityMetrics: {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  },
  statusMetrics: {},
  findingExposureScore: 0,
  uniqueTargets: 0,
});

function FindingsProvider({ children }) {
  const [findings, setFindings] = useState([]);
  const [summary, setSummary] = useState(createEmptyFindingsSummary);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_FINDINGS_PAGE_SIZE,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);

  const loadFindings = useCallback(async ({ query = {}, signal } = {}) => {
    try {
      const normalizedQuery = {
        page: query.page ?? 1,
        limit: query.limit ?? DEFAULT_FINDINGS_PAGE_SIZE,
        severity: query.severity,
        status: query.status,
        target: query.target,
        search: query.search,
      };

      const summaryQuery = {
        severity: normalizedQuery.severity,
        status: normalizedQuery.status,
        target: normalizedQuery.target,
        search: normalizedQuery.search,
      };

      const [pageData, summaryData] = await Promise.all([
        getFindingsPage(normalizedQuery, { signal }),
        getFindingsSummary(summaryQuery, { signal }),
      ]);

      if (signal?.aborted) {
        return false;
      }

      setFindings(pageData.findings);
      setPagination(pageData.meta);
      setSummary(summaryData);
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

  const loadFindingsPage = useCallback(
    async (query = {}) => {
      setIsLoading(true);
      setError(null);

      return loadFindings({ query });
    },
    [loadFindings],
  );

  const refreshFindings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    return loadFindings({
      query: {
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  }, [loadFindings, pagination.limit, pagination.page]);

  const searchFindings = useCallback(
    async (search, requestOptions = {}) => {
      const normalizedSearch = String(search || "").trim();

      if (!normalizedSearch) {
        return [];
      }

      const pageData = await getFindingsPage(
        {
          page: 1,
          limit: requestOptions.limit ?? FINDING_SEARCH_LIMIT,
          search: normalizedSearch,
        },
        {
          signal: requestOptions.signal,
        },
      );

      return pageData.findings;
    },
    [],
  );

  useEffect(() => {
    const requestController = new AbortController();

    const requestTimer = window.setTimeout(() => {
      void loadFindings({
        query: {
          page: 1,
          limit: DEFAULT_FINDINGS_PAGE_SIZE,
        },
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

  const contextValue = useMemo(
    () => ({
      findings,
      setFindings,
      pagination,
      severityMetrics: summary.severityMetrics,
      statusMetrics: summary.statusMetrics,
      totalFindings: summary.total,
      findingExposureScore: summary.findingExposureScore,
      uniqueTargets: summary.uniqueTargets,
      isLoading,
      hasLoaded,
      error,
      loadFindingsPage,
      refreshFindings,
      searchFindings,
    }),
    [
      findings,
      pagination,
      summary,
      isLoading,
      hasLoaded,
      error,
      loadFindingsPage,
      refreshFindings,
      searchFindings,
    ],
  );

  return (
    <FindingsContext.Provider value={contextValue}>
      {children}
    </FindingsContext.Provider>
  );
}

export default FindingsProvider;
