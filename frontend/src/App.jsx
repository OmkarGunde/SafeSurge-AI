import { useState, useEffect, useCallback } from 'react';
import './App.css';
import GujaratMap from './components/GujaratMap';
import BiparjoyReplay from './components/BiparjoyReplay';
import AgentChainPanel from './components/AgentChainPanel';
import FishermenAlertCard from './components/FishermenAlertCard';
import EvacuationPriorityList from './components/EvacuationList';
import ReliefPanel from './components/ReliefPanel';
import DamageAssessment from './components/DamageAssessment';
import { ProvenanceBadge, RiskBadge } from './components/Badges';
import { getLatestConditions, getSettlements, getBiparjoyFull, runFullChain, getAgentLogs } from './api';

const TABS = [
  { id: 'dashboard', label: '📊 Command Center' },
  { id: 'fishermen', label: '🎣 Fishermen Alert' },
  { id: 'evacuation', label: '🚨 Evacuation' },
  { id: 'relief', label: '📦 Relief' },
  { id: 'damage', label: '🔍 Damage Assessment' },
  { id: 'logs', label: '🤖 Agent Logs' },
];

export default function App() {
  // mode is now DERIVED from backend data, not user click
  // 'live' | 'historical' | 'loading'
  const [mode, setMode] = useState('loading');
  const [tab, setTab] = useState('dashboard');
  const [conditions, setConditions] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [fullTrack, setFullTrack] = useState([]);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(21);
  const [currentTrackPoint, setCurrentTrackPoint] = useState(null);
  const [running, setRunning] = useState(false);
  const [chainLog, setChainLog] = useState([]);
  const [chainResult, setChainResult] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load static data on mount
  useEffect(() => {
    loadConditions();
    loadSettlements();
    loadFullTrack();
  }, []);

  async function loadConditions() {
    try {
      const r = await getLatestConditions();
      const data = r.data.data;
      setConditions(data);
      // Derive mode from actual backend response, not user click
      setMode(data.mode === 'live' ? 'live' : 'historical');
    } catch (e) { setMode('historical'); }
  }

  async function handleRefreshLive() {
    setRefreshing(true);
    try {
      const r = await fetch('/api/conditions/refresh');
      const json = await r.json();
      if (json.success && json.data) {
        setConditions(json.data);
        setMode(json.data.mode === 'live' ? 'live' : 'historical');
      }
    } catch (e) { /* silent */ }
    setRefreshing(false);
  }

  async function loadSettlements() {
    try {
      const r = await getSettlements();
      setSettlements(r.data.data || []);
    } catch (e) {}
  }

  async function loadFullTrack() {
    try {
      const r = await getBiparjoyFull();
      setFullTrack(r.data.data || []);
    } catch (e) {}
  }

  function handleTrackUpdate(point, idx) {
    setCurrentTrackPoint(point);
    setCurrentTrackIdx(idx);
  }

  // Build conditions object from current state for agent calls
  function buildConditions(overrides = {}) {
    // When mode=live, prefer live conditions from the backend snapshot
    if (mode === 'live' && conditions && conditions.mode === 'live' && !overrides.wind_speed_kmh) {
      return {
        wind_speed_kmh: conditions.wind_speed_kmh?.value,
        wave_height_m: conditions.wave_height_m?.value,
        pressure_hpa: conditions.pressure_hpa?.value || null,
        sst_c: conditions.sea_surface_temp_c?.value,
        current_speed_knots: conditions.current_speed_knots?.value,
        wind_direction_deg: conditions.wind_direction_deg?.value,
        timestamp: conditions.forecast_valid_at || conditions.timestamp,
        provenance: 'live',
        data_source: 'INCOIS Operational Forecast',
        location: conditions.location,
        ...overrides
      };
    }
    const base = currentTrackPoint || {};
    return {
      wind_speed_kmh: overrides.wind_speed_kmh || base.wind_kmh || 157,
      wave_height_m: overrides.wave_height_m || base.wave_height_m || 8.0,
      pressure_hpa: base.pressure_hpa || 950,
      category: base.category || 'Extremely Severe Cyclonic Storm',
      distance_from_gujarat_km: base.distance_from_gujarat_km || 100,
      timestamp: base.timestamp || new Date().toISOString(),
      provenance: overrides.provenance || 'historical',
      ...overrides
    };
  }

  // Run full agent chain
  async function handleRunFullScenario(conditionsOverride) {
    setRunning(true);
    setError(null);
    setChainResult(null);

    // Animate chain log as agents run
    const agents = ['CycloneInterpretation', 'FishermenAlert', 'EvacuationPlanning', 'ReliefCoordination', 'CommandOrchestrator'];
    setChainLog(agents.map(a => ({ agent: a, status: 'pending' })));
    setTab('dashboard');

    // Show first agent as running
    setChainLog([
      { agent: 'CycloneInterpretation', status: 'running' },
      ...agents.slice(1).map(a => ({ agent: a, status: 'pending' }))
    ]);

    try {
      const conds = conditionsOverride || buildConditions();
      const r = await runFullChain(conds);

      if (r.data.success) {
        const result = r.data.data;
        // Mark all done using the actual chain log from backend
        const finalLog = result.chain_log || agents.map(a => ({ agent: a, status: 'done' }));
        setChainLog(finalLog.map(e => ({ ...e, status: 'done' })));
        setChainResult(result);
      } else {
        setError('Agent chain failed: ' + r.data.error);
        setChainLog(agents.map(a => ({ agent: a, status: 'error' })));
      }
    } catch (e) {
      setError('Request failed: ' + (e.response?.data?.error || e.message));
      setChainLog(agents.map(a => ({ agent: a, status: 'error' })));
    } finally {
      setRunning(false);
    }
  }

  // Simulate intensification — called on "Run AI Response" button click only
  function handleSimulate(overrides) {
    handleRunFullScenario(buildConditions(overrides));
  }

  async function loadAgentLogs() {
    try {
      const r = await getAgentLogs();
      setAgentLogs(r.data.data || []);
    } catch (e) {}
  }

  useEffect(() => {
    if (tab === 'logs') loadAgentLogs();
  }, [tab]);

  const conds = conditions;
  const evalConds = chainResult?.command_summary || {};

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span style={{ fontSize: 24 }}>🌊</span>
          <div>
            <h1>SafeSurge AI</h1>
            <div className="subtitle">Agentic Coastal Disaster Intelligence — Gujarat 2026</div>
          </div>
        </div>
        <div className="header-right">
          {/* Provenance Legend */}
          <div className="provenance-legend">
            <span style={{ fontSize: 11, color: '#8a9ab8', marginRight: 4 }}>Data:</span>
            <span className="prov-item"><span className="badge badge-live">🟢 LIVE</span></span>
            <span className="prov-item"><span className="badge badge-historical">🔵 HISTORICAL</span></span>
            <span className="prov-item"><span className="badge badge-demo">🟡 DEMO</span></span>
          </div>
          {/* Mode indicator — derived from backend, not clickable claim */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {mode === 'live' && (
              <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
                🟢 INCOIS OPERATIONAL FORECAST
              </div>
            )}
            {mode === 'historical' && (
              <div style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>
                🔵 HISTORICAL REPLAY — Biparjoy 2023
              </div>
            )}
            {mode === 'loading' && (
              <div style={{ fontSize: 12, color: '#8a9ab8' }}>⏳ Checking INCOIS...</div>
            )}
            <button
              onClick={handleRefreshLive}
              disabled={refreshing}
              style={{ background: 'none', border: '1px solid #2a3548', borderRadius: 6, padding: '4px 10px', color: '#8a9ab8', cursor: 'pointer', fontSize: 11 }}
            >
              {refreshing ? '⏳' : '↻'} Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="app-layout">
        {/* Left / Main Panel */}
        <div className="main-panel">
          {/* Tabs */}
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="notice-banner" style={{ marginBottom: 12, background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── Command Center Tab ─────────────────────────── */}
          {tab === 'dashboard' && (
            <>
              {/* Data Notice */}
              {conds && (
                <div className={conds.mode === 'live' ? 'notice-banner' : 'data-notice'} style={conds.mode === 'live' ? { background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e' } : {}}>
                  {conds.source_label || '🔵 HISTORICAL REAL — Latest Available Dataset'}
                  {conds.mode === 'live' && conds.retrieved_at && (
                    <span style={{ marginLeft: 10, fontSize: 10, opacity: 0.8 }}>
                      Retrieved: {new Date(conds.retrieved_at).toLocaleTimeString()} · Valid: {conds.forecast_valid_at ? new Date(conds.forecast_valid_at).toUTCString().slice(0, 22) : ''} UTC
                    </span>
                  )}
                  {conds.mode !== 'live' && <span style={{ marginLeft: 8 }}>{conds.data_notice}</span>}
                </div>
              )}

              {/* INCOIS Live Status Panel */}
              {conds?.mode === 'live' && (
                <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 11, color: '#8a9ab8', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                  <span><strong style={{ color: '#22c55e' }}>SOURCE</strong> INCOIS OSF</span>
                  <span><strong style={{ color: '#22c55e' }}>TYPE</strong> Operational Forecast</span>
                  <span><strong style={{ color: '#22c55e' }}>LOCATION</strong> {conds.location?.name || 'Gujarat Sea Area'}</span>
                  <span><strong style={{ color: '#22c55e' }}>INIT</strong> {conds.forecast_initialized_at ? new Date(conds.forecast_initialized_at).toLocaleDateString() : '—'}</span>
                  <span><strong style={{ color: '#22c55e' }}>VALID</strong> {conds.forecast_valid_at ? new Date(conds.forecast_valid_at).toUTCString().slice(0, 22) + ' UTC' : '—'}</span>
                </div>
              )}

              {/* Conditions Grid */}
              <div className="conditions-grid">
                <div className="cond-cell">
                  <div className="cond-label">Wind Speed</div>
                  <div className="cond-value" style={{ color: '#f97316' }}>
                    {conds?.wind_speed_kmh?.value != null
                      ? Math.round(conds.wind_speed_kmh.value * 10) / 10
                      : (currentTrackPoint?.wind_kmh ? Math.round(currentTrackPoint.wind_kmh) : '—')}
                  </div>
                  <div className="cond-unit">km/h{conds?.wind_direction_deg?.value != null ? ` @ ${Math.round(conds.wind_direction_deg.value)}°` : ''}</div>
                  <ProvenanceBadge provenance={conds?.wind_speed_kmh?.provenance || 'historical'} />
                </div>
                <div className="cond-cell">
                  <div className="cond-label">Wave Height (SWH)</div>
                  <div className="cond-value" style={{ color: '#3b82f6' }}>
                    {conds?.wave_height_m?.value != null
                      ? (Math.round(conds.wave_height_m.value * 100) / 100).toFixed(2)
                      : (currentTrackPoint?.wave_height_m?.toFixed(1) || '—')}
                  </div>
                  <div className="cond-unit">metres (significant)</div>
                  <ProvenanceBadge provenance={conds?.wave_height_m?.provenance || 'historical'} />
                </div>
                <div className="cond-cell">
                  <div className="cond-label">Pressure (MSLP)</div>
                  <div className="cond-value">
                    {conds?.pressure_hpa?.value != null
                      ? conds.pressure_hpa.value
                      : (currentTrackPoint?.pressure_hpa || '—')}
                  </div>
                  <div className="cond-unit">
                    hPa
                    {conds?.pressure_hpa?.source && conds.pressure_hpa.value != null && (
                      <span style={{ display: 'block', fontSize: 9, color: '#6b7a99', marginTop: 1 }}>Open-Meteo/ECMWF</span>
                    )}
                    {conds?.pressure_hpa?.value == null && !currentTrackPoint?.pressure_hpa && (
                      <span style={{ fontSize: 10, color: '#6b7a99' }}> N/A</span>
                    )}
                  </div>
                  <ProvenanceBadge provenance={conds?.pressure_hpa?.provenance || (currentTrackPoint ? 'historical' : 'demo')} />
                </div>
                <div className="cond-cell">
                  <div className="cond-label">Sea Surface Temp</div>
                  <div className="cond-value">
                    {conds?.sea_surface_temp_c?.value != null ? conds.sea_surface_temp_c.value : '—'}
                  </div>
                  <div className="cond-unit">°C</div>
                  <ProvenanceBadge provenance={conds?.sea_surface_temp_c?.provenance || 'demo'} />
                </div>
                <div className="cond-cell">
                  <div className="cond-label">Risk Level</div>
                  <div className="cond-value" style={{ fontSize: 14 }}>
                    {chainResult?.command_summary?.overall_threat_level
                      ? <RiskBadge level={chainResult.command_summary.overall_threat_level} />
                      : <span style={{ fontSize: 11, color: '#8a9ab8' }}>Awaiting AI assessment</span>}
                  </div>
                  <ProvenanceBadge provenance={chainResult ? 'live' : 'none'} />
                </div>
                <div className="cond-cell">
                  <div className="cond-label">Category</div>
                  <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
                    {currentTrackPoint?.category || conds?.cyclone_category?.value || 'Extremely Severe'}
                  </div>
                  <ProvenanceBadge provenance="historical" />
                </div>
              </div>

              {/* Map */}
              <GujaratMap
                track={fullTrack}
                currentTrackIdx={currentTrackIdx}
                settlements={settlements}
                evacuationPriorities={chainResult?.evacuation_plan?.evacuation_priorities}
              />

              {/* Biparjoy Replay + Simulate */}
              <div style={{ marginTop: 14 }}>
                <BiparjoyReplay onTrackUpdate={handleTrackUpdate} onSimulate={handleSimulate} />
              </div>

              {/* Command Summary */}
              {chainResult?.command_summary && (
                <div className="card" style={{ marginTop: 14 }}>
                  <div className="card-title"><span className="icon">🛡️</span> Command Center Summary
                    <ProvenanceBadge provenance={chainResult.provenance} />
                  </div>
                  <div className="command-summary-box">
                    {chainResult.command_summary.command_summary}
                  </div>
                  {chainResult.command_summary.immediate_priorities?.length > 0 && (
                    <div className="command-actions" style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, color: '#8a9ab8', fontWeight: 700, marginBottom: 4 }}>IMMEDIATE PRIORITIES</div>
                      {chainResult.command_summary.immediate_priorities.map((p, i) => (
                        <div key={i} className="command-action">
                          <div className="command-action-num">{i + 1}</div>
                          <div style={{ fontSize: 12 }}>{p}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {chainResult.command_summary.disclaimer && (
                    <div style={{ marginTop: 10, fontSize: 11, color: '#8a9ab8', fontStyle: 'italic' }}>
                      ⚠️ {chainResult.command_summary.disclaimer}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Fishermen Alert Tab ───────────────────────── */}
          {tab === 'fishermen' && (
            <div className="card">
              <div className="card-title"><span className="icon">🎣</span> Fishermen Safety Alert</div>
              <FishermenAlertCard alert={chainResult?.fishermen_alert} />
            </div>
          )}

          {/* ── Evacuation Tab ────────────────────────────── */}
          {tab === 'evacuation' && (
            <div className="card">
              <div className="card-title"><span className="icon">🚨</span> Evacuation Priority Plan
                {chainResult?.evacuation_plan && <ProvenanceBadge provenance={chainResult.evacuation_plan.provenance || 'historical'} />}
              </div>
              <EvacuationPriorityList plan={chainResult?.evacuation_plan} />
            </div>
          )}

          {/* ── Relief Tab ────────────────────────────────── */}
          {tab === 'relief' && (
            <div className="card">
              <div className="card-title"><span className="icon">📦</span> Relief Resource Coordination
                {chainResult?.relief_coordination && <ProvenanceBadge provenance={chainResult.relief_coordination.provenance || 'demo'} />}
              </div>
              <ReliefPanel relief={chainResult?.relief_coordination} />
            </div>
          )}

          {/* ── Damage Assessment Tab ─────────────────────── */}
          {tab === 'damage' && (
            <div className="card">
              <div className="card-title"><span className="icon">🔍</span> Post-Disaster Damage Assessment</div>
              <DamageAssessment />
            </div>
          )}

          {/* ── Agent Logs Tab ────────────────────────────── */}
          {tab === 'logs' && (
            <div className="card">
              <div className="card-title"><span className="icon">🤖</span> Agent Execution Log</div>
              {agentLogs.length === 0
                ? <div style={{ color: '#8a9ab8', fontSize: 12 }}>No agent runs logged yet. Run the scenario first.</div>
                : agentLogs.map((log, i) => (
                  <div key={i} style={{ borderBottom: '1px solid #2a3548', paddingBottom: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: 12 }}>{log.agent_name}</strong>
                      <span style={{ fontSize: 11, color: '#8a9ab8' }}>{log.latency_ms}ms · {log.created_at}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#8a9ab8', marginBottom: 4 }}>Prompt: {log.prompt_summary}</div>
                    <div style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'monospace', wordBreak: 'break-all' }}>{log.response_summary}</div>
                    <ProvenanceBadge provenance={log.provenance} />
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Right Panel — Agent Chain + Run Button */}
        <div className="right-panel">
          {/* Run Full Scenario Button */}
          <button
            className={`run-btn ${running ? 'running' : ''}`}
            onClick={() => handleRunFullScenario()}
            disabled={running}
          >
            {running ? <><span className="spinner" /> Running All Agents...</> : '⚡ Run Full Scenario'}
          </button>

          {running && (
            <div className="notice-banner">
              Running 5-agent chain: Cyclone → Fishermen + Evacuation (parallel) → Relief → Orchestrator.
              This takes 30-90 seconds.
            </div>
          )}

          {/* Agent Reasoning Panel */}
          <AgentChainPanel chainLog={chainLog} result={chainResult} />

          {/* Quick results summary if available */}
          {chainResult && (
            <div className="card" style={{ marginTop: 4 }}>
              <div className="card-title">Quick Results</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9ab8' }}>Threat Level</span>
                  <RiskBadge level={chainResult.command_summary?.overall_threat_level} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9ab8' }}>Alert Level</span>
                  <span style={{ fontWeight: 700 }}>{chainResult.fishermen_alert?.alert_level}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9ab8' }}>Boat Recall</span>
                  <span style={{ fontWeight: 700, color: chainResult.fishermen_alert?.boat_recall ? '#f87171' : '#22c55e' }}>
                    {chainResult.fishermen_alert?.boat_recall ? '⚓ YES' : 'Not Required'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9ab8' }}>Settlements</span>
                  <span style={{ fontWeight: 700 }}>{chainResult.evacuation_plan?.evacuation_priorities?.length || 0} prioritized</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9ab8' }}>Shelter Deficit</span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>
                    {chainResult.relief_coordination?.resource_summary?.shelter_deficit?.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <div style={{ borderTop: '1px solid #2a3548', paddingTop: 6, fontSize: 11, color: '#8a9ab8' }}>
                  Chain time: {chainResult.total_latency_ms ? (chainResult.total_latency_ms / 1000).toFixed(1) + 's' : 'N/A'} &nbsp;·&nbsp;
                  <ProvenanceBadge provenance={chainResult.provenance} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="footer">
          SafeSurge AI is a prototype decision-support platform. AI-generated recommendations are not official government warnings or evacuation orders. &nbsp;·&nbsp;
          Challenge 6 — Gujarat Hackathon 2026 &nbsp;·&nbsp;
          Powered by IBM Granite 4 (ibm/granite-4-h-small) &nbsp;·&nbsp;
          Data: NOAA IBTrACS (historical) · Census 2011 (population) · Synthetic (shelter capacity)
        </footer>
      </div>
    </>
  );
}
