import { ProvenanceBadge } from './Badges';

export default function ReliefPanel({ relief }) {
  if (!relief) return (
    <div style={{ color: '#8a9ab8', fontSize: 12, textAlign: 'center', padding: 20 }}>
      Run the full scenario to generate relief resource estimates.
    </div>
  );

  const rs = relief.resource_summary || {};
  const rr = relief.resource_requirements || {};
  const actions = relief.mobilization_actions || [];

  return (
    <div>
      {/* Resource Summary */}
      <div className="relief-grid" style={{ marginBottom: 12 }}>
        <div className="relief-stat">
          <div className="relief-stat-val">{rs.total_people_needing_shelter?.toLocaleString()}</div>
          <div className="relief-stat-lbl">People needing shelter</div>
          <ProvenanceBadge provenance="historical" />
        </div>
        <div className="relief-stat">
          <div className={`relief-stat-val ${rs.shelter_deficit > 0 ? 'relief-gap' : 'relief-ok'}`}>
            {rs.shelter_deficit > 0 ? `▼ ${rs.shelter_deficit?.toLocaleString()}` : `✓ ${Math.abs(rs.shelter_deficit || 0)?.toLocaleString()} surplus`}
          </div>
          <div className="relief-stat-lbl">Shelter deficit</div>
          <ProvenanceBadge provenance="demo" />
        </div>
        <div className="relief-stat">
          <div className="relief-stat-val">{rr.food_packets_72h?.toLocaleString()}</div>
          <div className="relief-stat-lbl">Food packets (72h)</div>
          <ProvenanceBadge provenance="demo" />
        </div>
        <div className="relief-stat">
          <div className="relief-stat-val">{rr.water_liters_72h?.toLocaleString()}</div>
          <div className="relief-stat-lbl">Water liters (72h)</div>
          <ProvenanceBadge provenance="demo" />
        </div>
        <div className="relief-stat">
          <div className="relief-stat-val">{rr.medical_teams_needed}</div>
          <div className="relief-stat-lbl">Medical teams</div>
          <ProvenanceBadge provenance="demo" />
        </div>
        <div className="relief-stat">
          <div className="relief-stat-val">{rr.rescue_boats_needed}</div>
          <div className="relief-stat-lbl">Rescue boats</div>
          <ProvenanceBadge provenance="demo" />
        </div>
      </div>

      {/* Mobilization Actions */}
      {actions.length > 0 && (
        <div>
          <div className="card-title" style={{ marginBottom: 8 }}>⚡ Mobilization Actions</div>
          {actions.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: a.priority === 'HIGH' ? 'rgba(220,38,38,0.2)' : 'rgba(245,158,11,0.2)',
                color: a.priority === 'HIGH' ? '#f87171' : '#fcd34d',
                flexShrink: 0, marginTop: 1
              }}>{a.priority}</span>
              <div>
                <div style={{ fontSize: 12 }}>{a.action}</div>
                <div style={{ fontSize: 11, color: '#8a9ab8' }}>{a.responsible_agency} · T+{a.timeline_hours}h</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {relief.disclaimer && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#8a9ab8', borderTop: '1px solid #2a3548', paddingTop: 8 }}>
          ⚠️ {relief.disclaimer}
        </div>
      )}
    </div>
  );
}
