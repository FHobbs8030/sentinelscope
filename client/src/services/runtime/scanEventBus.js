import { createClientId } from "../../utils/createClientId";

export const SCAN_EVENTS = {
  SCAN_CREATED: "SCAN_CREATED",
  SCAN_STARTED: "SCAN_STARTED",
  SCAN_STAGE_CHANGED: "SCAN_STAGE_CHANGED",
  SCAN_PROGRESS_UPDATED: "SCAN_PROGRESS_UPDATED",
  SCAN_COMPLETED: "SCAN_COMPLETED",
  SCAN_FAILED: "SCAN_FAILED",
  SCAN_CANCELLED: "SCAN_CANCELLED",
  FINDING_DISCOVERED: "FINDING_DISCOVERED",
  CRITICAL_FINDING_DISCOVERED: "CRITICAL_FINDING_DISCOVERED",
  SYSTEM_LOAD_CHANGED: "SYSTEM_LOAD_CHANGED",
  QUEUE_UPDATED: "QUEUE_UPDATED",
  TELEMETRY_EVENT: "TELEMETRY_EVENT",
};

class ScanEventBus {
  constructor() {
    this.listeners = new Map();

    this.eventHistory = [];

    this.maxHistory = 250;
  }

  subscribe(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    const eventListeners = this.listeners.get(eventName);

    eventListeners.add(callback);

    return () => {
      eventListeners.delete(callback);

      if (eventListeners.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  subscribeMany(eventNames = [], callback) {
    const unsubscribers = eventNames.map((eventName) =>
      this.subscribe(eventName, callback),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }

  emit(eventName, payload = {}) {
    const event = {
      id: this.generateEventId(),
      type: eventName,
      timestamp: new Date().toISOString(),
      payload,
    };

    this.storeEvent(event);

    const listeners = this.listeners.get(eventName);

    if (!listeners || listeners.size === 0) {
      return event;
    }

    listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error(
          `[ScanEventBus] Failed processing event "${eventName}"`,
          error,
        );
      }
    });

    return event;
  }

  emitTelemetry(message, metadata = {}) {
    return this.emit(SCAN_EVENTS.TELEMETRY_EVENT, {
      message,
      ...metadata,
    });
  }

  emitScanCreated(scan) {
    return this.emit(SCAN_EVENTS.SCAN_CREATED, {
      scan,
    });
  }

  emitScanStarted(scan) {
    return this.emit(SCAN_EVENTS.SCAN_STARTED, {
      scan,
    });
  }

  emitStageChanged(previousStage, nextStage, scan) {
    return this.emit(SCAN_EVENTS.SCAN_STAGE_CHANGED, {
      previousStage,
      nextStage,
      scan,
    });
  }

  emitProgressUpdated(scan) {
    return this.emit(SCAN_EVENTS.SCAN_PROGRESS_UPDATED, {
      scan,
    });
  }

  emitScanCompleted(scan) {
    return this.emit(SCAN_EVENTS.SCAN_COMPLETED, {
      scan,
    });
  }

  emitScanFailed(scan) {
    return this.emit(SCAN_EVENTS.SCAN_FAILED, {
      scan,
    });
  }

  emitScanCancelled(scan) {
    return this.emit(SCAN_EVENTS.SCAN_CANCELLED, {
      scan,
    });
  }

  emitFindingDiscovered(finding, severity, scan) {
    const eventPayload = {
      finding,
      severity,
      scan,
    };

    this.emit(SCAN_EVENTS.FINDING_DISCOVERED, eventPayload);

    if (severity?.toLowerCase() === "critical") {
      this.emit(SCAN_EVENTS.CRITICAL_FINDING_DISCOVERED, eventPayload);
    }
  }

  emitSystemLoadChanged(loadState) {
    return this.emit(SCAN_EVENTS.SYSTEM_LOAD_CHANGED, {
      loadState,
    });
  }

  emitQueueUpdated(queueMetrics) {
    return this.emit(SCAN_EVENTS.QUEUE_UPDATED, {
      queueMetrics,
    });
  }

  getEventHistory() {
    return [...this.eventHistory];
  }

  getEventsByType(eventName) {
    return this.eventHistory.filter((event) => event.type === eventName);
  }

  clearHistory() {
    this.eventHistory = [];
  }

  removeAllListeners() {
    this.listeners.clear();
  }

  storeEvent(event) {
    this.eventHistory.unshift(event);

    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(0, this.maxHistory);
    }
  }

  generateEventId() {
    return `evt-${createClientId()}`;
  }
}

const scanEventBus = new ScanEventBus();

export default scanEventBus;
