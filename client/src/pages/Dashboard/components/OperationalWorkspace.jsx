import "./OperationalWorkspace.css";

import ScanLaunchPanel from "./ScanLaunchPanel";
import RecentScansPanel from "./RecentScansPanel";
import FindingsSeverityPanel from "./FindingsSeverityPanel";
import OperationsSummaryPanel from "./OperationsSummaryPanel";

import ActivityFeed from "../../../components/ActivityFeed";

import useScans from "../../../hooks/useScans";
import useMissions from "../../../hooks/useMissions";

function OperationalWorkspace({ focusType, focusId }) {
  const { scans, metrics } = useScans();
  const { metrics: missionMetrics } = useMissions();

  const totalTargets = new Set(scans.map((scan) => scan.target).filter(Boolean))
    .size;

  return (
    <section className="operations-workspace">
      <div className="operations-workspace-header">
        <div>
          <h2 className="operations-workspace-title">Operational Workspace</h2>

          <p className="operations-workspace-subtitle">
            Live operational telemetry, scan execution and mission activity.
          </p>
        </div>

        <div className="operations-workspace-stats">
          <span>
            <strong>{metrics.activeScans}</strong> Active Scans
          </span>

          <span>
            <strong>{totalTargets}</strong> Targets
          </span>

          <span>
            <strong>{missionMetrics.runningMissions}</strong> Running Missions
          </span>
        </div>
      </div>

      <div className="operations-row">
        <div className="operations-launch-slot">
          <ScanLaunchPanel />
        </div>

        <div className="operations-scans-slot">
          <RecentScansPanel focusType={focusType} focusId={focusId} />
        </div>

        <div className="operations-activity-slot">
          <ActivityFeed />
        </div>
      </div>

      <OperationsSummaryPanel />

      <FindingsSeverityPanel />
    </section>
  );
}

export default OperationalWorkspace;
