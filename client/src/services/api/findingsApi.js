import { API_ERROR_CODES, ApiError, apiRequest } from "./apiClient";

const FINDINGS_PATH = "findings";
const FINDINGS_SUMMARY_PATH = `${FINDINGS_PATH}/summary`;
const FINDINGS_BATCH_PATH = `${FINDINGS_PATH}/batch`;

const DEFAULT_FINDINGS_PAGE = 1;
const DEFAULT_FINDINGS_PAGE_SIZE = 50;

const buildFindingPath = (id) => {
  return `${FINDINGS_PATH}/${encodeURIComponent(String(id))}`;
};

const normalizeFindingCollection = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.findings)) {
    return responseData.findings;
  }

  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }

  throw new ApiError(
    "SentinelScope API returned an invalid finding collection.",
    {
      code: API_ERROR_CODES.INVALID_RESPONSE,
      details: responseData,
    },
  );
};

const appendQueryValue = (params, key, value) => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  params.set(key, String(value));
};

const buildFindingsQuery = ({
  page,
  limit,
  severity,
  status,
  target,
  search,
} = {}) => {
  const params = new URLSearchParams();

  appendQueryValue(params, "page", page);
  appendQueryValue(params, "limit", limit);
  appendQueryValue(params, "severity", severity);
  appendQueryValue(params, "status", status);
  appendQueryValue(params, "target", target);
  appendQueryValue(params, "search", search);

  return params.toString();
};

const buildFindingsRequestPath = (path, query = {}) => {
  const queryString = buildFindingsQuery(query);

  return queryString ? `${path}?${queryString}` : path;
};

const normalizeFindingsPage = (
  responseData,
  {
    page = DEFAULT_FINDINGS_PAGE,
    limit = DEFAULT_FINDINGS_PAGE_SIZE,
  } = {},
) => {
  const findings = normalizeFindingCollection(responseData);
  const total =
    typeof responseData?.total === "number"
      ? responseData.total
      : findings.length;

  const totalPages =
    typeof responseData?.meta?.totalPages === "number"
      ? responseData.meta.totalPages
      : total === 0
        ? 0
        : Math.ceil(total / limit);

  return {
    findings,
    total,
    meta: {
      page:
        typeof responseData?.meta?.page === "number"
          ? responseData.meta.page
          : page,
      limit:
        typeof responseData?.meta?.limit === "number"
          ? responseData.meta.limit
          : limit,
      totalPages,
      hasNextPage:
        typeof responseData?.meta?.hasNextPage === "boolean"
          ? responseData.meta.hasNextPage
          : page < totalPages,
      hasPreviousPage:
        typeof responseData?.meta?.hasPreviousPage === "boolean"
          ? responseData.meta.hasPreviousPage
          : page > 1 && totalPages > 0,
    },
  };
};

const normalizeFindingsSummary = (responseData) => {
  const summary = responseData?.data;

  if (
    !summary ||
    typeof summary !== "object" ||
    !summary.severityMetrics ||
    typeof summary.severityMetrics !== "object"
  ) {
    throw new ApiError(
      "SentinelScope API returned an invalid findings summary.",
      {
        code: API_ERROR_CODES.INVALID_RESPONSE,
        details: responseData,
      },
    );
  }

  const total =
    typeof responseData?.total === "number"
      ? responseData.total
      : Number(summary.severityMetrics.total) || 0;

  return {
    total,
    severityMetrics: {
      total,
      critical: Number(summary.severityMetrics.critical) || 0,
      high: Number(summary.severityMetrics.high) || 0,
      medium: Number(summary.severityMetrics.medium) || 0,
      low: Number(summary.severityMetrics.low) || 0,
      informational: Number(summary.severityMetrics.informational) || 0,
    },
    statusMetrics:
      summary.statusMetrics && typeof summary.statusMetrics === "object"
        ? summary.statusMetrics
        : {},
    findingExposureScore: Number(summary.findingExposureScore) || 0,
    uniqueTargets: Number(summary.uniqueTargets) || 0,
  };
};

export async function createFinding(findingData, requestOptions = {}) {
  return apiRequest(FINDINGS_PATH, {
    ...requestOptions,
    method: "POST",
    body: findingData,
  });
}

export async function createFindingsBatch(findings, requestOptions = {}) {
  const responseData = await apiRequest(FINDINGS_BATCH_PATH, {
    ...requestOptions,
    method: "POST",
    body: {
      findings,
    },
  });

  const persistedFindings = normalizeFindingCollection(responseData);

  const expectedCount = findings.length;
  const persistedCount = persistedFindings.length;

  if (
    persistedCount !== expectedCount ||
    (typeof responseData?.total === "number" &&
      responseData.total !== expectedCount)
  ) {
    throw new ApiError(
      "SentinelScope API returned an incomplete finding batch.",
      {
        code: API_ERROR_CODES.INVALID_RESPONSE,
        details: {
          expectedCount,
          persistedCount,
          responseData,
        },
      },
    );
  }

  return responseData;
}

export async function getFindings(requestOptions = {}) {
  const responseData = await apiRequest(FINDINGS_PATH, requestOptions);

  return normalizeFindingCollection(responseData);
}

export async function getFindingsPage(query = {}, requestOptions = {}) {
  const normalizedQuery = {
    page: query.page ?? DEFAULT_FINDINGS_PAGE,
    limit: query.limit ?? DEFAULT_FINDINGS_PAGE_SIZE,
    severity: query.severity,
    status: query.status,
    target: query.target,
    search: query.search,
  };

  const responseData = await apiRequest(
    buildFindingsRequestPath(FINDINGS_PATH, normalizedQuery),
    requestOptions,
  );

  return normalizeFindingsPage(responseData, normalizedQuery);
}

export async function getFindingsSummary(query = {}, requestOptions = {}) {
  const responseData = await apiRequest(
    buildFindingsRequestPath(FINDINGS_SUMMARY_PATH, query),
    requestOptions,
  );

  return normalizeFindingsSummary(responseData);
}

export async function getFindingById(id, requestOptions = {}) {
  return apiRequest(buildFindingPath(id), requestOptions);
}

export async function updateFinding(id, updates, requestOptions = {}) {
  return apiRequest(buildFindingPath(id), {
    ...requestOptions,
    method: "PATCH",
    body: updates,
  });
}
