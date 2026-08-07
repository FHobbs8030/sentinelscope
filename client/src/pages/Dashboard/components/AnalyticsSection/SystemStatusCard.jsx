import "./SystemStatusCard.css";

import useBackendHealthContext from "../../../../hooks/useBackendHealthContext";

const STATUS_MATRIX = {
  online: {
    aggregateLabel: "All Systems Operational",
    aggregateTone: "online",
    services: [
      {
        label: "Scanner Engine",
        status: "Online",
        tone: "online",
      },
      {
        label: "Threat Database",
        status: "Synced",
        tone: "online",
      },
      {
        label: "Queue Processor",
        status: "Healthy",
        tone: "online",
      },
      {
        label: "API Gateway",
        status: "Operational",
        tone: "online",
      },
    ],
  },
  offline: {
    aggregateLabel: "Service Disruption Detected",
    aggregateTone: "offline",
    services: [
      {
        label: "Scanner Engine",
        status: "Degraded",
        tone: "degraded",
      },
      {
        label: "Threat Database",
        status: "Unreachable",
        tone: "offline",
      },
      {
        label: "Queue Processor",
        status: "Degraded",
        tone: "degraded",
      },
      {
        label: "API Gateway",
        status: "Offline",
        tone: "offline",
      },
    ],
  },
  checking: {
    aggregateLabel: "Verifying System Health",
    aggregateTone: "checking",
    services: [
      {
        label: "Scanner Engine",
        status: "Checking",
        tone: "checking",
      },
      {
        label: "Threat Database",
        status: "Checking",
        tone: "checking",
      },
      {
        label: "Queue Processor",
        status: "Checking",
        tone: "checking",
      },
      {
        label: "API Gateway",
        status: "Checking",
        tone: "checking",
      },
    ],
  },
  recovering: {
    aggregateLabel: "Services Recovering",
    aggregateTone: "recovering",
    services: [
      {
        label: "Scanner Engine",
        status: "Recovering",
        tone: "recovering",
      },
      {
        label: "Threat Database",
        status: "Reconnecting",
        tone: "recovering",
      },
      {
        label: "Queue Processor",
        status: "Recovering",
        tone: "recovering",
      },
      {
        label: "API Gateway",
        status: "Reconnecting",
        tone: "recovering",
      },
    ],
  },
};

function SystemStatusCard() {
  const {
    status,
    error,
    lastCheckedAt,
  } = useBackendHealthContext();

  const systemState =
    STATUS_MATRIX[status] ?? STATUS_MATRIX.checking;

  const lastCheckedLabel = lastCheckedAt
    ? `Checked ${lastCheckedAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })}`
    : "Initial health check";

  return (
    <section
      className={`system-status-card system-status-card--${systemState.aggregateTone}`}
      aria-label="System status"
    >
      <div className="system-status-card__summary">
        <div className="system-status-card__heading">
          <span className="system-status-card__eyebrow">System Status</span>

          <strong
            className={`system-status-card__aggregate system-status-card__aggregate--${systemState.aggregateTone}`}
            role="status"
            aria-live="polite"
            title={error || systemState.aggregateLabel}
          >
            <span
              className={`system-status-card__aggregate-dot system-status-card__aggregate-dot--${systemState.aggregateTone}`}
              aria-hidden="true"
            />

            {systemState.aggregateLabel}
          </strong>
        </div>

        <span className="system-status-card__checked">
          {lastCheckedLabel}
        </span>
      </div>

      <div className="system-status-card__services">
        {systemState.services.map((service) => (
          <div
            className={`system-status-service system-status-service--${service.tone}`}
            key={service.label}
          >
            <span
              className={`system-status-service__dot system-status-service__dot--${service.tone}`}
              aria-hidden="true"
            />

            <div className="system-status-service__copy">
              <span className="system-status-service__label">
                {service.label}
              </span>

              <strong className="system-status-service__value">
                {service.status}
              </strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default SystemStatusCard;
