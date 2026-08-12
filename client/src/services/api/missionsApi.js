import { apiRequest } from "./apiClient";

const MISSIONS_PATH = "missions";

const buildMissionPath = (id) => {
  return `${MISSIONS_PATH}/${encodeURIComponent(String(id))}`;
};

export async function createMission(missionData, requestOptions = {}) {
  return apiRequest(MISSIONS_PATH, {
    ...requestOptions,
    method: "POST",
    body: missionData,
  });
}

export async function getMissions(requestOptions = {}) {
  return apiRequest(MISSIONS_PATH, requestOptions);
}

export async function getMissionQueueState(requestOptions = {}) {
  return apiRequest(`${MISSIONS_PATH}/queue/state`, requestOptions);
}

export async function claimNextMission(requestOptions = {}) {
  return apiRequest(`${MISSIONS_PATH}/queue/claim`, {
    ...requestOptions,
    method: "POST",
  });
}

export async function acquireMissionRuntimeLease(
  id,
  runtimeOwnerId,
  requestOptions = {},
) {
  return apiRequest(`${buildMissionPath(id)}/runtime/lease`, {
    ...requestOptions,
    method: "POST",
    body: {
      runtimeOwnerId,
    },
  });
}

export async function updateMission(id, updates, requestOptions = {}) {
  return apiRequest(buildMissionPath(id), {
    ...requestOptions,
    method: "PATCH",
    body: updates,
  });
}
