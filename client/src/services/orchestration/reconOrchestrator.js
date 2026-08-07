import {
  enqueueMission,
  removeMissionFromQueue,
} from "./missionQueue";

import { MISSION_STATES } from "./missionStates";

import missionStore from "./missionStore";

import scanEventBus from "../runtime/scanEventBus";

import missionPersistenceReconciler from "./missionPersistenceReconciler";

export function createMission({ target, type, profile, severity }) {
  return {
    id: crypto.randomUUID(),

    target,

    type,

    profile,

    severity,

    state: MISSION_STATES.QUEUED,

    progress: 0,

    createdAt: new Date().toISOString(),
  };
}

export async function cancelQueuedMission(missionId) {
  const mission = removeMissionFromQueue(missionId);

  if (!mission) {
    return false;
  }

  const queuedState = mission.state;

  try {
    const cancelledState = {
      state: MISSION_STATES.CANCELLED,
      progress: 0,
    };

    missionStore.updateMission(mission.id, cancelledState);
    Object.assign(mission, cancelledState);

    await missionPersistenceReconciler.persistLatest(mission);

    scanEventBus.emitTelemetry(
      `Queued scan removed for ${mission.target}`,
      {
        source: "recon-orchestrator",
        missionId: mission.id,
      },
    );

    return true;
  } catch (error) {
    const rollbackState = {
      state: queuedState ?? MISSION_STATES.QUEUED,
    };

    missionStore.updateMission(mission.id, rollbackState);
    Object.assign(mission, rollbackState);

    enqueueMission(mission);

    throw error;
  }
}

export async function launchMission({ target, type, profile, severity }) {
  const mission = createMission({
    target,
    type,
    profile,
    severity,
  });

  missionStore.addMission(mission);

  await missionPersistenceReconciler.persistCreate(mission);

  enqueueMission(mission);

  scanEventBus.emitTelemetry(`Recon mission queued for ${target}`, {
    source: "recon-orchestrator",
    missionId: mission.id,
    missionType: type,
    profile,
    severity,
  });

  return mission;
}
