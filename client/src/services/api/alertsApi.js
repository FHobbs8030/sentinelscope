import { API_ERROR_CODES, ApiError, apiRequest } from "./apiClient";

import { emitAlertCreated } from "../alertEvents";

const ALERTS_PATH = "alerts";

const buildAlertPath = (id, action = "") => {
  const encodedId = encodeURIComponent(String(id));
  const basePath = `${ALERTS_PATH}/${encodedId}`;

  return action ? `${basePath}/${action}` : basePath;
};

const normalizeAlertCollection = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.alerts)) {
    return responseData.alerts;
  }

  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }

  throw new ApiError(
    "SentinelScope API returned an invalid alert collection.",
    {
      code: API_ERROR_CODES.INVALID_RESPONSE,
      details: responseData,
    },
  );
};

export async function createAlert(alertData, requestOptions = {}) {
  const response = await apiRequest(ALERTS_PATH, {
    ...requestOptions,
    method: "POST",
    body: alertData,
  });

  emitAlertCreated({
    alert: response?.data ?? response ?? null,
    requestedAlert: alertData,
  });

  return response;
}

export async function getAlerts(requestOptions = {}) {
  const responseData = await apiRequest(ALERTS_PATH, requestOptions);

  return normalizeAlertCollection(responseData);
}

export async function getAlertById(id, requestOptions = {}) {
  return apiRequest(buildAlertPath(id), requestOptions);
}

export async function updateAlert(id, updates, requestOptions = {}) {
  return apiRequest(buildAlertPath(id), {
    ...requestOptions,
    method: "PATCH",
    body: updates,
  });
}

export async function acknowledgeAlert(id, requestOptions = {}) {
  return apiRequest(buildAlertPath(id, "acknowledge"), {
    ...requestOptions,
    method: "PATCH",
  });
}

export async function investigateAlert(id, requestOptions = {}) {
  return apiRequest(buildAlertPath(id, "investigate"), {
    ...requestOptions,
    method: "PATCH",
  });
}

export async function resolveAlert(id, requestOptions = {}) {
  return apiRequest(buildAlertPath(id, "resolve"), {
    ...requestOptions,
    method: "PATCH",
  });
}

export async function closeAlert(id, requestOptions = {}) {
  return apiRequest(buildAlertPath(id, "close"), {
    ...requestOptions,
    method: "PATCH",
  });
}
