import scanEventBus from "../runtime/scanEventBus";

const missionQueue = [];
const listeners = new Set();

let activeMission = null;
let snapshot = null;

const buildSnapshot = () => {
  const queuedMissions = [...missionQueue];
  const metrics = {
    queued: queuedMissions.length,
    active: activeMission ? 1 : 0,
    total: queuedMissions.length + (activeMission ? 1 : 0),
    busy: Boolean(activeMission) || queuedMissions.length > 0,
  };

  return {
    activeMission,
    queuedMissions,
    metrics,
  };
};

const publishQueueState = () => {
  snapshot = buildSnapshot();

  scanEventBus.emitQueueUpdated(snapshot.metrics);

  listeners.forEach((listener) => {
    listener();
  });
};

snapshot = buildSnapshot();

export function enqueueMission(mission) {
  missionQueue.push(mission);
  publishQueueState();

  return mission;
}

export function dequeueMission() {
  const mission = missionQueue.shift() ?? null;

  publishQueueState();

  return mission;
}

export function activateNextMission() {
  if (activeMission || missionQueue.length === 0) {
    return null;
  }

  activeMission = missionQueue.shift() ?? null;
  publishQueueState();

  return activeMission;
}

export function clearActiveMission(missionId = null) {
  if (!activeMission) {
    return null;
  }

  if (
    missionId &&
    String(activeMission.id) !== String(missionId)
  ) {
    return null;
  }

  const completedMission = activeMission;

  activeMission = null;
  publishQueueState();

  return completedMission;
}

export function removeMissionFromQueue(missionId) {
  const missionIndex = missionQueue.findIndex((mission) => {
    return mission?.id && String(mission.id) === String(missionId);
  });

  if (missionIndex < 0) {
    return null;
  }

  const [removedMission] = missionQueue.splice(missionIndex, 1);

  publishQueueState();

  return removedMission ?? null;
}

export function getMissionQueue() {
  return [...missionQueue];
}

export function getActiveMission() {
  return activeMission;
}

export function clearMissionQueue() {
  missionQueue.length = 0;
  publishQueueState();
}

export function getMissionQueueMetrics() {
  return {
    ...snapshot.metrics,
  };
}

export function getMissionQueueSnapshot() {
  return snapshot;
}

export function subscribeMissionQueue(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
