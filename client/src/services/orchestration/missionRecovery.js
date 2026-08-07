import { recoverMissionQueue } from "./missionQueue";

import { MISSION_STATES } from "./missionStates";

let recoveryCompleted = false;

const RECOVERABLE_MISSION_STATES = new Set([
  MISSION_STATES.QUEUED,
  MISSION_STATES.INITIALIZING,
  MISSION_STATES.RUNNING,
]);

const ACTIVE_MISSION_STATES = new Set([
  MISSION_STATES.INITIALIZING,
  MISSION_STATES.RUNNING,
]);

const getMissionCreatedAt = (mission) => {
  const timestamp = Date.parse(mission?.createdAt ?? "");

  return Number.isFinite(timestamp)
    ? timestamp
    : Number.MAX_SAFE_INTEGER;
};

export function recoverMissions(missions) {
  if (recoveryCompleted) {
    return 0;
  }

  const recoveredMissions = (Array.isArray(missions) ? missions : [])
    .filter((mission) => {
      return RECOVERABLE_MISSION_STATES.has(mission?.state);
    })
    .sort((left, right) => {
      return getMissionCreatedAt(left) - getMissionCreatedAt(right);
    });

  const recoveredActiveMission =
    recoveredMissions.find((mission) => {
      return ACTIVE_MISSION_STATES.has(mission?.state);
    }) ?? null;

  const queuedMissions = recoveredMissions.filter((mission) => {
    return mission !== recoveredActiveMission;
  });

  recoverMissionQueue({
    activeMission: recoveredActiveMission,
    queuedMissions,
  });

  recoveryCompleted = true;

  console.info(
    `[MissionRecovery] Recovered ${recoveredMissions.length} mission(s) in FIFO order`,
  );

  return recoveredMissions.length;
}

export function resetMissionRecovery() {
  recoveryCompleted = false;
}
