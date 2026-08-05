import { useEffect, useRef, useState } from "react";

import useAlerts from "../../../hooks/useAlerts";

import "./AlertIntelligenceDrawer.css";

function getAlertId(alert) {
  return alert?._id || alert?.id || null;
}

function getRiskAssessment(severity) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "Immediate investigation required. Potential high-impact exposure detected.";

    case "high":
      return "Elevated risk identified. Review findings and validate exposure.";

    case "medium":
      return "Moderate operational risk. Monitor and investigate as needed.";

    case "low":
      return "Low-risk alert. Track for future review.";

    default:
      return "No risk assessment available.";
  }
}

function getSeverityClass(severity) {
  const normalizedSeverity = severity?.toLowerCase();

  return [
    "alert-intelligence-severity",
    normalizedSeverity
      ? `alert-intelligence-severity--${normalizedSeverity}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getRiskScore(alert) {
  const numericRiskScore = Number(alert?.riskScore);

  if (!Number.isFinite(numericRiskScore)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(numericRiskScore)));
}

function getEvidenceText(evidence) {
  if (typeof evidence === "string") {
    return evidence;
  }

  return (
    evidence?.message ||
    evidence?.description ||
    evidence?.title ||
    "Evidence recorded"
  );
}

function getRecommendationText(recommendation) {
  if (typeof recommendation === "string") {
    return recommendation;
  }

  return (
    recommendation?.action ||
    recommendation?.title ||
    recommendation?.description ||
    "Review recommendation"
  );
}

function getFindingIdentifier(finding) {
  if (typeof finding === "string") {
    return finding;
  }

  return (
    finding?.clientFindingId || finding?._id || finding?.id || "Unknown finding"
  );
}

function AlertIntelligenceDrawer({ alert }) {
  const [copiedFindingId, setCopiedFindingId] = useState(null);
  const copyTimerRef = useRef(null);
  const { isUpdating, acknowledge, investigate, resolve, close } = useAlerts();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!alert) {
    return (
      <section className="alert-intelligence-drawer">
        <div className="alert-intelligence-drawer__empty">
          <span aria-hidden="true">⌁</span>

          <div>
            <h2>Threat Intelligence</h2>
            <p>Select an alert to view intelligence context.</p>
          </div>
        </div>
      </section>
    );
  }

  const alertId = getAlertId(alert);

  const getWorkflowActionLabel = () => {
    switch (alert.status) {
      case "open":
        return "Acknowledge";

      case "acknowledged":
        return "Investigate";

      case "investigating":
        return "Resolve";

      case "resolved":
        return "Close";

      default:
        return null;
    }
  };

  const runWorkflowAction = () => {
    if (!alertId) {
      return;
    }

    switch (alert.status) {
      case "open":
        void acknowledge(alertId);
        break;

      case "acknowledged":
        void investigate(alertId);
        break;

      case "investigating":
        void resolve(alertId);
        break;

      case "resolved":
        void close(alertId);
        break;

      default:
        break;
    }
  };

  const workflowActionLabel = getWorkflowActionLabel();

  const riskScore = getRiskScore(alert);

  const copyFindingId = async (findingId) => {
    if (!findingId || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(String(findingId));

      setCopiedFindingId(String(findingId));

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = window.setTimeout(() => {
        setCopiedFindingId(null);
        copyTimerRef.current = null;
      }, 1800);
    } catch (error) {
      console.error("Unable to copy finding identifier:", error);
    }
  };

  return (
    <section className="alert-intelligence-drawer">
      <header className="alert-intelligence-drawer__header">
        <div>
          <span className="alert-intelligence-drawer__eyebrow">
            Analyst Intelligence Workspace
          </span>

          <h2 className="alert-intelligence-drawer__title">
            Threat Intelligence
          </h2>

          <p className="alert-intelligence-drawer__subtitle">
            Evidence, threat context, and recommended response for the selected
            security alert.
          </p>
        </div>

        <div className={getSeverityClass(alert.severity)}>
          <span
            className="alert-intelligence-severity__dot"
            aria-hidden="true"
          />

          {alert.severity || "Unknown"}
        </div>
      </header>

      <div className="alert-intelligence-drawer__assessment">
        <div className="alert-intelligence-drawer__assessment-copy">
          <span className="alert-intelligence-drawer__section-eyebrow">
            Threat Assessment
          </span>

          <h3>{getRiskAssessment(alert.severity)}</h3>

          <p>
            Detection source:{" "}
            <strong>{alert.source || "Unknown detection source"}</strong>
          </p>
        </div>

        <div className="alert-intelligence-drawer__score">
          <span>Risk</span>

          <strong>{riskScore ?? "—"}</strong>

          {riskScore !== null ? <small>/100</small> : null}

          <div className="alert-intelligence-drawer__score-track">
            <div
              className={`alert-intelligence-drawer__score-fill alert-intelligence-drawer__score-fill--${
                alert.severity?.toLowerCase() || "unknown"
              }`}
              style={{
                width: `${riskScore ?? 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="alert-intelligence-drawer__layout">
        <section className="alert-intelligence-panel">
          <header className="alert-intelligence-panel__header">
            <div>
              <span className="alert-intelligence-drawer__section-eyebrow">
                Detection Record
              </span>

              <h3>Evidence Timeline</h3>
            </div>

            <span className="alert-intelligence-panel__count">
              {alert.evidence?.length ?? 0}
            </span>
          </header>

          {alert.evidence?.length ? (
            <div className="alert-evidence-timeline">
              {alert.evidence.map((item, index) => (
                <div
                  key={`${getEvidenceText(item)}-${index}`}
                  className="alert-evidence-timeline__event"
                >
                  <div className="alert-evidence-timeline__rail">
                    <span className="alert-evidence-timeline__dot" />
                  </div>

                  <div className="alert-evidence-timeline__content">
                    <span className="alert-evidence-timeline__index">
                      Evidence {String(index + 1).padStart(2, "0")}
                    </span>

                    <strong>{getEvidenceText(item)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="alert-intelligence-panel__empty">
              No evidence available.
            </p>
          )}
        </section>

        <section className="alert-intelligence-panel">
          <header className="alert-intelligence-panel__header">
            <div>
              <span className="alert-intelligence-drawer__section-eyebrow">
                Classification
              </span>

              <h3>Threat Context</h3>
            </div>
          </header>

          {alert.threatContext ? (
            <div className="alert-threat-context">
              <div className="alert-threat-context__item">
                <span>Category</span>

                <strong>
                  {alert.threatContext.category || "Not classified"}
                </strong>
              </div>

              <div className="alert-threat-context__item">
                <span>Confidence</span>

                <strong>{alert.threatContext.confidence || "Unknown"}</strong>
              </div>

              <div className="alert-threat-context__item">
                <span>Detection Stage</span>

                <strong>{alert.threatContext.stage || "Unknown"}</strong>
              </div>
            </div>
          ) : (
            <p className="alert-intelligence-panel__empty">
              No threat context available.
            </p>
          )}
        </section>
      </div>

      <section className="alert-intelligence-panel">
        <header className="alert-intelligence-panel__header">
          <div>
            <span className="alert-intelligence-drawer__section-eyebrow">
              Analyst Guidance
            </span>

            <h3>Recommended Response</h3>
          </div>

          <span className="alert-intelligence-panel__count">
            {alert.recommendedActions?.length ?? 0}
          </span>
        </header>

        {alert.recommendedActions?.length ? (
          <div className="alert-response-list">
            {alert.recommendedActions.map((action, index) => (
              <div
                key={`${getRecommendationText(action)}-${index}`}
                className="alert-response-list__item"
              >
                <span className="alert-response-list__number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div>
                  <strong>{getRecommendationText(action)}</strong>

                  <span>Recommended analyst response</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="alert-intelligence-panel__empty">
            No recommendations available.
          </p>
        )}
      </section>

      <section className="alert-intelligence-panel">
        <header className="alert-intelligence-panel__header">
          <div>
            <span className="alert-intelligence-drawer__section-eyebrow">
              Correlated Intelligence
            </span>

            <h3>Related Findings</h3>
          </div>

          <span className="alert-intelligence-panel__count">
            {alert.relatedFindings?.length ?? 0}
          </span>
        </header>

        {alert.relatedFindings?.length ? (
          <div className="alert-related-findings">
            {alert.relatedFindings.map((finding, index) => {
              const findingId = getFindingIdentifier(finding);

              return (
                <div
                  key={`${findingId}-${index}`}
                  className="alert-related-findings__item"
                >
                  <div className="alert-related-findings__content">
                    <span>Finding {String(index + 1).padStart(2, "0")}</span>

                    <code title={String(findingId)}>{findingId}</code>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void copyFindingId(findingId);
                    }}
                  >
                    {copiedFindingId === String(findingId)
                      ? "Copied"
                      : "Copy ID"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="alert-intelligence-panel__empty">
            No related findings linked.
          </p>
        )}
      </section>

      <footer className="alert-intelligence-drawer__actions">
        <div className="alert-intelligence-drawer__actions-heading">
          <span className="alert-intelligence-drawer__section-eyebrow">
            Response Actions
          </span>

          <strong>Advance the investigation</strong>
        </div>

        <div className="alert-intelligence-drawer__action-buttons">
          {workflowActionLabel ? (
            <button
              type="button"
              className="alert-action-button alert-action-button--primary"
              disabled={isUpdating}
              onClick={runWorkflowAction}
            >
              {isUpdating ? "Updating..." : workflowActionLabel}
            </button>
          ) : null}

          <button
            type="button"
            className="alert-action-button"
            disabled
            title="Analyst assignment is planned for a future release."
          >
            Assign Analyst — Planned
          </button>

          <button
            type="button"
            className="alert-action-button"
            disabled
            title="Incident creation is planned for a future release."
          >
            Create Incident — Planned
          </button>

          <button
            type="button"
            className="alert-action-button"
            disabled
            title="Alert report export is planned for a future release."
          >
            Export Report — Planned
          </button>
        </div>
      </footer>
    </section>
  );
}

export default AlertIntelligenceDrawer;
