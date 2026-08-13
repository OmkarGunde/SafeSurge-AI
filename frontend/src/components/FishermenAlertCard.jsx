import { ProvenanceBadge } from './Badges';

export default function FishermenAlertCard({ alert }) {
  if (!alert) return (
    <div style={{ color: '#8a9ab8', fontSize: 12, textAlign: 'center', padding: 20 }}>
      Run the full scenario to generate fishermen alerts.
    </div>
  );

  const level = alert.alert_level || 'RED';

  return (
    <div className="alert-card" style={{ border: '1px solid #2a3548', borderRadius: 12, overflow: 'hidden' }}>
      <div className={`alert-level-banner ${level}`}>
        {level === 'EXTREME_RED' && '🚨 EXTREME RED ALERT'}
        {level === 'RED' && '🔴 RED ALERT — DANGER'}
        {level === 'AMBER' && '🟡 AMBER ALERT — WARNING'}
        {level === 'GREEN' && '🟢 GREEN — SAFE CONDITIONS'}
        {!['EXTREME_RED','RED','AMBER','GREEN'].includes(level) && `🚨 ${level}`}
        {alert.boat_recall && <span style={{ marginLeft: 12, fontSize: 12 }}>⚓ BOAT RECALL IN EFFECT</span>}
      </div>
      <div className="alert-langs">
        {/* English */}
        <div className="alert-lang">
          <div className="alert-lang-label">🇬🇧 English</div>
          <div className="alert-lang-headline">{alert.alert_en?.headline}</div>
          <div className="alert-lang-body">{alert.alert_en?.body}</div>
          <div className="alert-lang-advice">{alert.alert_en?.fishing_advice}</div>
        </div>
        {/* Hindi */}
        <div className="alert-lang">
          <div className="alert-lang-label">🇮🇳 हिंदी</div>
          <div className="alert-lang-headline">{alert.alert_hi?.headline}</div>
          <div className="alert-lang-body">{alert.alert_hi?.body}</div>
          <div className="alert-lang-advice">{alert.alert_hi?.fishing_advice}</div>
        </div>
        {/* Gujarati */}
        <div className="alert-lang">
          <div className="alert-lang-label">🌊 ગુજરાતી</div>
          <div className="alert-lang-headline">{alert.alert_gu?.headline}</div>
          <div className="alert-lang-body">{alert.alert_gu?.body}</div>
          <div className="alert-lang-advice">{alert.alert_gu?.fishing_advice}</div>
        </div>
      </div>
      <div style={{ background: '#111827', padding: '8px 14px', fontSize: 11, color: '#8a9ab8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          Confidence: {alert.confidence ? `${Math.round(alert.confidence * 100)}%` : 'N/A'} &nbsp;·&nbsp;
          Port closure: {alert.port_closure_advised ? '⚠️ Advised' : 'Not required'}
        </span>
        <ProvenanceBadge provenance={alert.provenance || 'historical'} />
      </div>
    </div>
  );
}
