import {
  activateNextMission,
  clearActiveMission,
  getMissionQueueMetrics,
  subscribeMissionQueue,
} from "./missionQueue";

import { simulateMissionLifecycle } from "./missionSimulator";

import scanEventBus, {
  SCAN_EVENTS,
} from "../runtime/scanEventBus";
import scanRuntimeEngine from "../runtime/scanRuntimeEngine";

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

const getScanIdentifiers = (scan) => {
  return [scan?.id, scan?.mongoId, scan?._id]
    .filter(Boolean)
    .map(String);
};

const getMissionScanIdentifiers = (mission) => {
  return [mission?.scanId, mission?.scanMongoId]
    .filter(Boolean)
    .map(String);
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

class MissionQueueManager {
  constructor() {
    this.running = false;
    this.processingMission = false;

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

      pollId = window.setInterval(
        inspectRuntime,
        SCAN_TERMINAL_POLL_MS,
      );

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
      this.hasRuntimeScanInProgress()
    ) {
      return;
    }

    const mission = activateNextMission();

    if (!mission) {
      return;
    }

    this.processingMission = true;

    let terminalScan = null;

    scanEventBus.emitTelemetry(
      `Scan queue activated ${mission.target}`,
      {
        source: "mission-queue-manager",
        missionId: mission.id,
        queuedRemaining: getMissionQueueMetrics().queued,
      },
    );

    try {
      await simulateMissionLifecycle(mission);

      terminalScan = await this.waitForMissionScanTerminal(mission);

      scanEventBus.emitTelemetry(
        `Queued scan finished for ${mission.target}`,
        {
          source: "mission-queue-manager",
          missionId: mission.id,
          scanId:
            terminalScan?.mongoId ??
            terminalScan?._id ??
            terminalScan?.id ??
            null,
          status: terminalScan?.status ?? "unknown",
          queuedRemaining: getMissionQueueMetrics().queued,
        },
      );
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
