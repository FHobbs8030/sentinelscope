import {
  activateMissionById,
  clearActiveMission,
  getActiveMission,
  getMissionQueue,
  getMissionQueueMetrics,
  subscribeMissionQueue,
} from "./missionQueue";

import { simulateMissionLifecycle } from "./missionSimulator";
import missionPersistenceReconciler from "./missionPersistenceReconciler";
import missionStore from "./missionStore";
import { MISSION_STATES } from "./missionStates";

import scanEventBus, { SCAN_EVENTS } from "../runtime/scanEventBus";
import scanRuntimeEngine from "../runtime/scanRuntimeEngine";
import { claimNextMission as claimNextMissionRecord } from "../api/missionsApi";

import { emitScanQueueDrained } from "../scanQueueEvents";

const SAFETY_PROCESS_INTERVAL_MS = 1000;
const SCAN_TERMINAL_POLL_MS = 250;
const MAX_SCAN_WAIT_MS = 60 * 60 * 1000;

const TERMINAL_SCAN_STATES = new Set([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);

const TERMINAL_SCAN_EVENTS = [
  SCAN_EVENTS.SCAN_COMPLETED,
  SCAN_EVENTS.SCAN_FAILED,
  SCAN_EVENTS.SCAN_CANCELLED,
];

const TERMINAL_MISSION_STATE_BY_SCAN_STATE = {
  completed: MISSION_STATES.COMPLETED,
  failed: MISSION_STATES.FAILED,
  cancelled: MISSION_STATES.CANCELLED,
  interrupted: MISSION_STATES.FAILED,
};

const getScanIdentifiers = (scan) => {
  return [scan?.id, scan?.mongoId, scan?._id].filter(Boolean).map(String);
};

const getMissionScanIdentifiers = (mission) => {
  return [mission?.scanId, mission?.scanMongoId].filter(Boolean).map(String);
};

const scanMatchesMission = (scan, mission) => {
  if (!scan || !mission) {
    return false;
  }

  if (
    scan.missionId &&
    mission.id &&
    String(scan.missionId) === String(mission.id)
  ) {
    return true;
  }

  const scanIdentifiers = getScanIdentifiers(scan);
  const missionScanIdentifiers = getMissionScanIdentifiers(mission);

  return scanIdentifiers.some((scanId) =>
    missionScanIdentifiers.includes(scanId),
  );
};

const getClaimedMissionId = (mission) => {
  return mission?.clientMissionId ?? mission?.id ?? mission?._id ?? null;
};

const buildClaimedMissionUpdates = (mission) => {
  return {
    mongoId: mission?.mongoId ?? mission?._id ?? null,
    state: mission?.state ?? MISSION_STATES.INITIALIZING,
    progress: mission?.progress ?? 0,
    scanId: mission?.scanId ?? null,
    scanMongoId: mission?.scanMongoId ?? null,
    claimedAt: mission?.claimedAt ?? null,
  };
};

class MissionQueueManager {
  constructor() {
    this.running = false;
    this.processingMission = false;
    this.claimingMission = false;

    this.intervalId = null;
    this.processTimerId = null;

    this.unsubscribeQueue = null;
    this.unsubscribeTerminalEvents = null;
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;

    scanEventBus.emitTelemetry("Mission queue manager started", {
      source: "mission-queue-manager",
      mode: "fifo-single-worker",
    });

    this.unsubscribeQueue = subscribeMissionQueue(() => {
      this.scheduleProcess();
    });

    this.unsubscribeTerminalEvents = scanEventBus.subscribeMany(
      TERMINAL_SCAN_EVENTS,
      () => {
        this.scheduleProcess();
      },
    );

    this.intervalId = window.setInterval(() => {
      this.scheduleProcess();
    }, SAFETY_PROCESS_INTERVAL_MS);

    this.scheduleProcess();
  }

  stop() {
    this.running = false;

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.processTimerId !== null) {
      window.clearTimeout(this.processTimerId);
      this.processTimerId = null;
    }

    this.unsubscribeQueue?.();
    this.unsubscribeQueue = null;

    this.unsubscribeTerminalEvents?.();
    this.unsubscribeTerminalEvents = null;
  }

  scheduleProcess() {
    if (
      !this.running ||
      this.processingMission ||
      this.claimingMission ||
      this.processTimerId !== null
    ) {
      return;
    }

    this.processTimerId = window.setTimeout(() => {
      this.processTimerId = null;
      void this.processNextMission();
    }, 0);
  }

  hasRuntimeScanInProgress() {
    return scanRuntimeEngine.getScans().some((scan) => {
      const status = String(scan?.status ?? "").toLowerCase();

      return status && !TERMINAL_SCAN_STATES.has(status);
    });
  }

  getRuntimeScanForMission(mission) {
    const matchingScans = scanRuntimeEngine
      .getScans()
      .filter((scan) => scanMatchesMission(scan, mission));

    return (
      matchingScans.find((scan) => {
        const status = String(scan?.status ?? "").toLowerCase();

        return status && !TERMINAL_SCAN_STATES.has(status);
      }) ??
      matchingScans[0] ??
      null
    );
  }

  async synchronizeMissionWithScan(mission, scan) {
    if (!mission?.id || !scan) {
      return;
    }

    const scanStatus = String(scan.status ?? "").toLowerCase();
    const terminalMissionState =
      TERMINAL_MISSION_STATE_BY_SCAN_STATE[scanStatus] ?? null;

    const updates = {
      scanId: scan.id ?? mission.scanId ?? null,
      scanMongoId: scan.mongoId ?? scan._id ?? mission.scanMongoId ?? null,
    };

    if (terminalMissionState) {
      updates.state = terminalMissionState;
      updates.progress =
        scanStatus === "completed"
          ? 100
          : (scan.progress ?? mission.progress ?? 0);
    } else {
      updates.state = MISSION_STATES.RUNNING;
      updates.progress = Math.max(Number(mission.progress) || 0, 50);
    }

    missionStore.updateMission(mission.id, updates);
    Object.assign(mission, updates);

    const latestMission = missionStore.getMission(mission.id) ?? mission;

    await missionPersistenceReconciler.persistLatest(latestMission);
  }

  waitForMissionScanTerminal(mission) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let pollId = null;
      let timeoutId = null;
      let unsubscribeTerminalEvents = () => {};

      const cleanup = () => {
        unsubscribeTerminalEvents();

        if (pollId !== null) {
          window.clearInterval(pollId);
        }

        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };

      const finish = (scan) => {
        if (settled || !scanMatchesMission(scan, mission)) {
          return;
        }

        const status = String(scan.status ?? "").toLowerCase();

        if (!TERMINAL_SCAN_STATES.has(status)) {
          return;
        }

        settled = true;
        cleanup();
        resolve(scan);
      };

      const inspectRuntime = () => {
        const matchingScan = scanRuntimeEngine
          .getScans()
          .find((scan) => scanMatchesMission(scan, mission));

        if (matchingScan) {
          finish(matchingScan);
        }
      };

      unsubscribeTerminalEvents = scanEventBus.subscribeMany(
        TERMINAL_SCAN_EVENTS,
        (event) => {
          finish(event?.payload?.scan);
        },
      );

      pollId = window.setInterval(inspectRuntime, SCAN_TERMINAL_POLL_MS);

      timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();

        reject(
          new Error(
            `Timed out waiting for queued scan ${mission.target} to finish.`,
          ),
        );
      }, MAX_SCAN_WAIT_MS);

      inspectRuntime();
    });
  }

  async processNextMission() {
    if (
      !this.running ||
      this.processingMission ||
      this.claimingMission ||
      !scanRuntimeEngine.isInitialized()
    ) {
      return;
    }

    let mission = getActiveMission();
    let existingScan = mission ? this.getRuntimeScanForMission(mission) : null;

    if (!mission) {
      if (getMissionQueue().length === 0) {
        return;
      }

      if (this.hasRuntimeScanInProgress()) {
        return;
      }

      let claimResponse;

      this.claimingMission = true;

      try {
        claimResponse = await claimNextMissionRecord();
      } catch (error) {
        console.error(
          "[MissionQueueManager] Failed to claim mission from backend:",
          error,
        );

        scanEventBus.emitTelemetry("Backend mission queue claim failed", {
          source: "mission-queue-manager",
          error: error?.message ?? "Unknown queue claim failure",
        });

        return;
      } finally {
        this.claimingMission = false;
      }

      if (claimResponse?.message !== "Mission claimed") {
        return;
      }

      const claimedMission = claimResponse?.data ?? null;
      const claimedMissionId = getClaimedMissionId(claimedMission);

      if (!claimedMission || !claimedMissionId) {
        console.error(
          "[MissionQueueManager] Backend claim response did not include a valid mission",
          claimResponse,
        );

        return;
      }

      const claimedMissionUpdates = buildClaimedMissionUpdates(claimedMission);

      missionStore.updateMission(claimedMissionId, claimedMissionUpdates);

      mission = activateMissionById(claimedMissionId, claimedMissionUpdates);

      if (!mission) {
        console.error(
          `[MissionQueueManager] Backend claimed mission ${claimedMissionId}, but it was not available in the local queue`,
        );

        return;
      }

      existingScan = this.getRuntimeScanForMission(mission);
    } else if (this.hasRuntimeScanInProgress() && !existingScan) {
      return;
    }

    this.processingMission = true;

    let terminalScan = null;

    scanEventBus.emitTelemetry(`Scan queue activated ${mission.target}`, {
      source: "mission-queue-manager",
      missionId: mission.id,
      recovered: Boolean(mission.queueRecovered),
      queuedRemaining: getMissionQueueMetrics().queued,
    });

    try {
      if (existingScan) {
        await this.synchronizeMissionWithScan(mission, existingScan);

        scanEventBus.emitTelemetry(
          `Recovered scan queue reattached to ${mission.target}`,
          {
            source: "mission-queue-manager",
            missionId: mission.id,
            scanId:
              existingScan.mongoId ??
              existingScan._id ??
              existingScan.id ??
              null,
            status: existingScan.status ?? "unknown",
          },
        );

        const existingStatus = String(existingScan.status ?? "").toLowerCase();

        terminalScan = TERMINAL_SCAN_STATES.has(existingStatus)
          ? existingScan
          : await this.waitForMissionScanTerminal(mission);
      } else {
        if (mission.queueRecovered) {
          scanEventBus.emitTelemetry(
            `Restarting recovered pre-runtime mission for ${mission.target}`,
            {
              source: "mission-queue-manager",
              missionId: mission.id,
            },
          );
        }

        await simulateMissionLifecycle(mission);

        terminalScan = await this.waitForMissionScanTerminal(mission);
      }

      if (terminalScan && mission.queueRecovered) {
        await this.synchronizeMissionWithScan(mission, terminalScan);
      }

      scanEventBus.emitTelemetry(`Queued scan finished for ${mission.target}`, {
        source: "mission-queue-manager",
        missionId: mission.id,
        scanId:
          terminalScan?.mongoId ??
          terminalScan?._id ??
          terminalScan?.id ??
          null,
        status: terminalScan?.status ?? "unknown",
        queuedRemaining: getMissionQueueMetrics().queued,
      });
    } catch (error) {
      console.error(
        `[MissionQueueManager] Failed processing ${mission.target}:`,
        error,
      );

      scanEventBus.emitTelemetry(
        `Queue processing failed for ${mission.target}`,
        {
          source: "mission-queue-manager",
          missionId: mission.id,
          error: error?.message ?? "Unknown queue failure",
        },
      );
    } finally {
      clearActiveMission(mission.id);
      this.processingMission = false;

      const queueMetrics = getMissionQueueMetrics();

      if (terminalScan && queueMetrics.queued === 0) {
        emitScanQueueDrained({
          scan: terminalScan,
          mission,
        });
      }

      this.scheduleProcess();
    }
  }
}

const missionQueueManager = new MissionQueueManager();

export default missionQueueManager;
