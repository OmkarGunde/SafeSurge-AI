import { ProvenanceBadge } from './Badges';

export default function EvacuationPriorityList({ plan }) {
  if (!plan || !plan.evacuation_priorities || plan.evacuation_priorities.length === 0) {
    return (
      <div style={{ color: '#8a9ab8', fontSize: 12, textAlign: 'center', padding: 20 }}>
        Run the full scenario to generate evacuation priorities.
      </div>
    );
  }

  const prios = plan.evacuation_priorities;
  const totalPop = plan.total_evacuation_population;
  const totalCap = plan.total_shelter_capacity;
  const deficit = plan.overall_shelter_deficit;

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <div className="cond-cell">
          <div className="cond-label">Total Pop.</div>
          <div className="cond-value" style={{ fontSize: 16 }}>{totalPop?.toLocaleString()}</div>
          <ProvenanceBadge provenance="historical" />
        </div>
        <div className="cond-cell">
          <div className="cond-label">Shelter Cap.</div>
          <div className="cond-value" style={{ fontSize: 16 }}>{totalCap?.toLocaleString()}</div>
          <ProvenanceBadge provenance="demo" />
        </div>
        <div className="cond-cell">
          <div className="cond-label">Gap / Surplus</div>
          <div className={`cond-value ${deficit < 0 ? 'relief-gap' : 'relief-ok'}`} style={{ fontSize: 16 }}>
            {deficit < 0 ? `▼ ${Math.abs(deficit)?.toLocaleString()}` : `▲ ${deficit?.toLocaleString()}`}
          </div>
          <ProvenanceBadge provenance="demo" />
        </div>
      </div>

      {plan.timing_window_hours && (
        <div className="data-notice" style={{ marginBottom: 10 }}>
          ⏱ Estimated evacuation window: {plan.timing_window_hours} hours &nbsp;·&nbsp;
          {plan.disclaimer || 'AI recommendation only — not an official order'}
        </div>
      )}

      <div className="evac-list">
        {prios.map((p) => (
          <div key={p.settlement_id || p.rank} className={`evac-item ${p.priority_color || 'orange'}`}>
            <div className="evac-rank">#{p.rank}</div>
            <div>
              <div className="evac-name">{p.settlement_name}</div>
              <div className="evac-meta">
                👥 {p.population_to_evacuate?.toLocaleString()} &nbsp;|&nbsp;
                🏠 Gap: {p.shelter_gap < 0 ? `▼ ${Math.abs(p.shelter_gap)?.toLocaleString()}` : `▲ ${p.shelter_gap?.toLocaleString()}`}
                &nbsp;·&nbsp;<ProvenanceBadge provenance={p.provenance || 'historical'} />
              </div>
              {p.reasoning && <div className="evac-reasoning">"{p.reasoning}"</div>}
              {p.route_advice && <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 3 }}>📍 {p.route_advice}</div>}
            </div>
            <div>
              <div className={`evac-tier`}>{p.priority_tier}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
