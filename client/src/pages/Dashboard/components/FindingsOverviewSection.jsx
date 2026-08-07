import "./FindingsOverviewSection.css";

import useFindings from "../../../hooks/useFindings";

function FindingsOverviewSection() {
  const {
    severityMetrics,
    totalFindings,
    findingExposureScore,
    isLoading,
    hasLoaded,
    error,
    refreshFindings,
  } = useFindings();

  const exposureStatus =
    severityMetrics.critical > 0
      ? "critical"
      : severityMetrics.high > 0 || severityMetrics.medium > 0
        ? "warning"
        : "positive";

  const findingsData = [
    {
      id: 1,
      label: "Total Findings",
      value: totalFindings,
      trend: "Persisted in MongoDB",
      status: totalFindings > 0 ? "warning" : "positive",
    },
    {
      id: 2,
      label: "Critical Findings",
      value: severityMetrics.critical,
      trend: "Immediate remediation required",
      status: severityMetrics.critical > 0 ? "critical" : "positive",
    },
    {
      id: 3,
      label: "High Severity",
      value: severityMetrics.high,
      trend: "Elevated operational risk",
      status: severityMetrics.high > 0 ? "warning" : "positive",
    },
    {
      id: 4,
      label: "Medium Severity",
      value: severityMetrics.medium,
      trend: "Monitor and prioritize",
      status: severityMetrics.medium > 0 ? "warning" : "positive",
    },
    {
      id: 5,
      label: "Low Severity",
      value: severityMetrics.low,
      trend: "Low operational impact",
      status: "positive",
    },
    {
      id: 6,
      label: "Finding Risk Exposure",
      value: findingExposureScore,
      trend: "Cumulative severity-weighted exposure",
      status: exposureStatus,
    },
  ];

  const retryLoad = () => {
    void refreshFindings();
  };

  if (isLoading && !hasLoaded) {
    return (
      <section className="findings-overview-section">
        <header className="findings-overview-section__header">
          <h2 className="findings-overview-section__title">
            Findings Intelligence
          </h2>
        </header>

        <div
          className="findings-overview-state findings-overview-state--loading"
          role="status"
          aria-live="polite"
        >
          Loading finding intelligence...
        </div>
      </section>
    );
  }

  if (error && !hasLoaded) {
    return (
      <section className="findings-overview-section">
        <header className="findings-overview-section__header">
          <h2 className="findings-overview-section__title">
            Findings Intelligence
          </h2>
        </header>

        <div
          className="findings-overview-state findings-overview-state--error"
          role="alert"
          aria-live="assertive"
        >
          <span>{error}</span>

          <button
            type="button"
            className="findings-overview-state__button"
            onClick={retryLoad}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="findings-overview-section">
      <header className="findings-overview-section__header">
        <h2 className="findings-overview-section__title">
          Findings Intelligence
        </h2>
      </header>

      {error ? (
        <div
          className="findings-overview-state findings-overview-state--error"
          role="alert"
          aria-live="polite"
        >
          <span>{error} Showing the last available finding data.</span>

          <button
            type="button"
            className="findings-overview-state__button"
            onClick={retryLoad}
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading && hasLoaded ? (
        <div
          className="findings-overview-state findings-overview-state--loading"
          role="status"
          aria-live="polite"
        >
          Refreshing finding intelligence...
        </div>
      ) : null}

      <div className="findings-overview-grid">
        {findingsData.map((item) => (
          <article
            key={item.id}
            className={`findings-overview-card findings-overview-card--${item.status}`}
          >
            <div className="findings-overview-card__header">
              <span className="findings-overview-card__label">
                {item.label}
              </span>

              <span className="findings-overview-card__indicator" />
            </div>

            <strong className="findings-overview-card__value">
              {item.value}
            </strong>

            <span className="findings-overview-card__trend">{item.trend}</span>
          </article>
        ))}
      </div>

      {hasLoaded && totalFindings === 0 ? (
        <span className="findings-overview-empty-note">
          No persisted findings are currently available.
        </span>
      ) : null}
    </section>
  );
}

export default FindingsOverviewSection;
