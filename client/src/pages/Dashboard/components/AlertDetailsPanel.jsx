import { useEffect, useRef, useState } from "react";

import "./AlertDetailsPanel.css";

function getSeverityClass(severity) {
  const normalizedSeverity = severity?.toLowerCase();

  return [
    "alert-details-panel__badge",
    "alert-details-panel__badge--severity",
    normalizedSeverity
      ? `alert-details-panel__badge--${normalizedSeverity}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getStatusClass(status) {
  const normalizedStatus = status?.toLowerCase();

  return [
    "alert-details-panel__badge",
    "alert-details-panel__badge--status",
    normalizedStatus
      ? `alert-details-panel__badge--status-${normalizedStatus}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "N/A";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString();
}

function getRiskScore(alert) {
  const numericRiskScore = Number(alert?.riskScore);

  if (!Number.isFinite(numericRiskScore)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(numericRiskScore)));
}

function getRiskLabel(riskScore, severity) {
  if (riskScore !== null) {
    if (riskScore >= 90) {
      return "Immediate investigation";
    }

    if (riskScore >= 70) {
      return "Elevated response priority";
    }

    if (riskScore >= 40) {
      return "Review recommended";
    }

    return "Monitor";
  }

  switch (severity?.toLowerCase()) {
    case "critical":
      return "Immediate investigation";

    case "high":
      return "Elevated response priority";

    case "medium":
      return "Review recommended";

    default:
      return "Monitor";
  }
}

function AlertDetailsPanel({ alert }) {
  const [copiedIdentifier, setCopiedIdentifier] = useState(null);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!alert) {
    return (
      <section className="alert-details-panel">
        <div className="alert-details-panel__empty">
          <span className="alert-details-panel__empty-icon" aria-hidden="true">
            ◇
          </span>

          <div>
            <h2>Alert Investigation</h2>
            <p>Select an alert to view investigation details.</p>
          </div>
        </div>
      </section>
    );
  }

  const riskScore = getRiskScore(alert);

  const alertRecordId = alert._id || null;

  const runtimeAlertId =
    alert.id && String(alert.id) !== String(alertRecordId) ? alert.id : null;

  const identifiers = [
    {
      key: "alert-record",
      label: "Alert Database ID",
      value: alertRecordId || alert.id || null,
    },
    {
      key: "alert-runtime",
      label: "Alert Runtime ID",
      value: runtimeAlertId,
    },
    {
      key: "scan",
      label: "Scan ID",
      value: alert.scanId || null,
    },
    {
      key: "mission",
      label: "Mission ID",
      value: alert.missionId || null,
    },
  ].filter((identifier) => identifier.value);

  const copyIdentifier = async (key, value) => {
    if (!value || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(String(value));

      setCopiedIdentifier(key);

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = window.setTimeout(() => {
        setCopiedIdentifier(null);
        copyTimerRef.current = null;
      }, 1800);
    } catch (error) {
      console.error("Unable to copy alert identifier:", error);
    }
  };

  return (
    <section className="alert-details-panel">
      <header className="alert-details-panel__hero">
        <div className="alert-details-panel__hero-content">
          <span className="alert-details-panel__eyebrow">
            Selected Threat Alert
          </span>

          <div className="alert-details-panel__badges">
            <span className={getSeverityClass(alert.severity)}>
              <span
                className="alert-details-panel__badge-dot"
                aria-hidden="true"
              />

              {alert.severity || "Unknown"}
            </span>

            <span className={getStatusClass(alert.status)}>
              {alert.status || "Unknown"}
            </span>
          </div>

          <h2 className="alert-details-panel__alert-title">
            {alert.title || "Security Alert"}
          </h2>

          <p className="alert-details-panel__target">
            {alert.target || "Unknown target"}
          </p>

          <p className="alert-details-panel__priority">
            {getRiskLabel(riskScore, alert.severity)}
          </p>
        </div>

        <div className="alert-details-panel__risk">
          <span className="alert-details-panel__risk-label">Threat Risk</span>

          <div className="alert-details-panel__risk-score">
            <strong>{riskScore ?? "—"}</strong>

            {riskScore !== null ? <span>/100</span> : null}
          </div>

          <div className="alert-details-panel__risk-track">
            <div
              className={`alert-details-panel__risk-fill alert-details-panel__risk-fill--${
                alert.severity?.toLowerCase() || "unknown"
              }`}
              style={{
                width: `${riskScore ?? 0}%`,
              }}
            />
          </div>

          <span className="alert-details-panel__risk-caption">
            Individual alert risk score
          </span>
        </div>
      </header>

      <div className="alert-details-panel__section">
        <div className="alert-details-panel__section-heading">
          <div>
            <span className="alert-details-panel__section-eyebrow">
              Operational Context
            </span>

            <h3>Alert Overview</h3>
          </div>
        </div>

        <div className="alert-details-panel__context-grid">
          <div className="alert-details-panel__context-item">
            <span>Target</span>
            <strong>{alert.target || "N/A"}</strong>
          </div>

          <div className="alert-details-panel__context-item">
            <span>Detection Source</span>
            <strong>{alert.source || "N/A"}</strong>
          </div>

          <div className="alert-details-panel__context-item">
            <span>Affected Asset</span>
            <strong>{alert.affectedAsset || alert.target || "N/A"}</strong>
          </div>

          <div className="alert-details-panel__context-item">
            <span>Created</span>
            <strong>{formatDate(alert.createdAt)}</strong>
          </div>

          <div className="alert-details-panel__context-item">
            <span>Last Updated</span>
            <strong>{formatDate(alert.updatedAt)}</strong>
          </div>
        </div>
      </div>

      <div className="alert-details-panel__section">
        <div className="alert-details-panel__section-heading">
          <div>
            <span className="alert-details-panel__section-eyebrow">
              Investigation References
            </span>

            <h3>Identifiers</h3>
          </div>

          <span className="alert-details-panel__identifier-count">
            {identifiers.length} available
          </span>
        </div>

        <div className="alert-details-panel__identifiers">
          {identifiers.map((identifier) => (
            <div
              key={identifier.key}
              className="alert-details-panel__identifier"
            >
              <div className="alert-details-panel__identifier-content">
                <span>{identifier.label}</span>

                <code title={String(identifier.value)}>
                  {String(identifier.value)}
                </code>
              </div>

              <button
                type="button"
                className="alert-details-panel__copy-button"
                onClick={() => {
                  void copyIdentifier(identifier.key, identifier.value);
                }}
              >
                {copiedIdentifier === identifier.key ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default AlertDetailsPanel;
