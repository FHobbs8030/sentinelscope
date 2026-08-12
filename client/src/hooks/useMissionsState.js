import { useCallback, useEffect, useMemo, useState } from "react";

import { API_ERROR_CODES, ApiError } from "../services/api/apiClient";

import { getMissionQueueState, getMissions } from "../services/api/missionsApi";

import { recoverMissions } from "../services/orchestration/missionRecovery";
import missionStore from "../services/orchestration/missionStore";

import { subscribeToBackendRecovery } from "../services/runtime/backendConnectionEvents";

const normalizeMission = (mission) => {
  const mongoId = mission.mongoId ?? mission._id ?? null;

  return {
    ...mission,
    id: mission.clientMissionId ?? mission.id ?? mongoId,
    mongoId,
  };
};

const normalizeMissionCollection = (responseData) => {
  const missionData = Array.isArray(responseData)
    ? responseData
    : responseData?.data;

  if (!Array.isArray(missionData)) {
    throw new ApiError(
      "SentinelScope API returned an invalid mission collection.",
      {
        code: API_ERROR_CODES.INVALID_RESPONSE,
        details: responseData,
      },
    );
  }

  return missionData.map(normalizeMission);
};

const normalizeMissionQueueState = (responseData) => {
  const queueData = responseData?.data ?? responseData;

  if (
    !queueData ||
    typeof queueData !== "object" ||
    !Array.isArray(queueData.queuedMissions)
  ) {
    throw new ApiError(
      "SentinelScope API returned an invalid mission queue state.",
      {
        code: API_ERROR_CODES.INVALID_RESPONSE,
        details: responseData,
      },
    );
  }

  if (
    queueData.activeMission !== null &&
    queueData.activeMission !== undefined &&
    typeof queueData.activeMission !== "object"
  ) {
    throw new ApiError(
      "SentinelScope API returned an invalid active mission.",
      {
        code: API_ERROR_CODES.INVALID_RESPONSE,
        details: responseData,
      },
    );
  }

  return {
    ...queueData,
    activeMission: queueData.activeMission
      ? normalizeMission(queueData.activeMission)
      : null,
    queuedMissions: queueData.queuedMissions.map(normalizeMission),
  };
};

export default function useMissionsState() {
  const [missions, setMissions] = useState(missionStore.getMissions());

  const hydrateMissions = useCallback(async (requestOptions = {}) => {
    const { signal } = requestOptions;

    try {
      const response = await getMissions(requestOptions);

      if (signal?.aborted) {
        return false;
      }

     const normalizedMissions = normalizeMissionCollection(response);

     missionStore.setMissions(normalizedMissions);

     let normalizedQueueState = null;

     try {
       const queueResponse = await getMissionQueueState(requestOptions);

       if (signal?.aborted) {
         return false;
       }

       normalizedQueueState = normalizeMissionQueueState(queueResponse);
     } catch (error) {
       if (signal?.aborted) {
         return false;
       }

       console.warn(
         "[useMissions] Failed to hydrate backend queue state; using mission recovery fallback",
         error,
       );
     }

     recoverMissions(normalizedMissions, normalizedQueueState);

     return true;
    } catch (error) {
      if (signal?.aborted) {
        return false;
      }

      console.error(
        "[useMissions] Failed to hydrate missions from MongoDB",
        error,
      );

      return false;
    }
  }, []);

  useEffect(() => {
    const requestController = new AbortController();

    const unsubscribeStore = missionStore.subscribe((updatedMissions) => {
      setMissions(updatedMissions);
    });

    const requestTimer = window.setTimeout(() => {
      void hydrateMissions({
        signal: requestController.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(requestTimer);
      requestController.abort();
      unsubscribeStore();
    };
  }, [hydrateMissions]);

  useEffect(() => {
    const unsubscribeRecovery = subscribeToBackendRecovery(() => {
      void hydrateMissions();
    });

    return unsubscribeRecovery;
  }, [hydrateMissions]);

  const queuedMissions = useMemo(() => {
    return missions.filter((mission) => mission.state === "queued");
  }, [missions]);

  const runningMissions = useMemo(() => {
    return missions.filter(
      (mission) =>
        mission.state === "running" || mission.state === "initializing",
    );
  }, [missions]);

  const completedMissions = useMemo(() => {
    return missions.filter((mission) => mission.state === "completed");
  }, [missions]);

  const failedMissions = useMemo(() => {
    return missions.filter((mission) => mission.state === "failed");
  }, [missions]);

  const metrics = useMemo(() => {
    return {
      totalMissions: missions.length,
      queuedMissions: queuedMissions.length,
      runningMissions: runningMissions.length,
      completedMissions: completedMissions.length,
      failedMissions: failedMissions.length,
    };
  }, [
    missions.length,
    queuedMissions.length,
    runningMissions.length,
    completedMissions.length,
    failedMissions.length,
  ]);

  return {
    missions,
    queuedMissions,
    runningMissions,
    completedMissions,
    failedMissions,
    metrics,
    refreshMissions: hydrateMissions,
  };
}
