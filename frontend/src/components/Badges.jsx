export function ProvenanceBadge({ provenance }) {
  if (!provenance) return null;
  const p = provenance.toLowerCase();
  if (p === 'live') return <span className="badge badge-live">🟢 LIVE</span>;
  if (p === 'historical') return <span className="badge badge-historical">🔵 HISTORICAL</span>;
  return <span className="badge badge-demo">🟡 DEMO</span>;
}

export function RiskBadge({ level }) {
  if (!level) return null;
  return <span className={`risk-badge ${level}`}>{level}</span>;
}
