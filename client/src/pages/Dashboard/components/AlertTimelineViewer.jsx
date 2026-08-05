import "./AlertTimelineViewer.css";

const LIFECYCLE_STAGES = [
  {
    key: "created",
    label: "Created",
    description: "Threat alert entered the SentinelScope alert pipeline.",
    timestampKey: "createdAt",
  },
  {
    key: "acknowledged",
    label: "Acknowledged",
    description: "Alert ownership and review were acknowledged.",
    timestampKey: "acknowledgedAt",
  },
  {
    key: "investigating",
    label: "Investigating",
    description: "Active threat investigation is underway.",
    timestampKey: "investigatingAt",
  },
  {
    key: "resolved",
    label: "Resolved",
    description: "Threat response actions reached a resolved state.",
    timestampKey: "resolvedAt",
  },
  {
    key: "closed",
    label: "Closed",
    description: "Alert lifecycle was completed and formally closed.",
    timestampKey: "closedAt",
  },
];

const STATUS_STAGE_INDEX = {
  open: 0,
  acknowledged: 1,
  investigating: 2,
  resolved: 3,
  closed: 4,
};

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

function formatLabel(value) {
  if (!value) {
    return "Event";
  }

  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function AlertTimelineViewer({ alert }) {
  if (!alert) {
    return (
      <section className="alert-timeline-viewer">
        <header className="alert-timeline-viewer__header">
          <div>
            <span className="alert-timeline-viewer__eyebrow">
              Lifecycle Intelligence
            </span>

            <h2 className="alert-timeline-viewer__title">Alert Timeline</h2>
          </div>
        </header>

        <div className="alert-timeline-viewer__empty">
          Select an alert to view lifecycle activity.
        </div>
      </section>
    );
  }

  const normalizedStatus = String(alert.status || "open").toLowerCase();

  const lastRecordedStageIndex = LIFECYCLE_STAGES.reduce(
    (latestIndex, stage, index) =>
      alert[stage.timestampKey] ? index : latestIndex,
    0,
  );

  const currentStageIndex =
    STATUS_STAGE_INDEX[normalizedStatus] ?? lastRecordedStageIndex;

  const lifecycleStages = LIFECYCLE_STAGES.map((stage, index) => {
    let state = "pending";

    if (index < currentStageIndex) {
      state = "completed";
    } else if (index === currentStageIndex) {
      state = "current";
    }

    return {
      ...stage,
      state,
      timestamp: alert[stage.timestampKey],
    };
  });

  const customEvents = (alert.timeline || []).filter((event) => {
    const action = event.action?.toLowerCase();

    return ![
      "created",
      "acknowledged",
      "investigating",
      "resolved",
      "closed",
    ].includes(action);
  });

  const currentStage = lifecycleStages[currentStageIndex] || lifecycleStages[0];

  return (
    <section className="alert-timeline-viewer">
      <header className="alert-timeline-viewer__header">
        <div>
          <span className="alert-timeline-viewer__eyebrow">
            Lifecycle Intelligence
          </span>

          <h2 className="alert-timeline-viewer__title">Alert Timeline</h2>

          <p className="alert-timeline-viewer__subtitle">
            Track this threat alert from detection through final disposition.
          </p>
        </div>

        <div className="alert-timeline-viewer__status">
          <span className="alert-timeline-viewer__status-label">
            Current State
          </span>

          <strong>{formatLabel(alert.status || currentStage?.label)}</strong>
        </div>
      </header>

      <div className="alert-timeline-viewer__lifecycle">
        {lifecycleStages.map((stage, index) => {
          const formattedTimestamp = formatDate(stage.timestamp);

          return (
            <article
              key={stage.key}
              className={`alert-timeline-viewer__stage alert-timeline-viewer__stage--${stage.state}`}
            >
              <div className="alert-timeline-viewer__rail" aria-hidden="true">
                <div className="alert-timeline-viewer__marker">
                  {stage.state === "completed" ? "✓" : index + 1}
                </div>

                {index < lifecycleStages.length - 1 && (
                  <div className="alert-timeline-viewer__connector" />
                )}
              </div>

              <div className="alert-timeline-viewer__stage-body">
                <div className="alert-timeline-viewer__stage-heading">
                  <div>
                    <span className="alert-timeline-viewer__stage-state">
                      {stage.state}
                    </span>

                    <h3>{stage.label}</h3>
                  </div>

                  <time>
                    {formattedTimestamp ||
                      (stage.state === "pending"
                        ? "Pending"
                        : "Timestamp unavailable")}
                  </time>
                </div>

                <p>{stage.description}</p>
              </div>
            </article>
          );
        })}
      </div>

      {customEvents.length > 0 && (
        <div className="alert-timeline-viewer__activity">
          <div className="alert-timeline-viewer__activity-header">
            <div>
              <span className="alert-timeline-viewer__activity-eyebrow">
                Supplemental Telemetry
              </span>

              <h3>Additional Activity</h3>
            </div>

            <span className="alert-timeline-viewer__activity-count">
              {customEvents.length}
            </span>
          </div>

          <div className="alert-timeline-viewer__custom-events">
            {customEvents.map((event, index) => {
              const timestamp = formatDate(event.timestamp || event.createdAt);

              return (
                <div
                  key={`custom-${index}`}
                  className="alert-timeline-viewer__custom-event"
                >
                  <div
                    className="alert-timeline-viewer__custom-marker"
                    aria-hidden="true"
                  />

                  <div className="alert-timeline-viewer__custom-content">
                    <strong>
                      {formatLabel(event.action || event.status || "Event")}
                    </strong>

                    <span>{timestamp || "Timestamp unavailable"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default AlertTimelineViewer;
