import missionStore from "../orchestration/missionStore";
import {
  SCAN_STATE_METADATA,
  getNextScanState,
  getRandomStageMessage,
  isTerminalScanState,
  shouldFailScan,
} from "./scanStateMachine";

import scanEventBus from "./scanEventBus";
import { createScan, updateScan } from "../api/scansApi";
import { createFindingsBatch } from "../api/findingsApi";
import { createAlert } from "../api/alertsApi";
import missionPersistenceReconciler from "../orchestration/missionPersistenceReconciler";
import { ownsMissionRuntime } from "../orchestration/runtimeOwnership";
import { generateThreatIntelligence } from "../intelligence/threatIntelligenceEngine";
import { generateThreatPrediction } from "../intelligence/threatPredictionEngine";
import { calculateRiskScore } from "../intelligence/riskAssessmentEngine";
import {
  createMissionProfile,
  determineMissionOutcome,
} from "./missionOutcomeEngine";

const RUNTIME_INTERVAL = 2000;
const SCAN_PERSIST_INTERVAL = 10000;

class ScanRuntimeEngine {
  constructor() {
    this.scans = [];
    this.initialized = false;

    this.intervalId = null;

    this.listeners = new Set();
    this.lastScanPersistedAt = new Map();

    this.pendingScanWrites = new Map();

    this.pendingScanCreates = new Map();
    this.scanReconcileTimers = new Map();

    this.alertedScanConditions = new Set();
  }

  initialize(initialScans = []) {
    this.scans = Array.isArray(initialScans) ? [...initialScans] : [];
    this.initialized = true;

    const interruptedCount = this.scans.filter(
      (scan) => scan.status === "interrupted",
    ).length;

    scanEventBus.emitTelemetry(
      `Recovered ${this.scans.length} persisted scans`,
      {
        source: "runtime-recovery",
        recoveredScans: this.scans.length,
      },
    );

    if (interruptedCount > 0) {
      scanEventBus.emitTelemetry(
        `${interruptedCount} interrupted scans require operator review`,
        {
          source: "runtime-recovery",
          interruptedScans: interruptedCount,
        },
      );
    }

    this.emit();
  }

  start() {
    if (this.intervalId) {
      return;
    }

    scanEventBus.emitTelemetry("SentinelScope runtime engine initialized", {
      source: "runtime-engine",
    });

    this.intervalId = setInterval(() => {
      this.updateActiveScans();
    }, RUNTIME_INTERVAL);
  }

  stop() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);

    this.intervalId = null;

    scanEventBus.emitTelemetry("SentinelScope runtime engine stopped", {
      source: "runtime-engine",
    });
  }

  destroy() {
    this.stop();

    this.scans = [];
    this.initialized = false;

    this.listeners.clear();

    this.lastScanPersistedAt.clear();

    this.pendingScanWrites.clear();

    this.pendingScanCreates.clear();

    this.scanReconcileTimers.forEach((timerId) => {
      clearTimeout(timerId);
    });

    this.scanReconcileTimers.clear();

    this.alertedScanConditions.clear();

    scanEventBus.emitTelemetry("Runtime engine destroyed", {
      source: "runtime-engine",
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit() {
    const snapshot = [...this.scans];

    this.listeners.forEach((listener) => {
      listener(snapshot);
    });
  }

  getScans() {
    return [...this.scans];
  }

  isInitialized() {
    return this.initialized;
  }

  setScans(scans = []) {
    this.scans = Array.isArray(scans) ? [...scans] : [];

    this.emit();
  }

  getRuntimeScan(scanId) {
    return this.scans.find((scan) => scan.id === scanId) ?? null;
  }

  buildScanCreatePayload(scan) {
    const mission = scan.missionId
      ? missionStore.getMission(scan.missionId)
      : null;

    return {
      clientScanId: scan.id,

      name: scan.name ?? scan.target,
      target: scan.target,

      missionId: scan.missionId,
      missionMongoId:
        scan.missionMongoId ?? mission?.mongoId ?? null,

      scanType: scan.type ?? "recon",

      severity: scan.severity,
      profile: scan.profile,

      status: scan.status,
      currentStage: scan.currentStage ?? scan.status,

      runtimeState: isTerminalScanState(scan.status)
        ? "completed"
        : "active",

      progress: scan.progress,
      findingsCount: scan.findingsCount,

      startedAt: scan.startedAt,
      completedAt: scan.completedAt ?? null,
    };
  }

  scheduleScanReconciliation(scanId) {
    if (!scanId || this.scanReconcileTimers.has(scanId)) {
      return;
    }

    const timerId = setTimeout(async () => {
      this.scanReconcileTimers.delete(scanId);

      const latestScan = this.getRuntimeScan(scanId);

      if (!latestScan) {
        return;
      }

      if (latestScan.mongoId) {
        await this.persistScan(latestScan, {
          force: true,
        });

        return;
      }

      await this.persistScanCreate(latestScan);
    }, 5000);

    this.scanReconcileTimers.set(scanId, timerId);
  }

  persistScanCreate(scan) {
    if (!scan?.id) {
      return Promise.resolve(false);
    }

    if (scan.mongoId) {
      return Promise.resolve(true);
    }

    const pendingCreate = this.pendingScanCreates.get(scan.id);

    if (pendingCreate) {
      return pendingCreate;
    }

    const createPromise = (async () => {
      try {
        const latestScan =
          this.getRuntimeScan(scan.id) ?? scan;

        const response = await createScan(
          this.buildScanCreatePayload(latestScan),
        );

        const mongoId =
          response?.data?._id ?? response?._id ?? null;

        if (!mongoId) {
          throw new Error(
            "Scan create response did not include a MongoDB ID",
          );
        }

        scan.mongoId = mongoId;

        this.scans = this.scans.map((item) =>
          item.id === scan.id
            ? {
                ...item,
                mongoId,
              }
            : item,
        );

        const reconciledScan =
          this.getRuntimeScan(scan.id) ?? {
            ...scan,
            mongoId,
          };

        this.emit();

        return this.persistScan(reconciledScan, {
          force: true,
        });
      } catch (error) {
        console.error(
          `[Scan Persistence] Failed to recover ${scan.target}:`,
          error,
        );

        this.scheduleScanReconciliation(scan.id);

        return false;
      }
    })().finally(() => {
      if (
        this.pendingScanCreates.get(scan.id) ===
        createPromise
      ) {
        this.pendingScanCreates.delete(scan.id);
      }
    });

    this.pendingScanCreates.set(scan.id, createPromise);

    return createPromise;
  }

  async addScan(scan) {
    const createdAt = new Date().toISOString();

    const normalizedType = scan.type ?? scan.scanType ?? "recon";
    const normalizedProfile = scan.profile ?? "General";
    const normalizedSeverity = scan.severity ?? "medium";
    const normalizedStatus = scan.status ?? "queued";

    const runtimeScan = {
      ...scan,

      id: scan.id ?? `scan-${crypto.randomUUID()}`,

      mongoId: scan.mongoId ?? null,

      missionId: scan.missionId ?? null,

      missionMongoId: scan.missionMongoId ?? null,

      type: normalizedType,

      profile: normalizedProfile,

      severity: normalizedSeverity,

      progress: scan.progress ?? 0,

      findingsCount: scan.findingsCount ?? 0,

      elapsedTime: scan.elapsedTime ?? 0,

      startedAt: scan.startedAt ?? createdAt,

      updatedAt: createdAt,

      status: normalizedStatus,

      currentStage: scan.currentStage ?? normalizedStatus,

      runtimeProfile:
        scan.runtimeProfile ??
        createMissionProfile({
          scanType: normalizedType,
          severity: normalizedSeverity,
        }),

      activity: scan.activity ?? "Scan added to operational queue",

      live: scan.live ?? true,
    };

    this.scans.unshift(runtimeScan);

    await this.persistScanCreate(runtimeScan);

    scanEventBus.emitScanCreated(runtimeScan);

    scanEventBus.emitTelemetry(`New scan queued for ${runtimeScan.target}`, {
      scanId: runtimeScan.id,
      target: runtimeScan.target,
      type: runtimeScan.type,
    });

    this.emit();

    return runtimeScan;
  }

  removeScan(scanId) {
    const removedScan = this.scans.find((scan) => scan.id === scanId);

    this.scans = this.scans.filter((scan) => scan.id !== scanId);

    if (removedScan) {
      scanEventBus.emitTelemetry(`Scan removed: ${removedScan.target}`, {
        scanId: removedScan.id,
      });
    }

    this.emit();
  }

  buildScanPersistencePayload(scan) {
    const mission = scan.missionId
      ? missionStore.getMission(scan.missionId)
      : null;

    return {
      missionId: scan.missionId ?? null,

      missionMongoId:
        scan.missionMongoId ?? mission?.mongoId ?? null,

      status: scan.status,

      currentStage: scan.currentStage,

      runtimeState: isTerminalScanState(scan.status) ? "completed" : "active",

      progress: scan.progress,

      findingsCount: scan.findingsCount,

      completedAt: scan.completedAt ?? null,
    };
  }

  persistScan(scan, { previousScan = null, force = false } = {}) {
    if (!scan.mongoId) {
      return this.persistScanCreate(scan);
    }

    const persistenceKey = scan.mongoId;

    const isTerminal = isTerminalScanState(scan.status);

    const stateChanged =
      previousScan !== null &&
      (previousScan.status !== scan.status ||
        previousScan.currentStage !== scan.currentStage);

    const requiresImmediateWrite = force || isTerminal || stateChanged;

    const pendingWrite = this.pendingScanWrites.get(persistenceKey);

    if (pendingWrite && !requiresImmediateWrite) {
      return pendingWrite;
    }

    const lastPersistedAt = this.lastScanPersistedAt.get(persistenceKey) ?? 0;

    const persistenceElapsed = Date.now() - lastPersistedAt;

    if (!requiresImmediateWrite && persistenceElapsed < SCAN_PERSIST_INTERVAL) {
      return Promise.resolve(false);
    }

    const writePromise = (pendingWrite ?? Promise.resolve())
      .catch(() => false)
      .then(async () => {
        await updateScan(
          persistenceKey,
          this.buildScanPersistencePayload(scan),
        );

        this.lastScanPersistedAt.set(persistenceKey, Date.now());

        return true;
      })
      .catch((error) => {
        this.scheduleScanReconciliation(scan.id);

        console.error(
          `[Scan Persistence] Failed to update ${scan.target}:`,
          error,
        );

        scanEventBus.emitTelemetry(
          `Scan persistence failed for ${scan.target}`,
          {
            source: "runtime-persistence",
            scanId: scan.id,
            scanMongoId: scan.mongoId,
            status: scan.status,
          },
        );

        return false;
      })
      .finally(() => {
        if (this.pendingScanWrites.get(persistenceKey) === writePromise) {
          this.pendingScanWrites.delete(persistenceKey);
        }
      });

    this.pendingScanWrites.set(persistenceKey, writePromise);

    return writePromise;
  }

  cancelScan(scanId) {
    this.scans = this.scans.map((scan) => {
      if (scan.id !== scanId) {
        return scan;
      }

      const cancelledScan = {
        ...scan,

        status: "cancelled",

        currentStage: "cancelled",

        live: false,

        completedAt: new Date().toISOString(),

        activity: "Operational scan cancelled by operator",

        updatedAt: new Date().toISOString(),
      };

      scanEventBus.emitScanCancelled(cancelledScan);

      scanEventBus.emitTelemetry(`Scan cancelled for ${cancelledScan.target}`, {
        scanId: cancelledScan.id,
      });

      void this.persistScan(cancelledScan, {
        previousScan: scan,
        force: true,
      });

      this.synchronizeMission(cancelledScan, "cancelled");

      return cancelledScan;
    });

    this.emit();
  }

  resumeScan(scanId) {
    this.scans = this.scans.map((scan) => {
      const matchesId = scan.id === scanId || scan.mongoId === scanId;

      if (!matchesId) {
        return scan;
      }

      const resumedScan = {
        ...scan,

        status: scan.currentStage || "queued",

        live: true,

        activity: `Resumed from ${scan.currentStage || "queued"} stage`,

        updatedAt: new Date().toISOString(),
      };

      scanEventBus.emitTelemetry(`Scan resumed for ${resumedScan.target}`, {
        scanId: resumedScan.id,
      });

      void this.persistScan(resumedScan, {
        previousScan: scan,
        force: true,
      });

      return resumedScan;
    });

    this.emit();
  }

  updateActiveScans() {
    const updatedScans = this.scans.map((scan) => {
      if (isTerminalScanState(scan.status)) {
        return scan;
      }

      if (scan.missionId && !ownsMissionRuntime(scan.missionId)) {
        return scan;
      }

      const metadata = SCAN_STATE_METADATA[scan.status];

      if (!metadata) {
        return scan;
      }

      if (shouldFailScan(scan.status)) {
        const failedScan = {
          ...scan,

          status: "failed",

          currentStage: "failed",

          live: false,

          completedAt: new Date().toISOString(),

          activity: "Operational runtime failure detected",

          updatedAt: new Date().toISOString(),
        };

        scanEventBus.emitScanFailed(failedScan);

        scanEventBus.emitTelemetry(
          `Runtime failure detected on ${failedScan.target}`,
          {
            scanId: failedScan.id,
            target: failedScan.target,
          },
        );

        this.synchronizeMission(failedScan, "failed");

        if (failedScan.mongoId) {
          const intelligence = generateThreatIntelligence({
            stage: "failure",
            severity: "high",
            source: "runtime-engine",
          });

          const riskScore = calculateRiskScore({
            severity: "high",
            stage: "failure",
          });

          const prediction = generateThreatPrediction({
            riskScore,
            severity: "high",
            threatContext: intelligence.threatContext,
            threatActor: intelligence.threatActor,
            intelligenceConfidence: intelligence.intelligenceConfidence,
            executiveRisk: intelligence.executiveRisk,
          });

          createAlert({
            title: "Runtime Scan Failure",

            description: `Operational runtime failure detected on ${failedScan.target}`,

            severity: "high",

            target: failedScan.target,

            scanId: failedScan.mongoId,

            missionId: failedScan.missionId,

            source: "runtime-engine",

            status: "open",

            evidence: [
              "Runtime engine failure detected",
              `Scan terminated during ${scan.status} stage`,
            ],

            riskScore,

            affectedAsset: failedScan.target,

            recommendedActions: intelligence.recommendedActions,

            threatContext: intelligence.threatContext,

            threatNarrative: intelligence.threatNarrative,

            businessImpact: intelligence.businessImpact,

            threatActor: intelligence.threatActor,

            mitreAttack: intelligence.mitreAttack,

            intelligenceConfidence: intelligence.intelligenceConfidence,

            executiveRisk: intelligence.executiveRisk,

            decisionIntelligence: intelligence.decisionIntelligence,

            prediction,

            relatedFindings: [],
          }).catch((error) => {
            console.error("Failed to create runtime alert:", error);
          });
        }

        void this.persistScan(failedScan, {
          previousScan: scan,
          force: true,
        });

        return failedScan;
      }

      const currentMetadata = SCAN_STATE_METADATA[scan.status];

      const progressIncrease = this.randomNumber(2, 8);

      let progress = Math.min(100, (scan.progress ?? 0) + progressIncrease);

      let currentState = scan.status;

      if (currentMetadata && progress >= currentMetadata.progressMax) {
        currentState = getNextScanState(scan.status);
      }

      const activeMetadata = SCAN_STATE_METADATA[currentState];

      if (activeMetadata) {
        if (currentState !== scan.status) {
          progress = activeMetadata.progressMin;
        } else {
          progress = Math.max(progress, activeMetadata.progressMin);

          progress = Math.min(progress, activeMetadata.progressMax);
        }
      }

      const findingsIncrease = this.generateFindings(
        currentState,
        scan.runtimeProfile,
      );

      const updatedScan = {
        ...scan,

        status: currentState,

        currentStage: currentState,

        progress,

        findingsCount: (scan.findingsCount || 0) + findingsIncrease,

        elapsedTime: (scan.elapsedTime || 0) + RUNTIME_INTERVAL / 1000,

        activity: getRandomStageMessage(currentState),

        updatedAt: new Date().toISOString(),
      };

      if (scan.status !== currentState) {
        scanEventBus.emitStageChanged(scan.status, currentState, updatedScan);

        scanEventBus.emitTelemetry(
          `${updatedScan.target} entered ${currentState} stage`,
          {
            scanId: updatedScan.id,
            previousStage: scan.status,
            newStage: currentState,
          },
        );
      }

      scanEventBus.emitProgressUpdated(updatedScan);

      if (
        findingsIncrease > 0 &&
        updatedScan.mongoId &&
        updatedScan.missionId
      ) {
        const severity = updatedScan.severity?.toLowerCase();

        const findingBatch = Array.from(
          {
            length: findingsIncrease,
          },
          () => {
            return {
              clientFindingId: crypto.randomUUID(),

              scanId: updatedScan.mongoId,

              missionId: updatedScan.missionId,

              target: updatedScan.target,

              title: `${currentState.toUpperCase()} Discovery`,

              description: `Runtime finding generated during ${currentState} stage`,

              severity: updatedScan.severity,

              category: currentState,

              status: "open",
            };
          },
        );

        const findingBatchPromise = createFindingsBatch(findingBatch).catch(
          (error) => {
            console.error("Failed to persist finding batch:", error);

            return null;
          },
        );

        const shouldCreateAlert =
          severity === "critical" || severity === "high";

        const alertConditionKey = `${updatedScan.mongoId}:${severity}`;

        if (
          shouldCreateAlert &&
          !this.alertedScanConditions.has(alertConditionKey)
        ) {
          this.alertedScanConditions.add(alertConditionKey);

          findingBatchPromise
            .then((findingResponse) => {
              if (!findingResponse) {
                this.alertedScanConditions.delete(alertConditionKey);

                return null;
              }

              const relatedFindings = Array.isArray(findingResponse?.data)
                ? findingResponse.data
                    .map((finding) => {
                      return finding?._id ?? null;
                    })
                    .filter(Boolean)
                : [];

              const intelligence = generateThreatIntelligence({
                stage: currentState,
                severity,
                source: "finding-engine",
              });

              const riskScore = calculateRiskScore({
                severity,
                stage: currentState,
                findingsCount: updatedScan.findingsCount,
              });

              const prediction = generateThreatPrediction({
                riskScore,
                severity,
                threatContext: intelligence.threatContext,
                threatActor: intelligence.threatActor,
                intelligenceConfidence: intelligence.intelligenceConfidence,
                executiveRisk: intelligence.executiveRisk,
              });

              return createAlert({
                title:
                  severity === "critical"
                    ? "Critical Security Finding"
                    : "High Severity Security Finding",

                description: `${currentState.toUpperCase()} discovery detected on ${updatedScan.target}`,

                severity,

                target: updatedScan.target,

                scanId: updatedScan.mongoId,

                missionId: updatedScan.missionId,

                source: "finding-engine",

                status: "open",

                evidence: [
                  `${currentState.toUpperCase()} discovery detected`,
                  `Finding generated during ${currentState} stage`,
                ],

                riskScore,

                affectedAsset: updatedScan.target,

                recommendedActions: intelligence.recommendedActions,

                threatContext: {
                  ...intelligence.threatContext,
                  stage: currentState,
                },

                threatNarrative: intelligence.threatNarrative,

                businessImpact: intelligence.businessImpact,

                threatActor: intelligence.threatActor,

                mitreAttack: intelligence.mitreAttack,

                intelligenceConfidence: intelligence.intelligenceConfidence,

                executiveRisk: intelligence.executiveRisk,

                decisionIntelligence: intelligence.decisionIntelligence,

                prediction,

                relatedFindings,
              });
            })
            .catch((error) => {
              console.error("Failed to persist aggregated alert:", error);
            });
        }

        scanEventBus.emitFindingDiscovered(
          {
            value: findingsIncrease,
            total: updatedScan.findingsCount,
          },
          updatedScan.severity,
          updatedScan,
        );

        scanEventBus.emitTelemetry(
          `${findingsIncrease} findings discovered on ${updatedScan.target}`,
          {
            scanId: updatedScan.id,
            severity: updatedScan.severity,
            findings: updatedScan.findingsCount,
          },
        );
      }

      if (scan.status !== currentState && currentState === "initializing") {
        scanEventBus.emitScanStarted(updatedScan);
      }

      if (currentState === "completed") {
        const runtimeProfile =
          updatedScan.runtimeProfile ??
          createMissionProfile({
            scanType: updatedScan.scanType,
            severity: updatedScan.severity,
          });

        const outcome = determineMissionOutcome(runtimeProfile);

        updatedScan.status = outcome;
        updatedScan.currentStage = outcome;
        updatedScan.completedAt = new Date().toISOString();

        if (outcome === "completed") {
          updatedScan.progress = 100;
        }

        updatedScan.live = false;

        if (outcome === "completed") {
          updatedScan.activity = "Scan completed successfully";

          scanEventBus.emitScanCompleted(updatedScan);

          this.synchronizeMission(updatedScan, "completed");

          scanEventBus.emitTelemetry(
            `Operational scan completed for ${updatedScan.target}`,
            {
              scanId: updatedScan.id,
              findings: updatedScan.findingsCount,
            },
          );
        }

        if (outcome === "failed") {
          updatedScan.activity = "Mission failed during execution";

          scanEventBus.emitScanFailed(updatedScan);

          this.synchronizeMission(updatedScan, "failed");

          scanEventBus.emitTelemetry(
            `Mission failed on ${updatedScan.target}`,
            {
              scanId: updatedScan.id,
            },
          );
        }

        if (outcome === "interrupted") {
          updatedScan.activity =
            "Mission interrupted and awaiting operator review";

          this.synchronizeMission(updatedScan, "failed");

          scanEventBus.emitTelemetry(
            `Mission interrupted on ${updatedScan.target}`,
            {
              scanId: updatedScan.id,
            },
          );
        }
      }

      void this.persistScan(updatedScan, {
        previousScan: scan,
      });

      return updatedScan;
    });

    this.scans = updatedScans;

    this.emit();
  }

  async synchronizeMission(scan, missionState) {
    if (!scan.missionId) {
      return;
    }

    const updates = {
      state: missionState,
      progress: missionState === "completed" ? 100 : scan.progress,
    };

    missionStore.updateMission(scan.missionId, updates);

    let mission = missionStore.getMission(scan.missionId);

    if (!mission) {
      return;
    }

    if (!mission.mongoId && scan.missionMongoId) {
      missionStore.updateMission(scan.missionId, {
        mongoId: scan.missionMongoId,
      });

      mission =
        missionStore.getMission(scan.missionId) ?? {
          ...mission,
          mongoId: scan.missionMongoId,
        };
    }

    await missionPersistenceReconciler.persistLatest(mission);
  }

  generateFindings(state, runtimeProfile) {
    const multiplier = runtimeProfile?.findingsMultiplier ?? 1;

    switch (state) {
      case "recon":
        return Math.round(this.randomNumber(1, 3) * multiplier);

      case "enumeration":
        return Math.round(this.randomNumber(2, 6) * multiplier);

      case "analysis":
        return Math.round(this.randomNumber(4, 10) * multiplier);

      case "exploitation":
        return Math.round(this.randomNumber(3, 8) * multiplier);

      default:
        return 0;
    }
  }

  randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

const scanRuntimeEngine = new ScanRuntimeEngine();

export default scanRuntimeEngine;
