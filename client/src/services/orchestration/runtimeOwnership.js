let memoryRuntimeOwnerId = null;

const ownedMissionIds = new Set();

function createRuntimeOwnerId() {
  return `runtime-${crypto.randomUUID()}`;
}

export function getRuntimeOwnerId() {
  if (!memoryRuntimeOwnerId) {
    memoryRuntimeOwnerId = createRuntimeOwnerId();
  }

  return memoryRuntimeOwnerId;
}

export function markMissionRuntimeOwned(missionId) {
  if (!missionId) {
    return;
  }

  ownedMissionIds.add(String(missionId));
}

export function clearMissionRuntimeOwned(missionId) {
  if (!missionId) {
    return;
  }

  ownedMissionIds.delete(String(missionId));
}

export function ownsMissionRuntime(missionId) {
  if (!missionId) {
    return false;
  }

  return ownedMissionIds.has(String(missionId));
}
