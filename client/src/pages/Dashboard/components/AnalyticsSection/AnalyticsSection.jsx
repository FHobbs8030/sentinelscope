import "./AnalyticsSection.css";

import SeverityChartCard from "./SeverityChartCard";
import TargetFindingsCard from "./TargetFindingsCard";
import ScanDistributionCard from "./ScanDistributionCard";

function AnalyticsSection() {
  return (
    <section className="analytics-section">
      <div className="analytics-section__grid">
        <SeverityChartCard />
        <TargetFindingsCard />
        <ScanDistributionCard />
      </div>
    </section>
  );
}

export default AnalyticsSection;
