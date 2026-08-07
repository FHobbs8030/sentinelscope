import useFindings from "../../hooks/useFindings";

import "./TargetRiskPanel.css";

function TargetRiskPanel() {
  const { severityMetrics: summary } = useFindings();

  return (
    <section className="dashboard-card target-risk-panel">
      <div className="panel-header">
        <h3>Risk Overview</h3>
      </div>

      <div className="risk-grid">
        <div className="risk-card critical">
          <span>Critical</span>
          <strong>{summary.critical}</strong>
        </div>

        <div className="risk-card high">
          <span>High</span>
          <strong>{summary.high}</strong>
        </div>

        <div className="risk-card medium">
          <span>Medium</span>
          <strong>{summary.medium}</strong>
        </div>

        <div className="risk-card low">
          <span>Low</span>
          <strong>{summary.low}</strong>
        </div>
      </div>
    </section>
  );
}

export default TargetRiskPanel;
