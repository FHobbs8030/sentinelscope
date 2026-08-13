import { createClientId } from "../../../utils/createClientId";

import {
  TELEMETRY_EVENT_CONFIG,
  TELEMETRY_LEVELS,
  TELEMETRY_SOURCES,
} from "./telemetryTypes";

import { SCAN_EVENTS } from "../scanEventBus";

export function createTelemetryEntry({
  level = TELEMETRY_LEVELS.INFO,
  source = TELEMETRY_SOURCES.SYSTEM,
  message = "Telemetry event received",
  metadata = {},
}) {
  return {
    id: createClientId(),

    level,

    source,

    message,

    metadata,

    timestamp: Date.now(),
  };
}

export function formatTelemetryEvent(eventType, payload = {}) {
  const config = TELEMETRY_EVENT_CONFIG[eventType];

  if (!config) {
    return createTelemetryEntry({
      level: TELEMETRY_LEVELS.SYSTEM,

      source: TELEMETRY_SOURCES.SYSTEM,

      message: `Unhandled telemetry event: ${eventType}`,

      metadata: payload,
    });
  }

  return createTelemetryEntry({
    level: config.level,

    source: config.source,

    message: buildTelemetryMessage(eventType, payload),

    metadata: payload,
  });
}

function buildTelemetryMessage(eventType, payload) {
  switch (eventType) {
    case SCAN_EVENTS.SCAN_CREATED:
      return `Scan created for ${payload.scan?.target || "unknown target"}`;

    case SCAN_EVENTS.SCAN_STARTED:
      return `Scan started against ${payload.scan?.target || "unknown target"}`;

    case SCAN_EVENTS.SCAN_STAGE_CHANGED:
      return `Stage transitioned from ${
        payload.previousStage || "unknown"
      } to ${payload.nextStage || "unknown"}`;

    case SCAN_EVENTS.SCAN_PROGRESS_UPDATED:
      return `Scan progress updated to ${payload.scan?.progress ?? 0}%`;

    case SCAN_EVENTS.SCAN_COMPLETED:
      return `Scan completed for ${payload.scan?.target || "unknown target"}`;

    case SCAN_EVENTS.SCAN_FAILED:
      return `Scan failed for ${payload.scan?.target || "unknown target"}`;

    case SCAN_EVENTS.SCAN_CANCELLED:
      return `Scan cancelled for ${payload.scan?.target || "unknown target"}`;

    case SCAN_EVENTS.FINDING_DISCOVERED:
      return `${payload.finding?.value || 0} findings discovered (total: ${
        payload.finding?.total || 0
      })`;

    case SCAN_EVENTS.CRITICAL_FINDING_DISCOVERED:
      return `${
        payload.finding?.value || 0
      } critical findings discovered (total: ${payload.finding?.total || 0})`;

    case SCAN_EVENTS.SYSTEM_LOAD_CHANGED:
      return `System load changed to ${payload.loadState || "unknown state"}`;

    case SCAN_EVENTS.QUEUE_UPDATED:
      return `Queue updated`;

    case SCAN_EVENTS.TELEMETRY_EVENT:
      return payload.message || "Telemetry event received";

    default:
      return `Telemetry event received: ${eventType}`;
  }
}
