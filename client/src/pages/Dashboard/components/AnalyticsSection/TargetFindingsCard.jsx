import useFindings from "../../../../hooks/useFindings";

function TargetFindingsCard() {
  const { findings } = useFindings();

  const targetCounts = findings.reduce((accumulator, finding) => {
    const target = (finding.target || "Unknown").trim();

    accumulator[target] = (accumulator[target] || 0) + 1;

    return accumulator;
  }, {});

  const data = Object.entries(targetCounts)
    .map(([label, value]) => ({
      label,
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <article className="analytics-card">
      <div className="analytics-card__header">
        <h3 className="analytics-card__title">Recent Target Findings</h3>
      </div>

      <div className="analytics-card__content">
        {data.map((item) => (
          <div className="analytics-card__row" key={item.label}>
            <div className="analytics-card__meta">
              <span className="analytics-card__label">{item.label}</span>

              <span className="analytics-card__value">{item.value}</span>
            </div>

            <div className="analytics-card__track">
              <div
                className="analytics-card__bar"
                style={{
                  width: `${(item.value / max) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default TargetFindingsCard;
