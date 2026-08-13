const AGENTS = [
  { id: 'CycloneInterpretation', icon: '🌀', name: 'Ocean Intelligence', desc: 'Interprets cyclone track & intensity data' },
  { id: 'FishermenAlert', icon: '🎣', name: 'Fishermen Safety', desc: 'Generates EN/HI/GU alerts' },
  { id: 'EvacuationPlanning', icon: '🚨', name: 'Evacuation Planning', desc: 'Prioritizes settlement evacuation' },
  { id: 'ReliefCoordination', icon: '📦', name: 'Relief Coordination', desc: 'Computes resource demand & shortfalls' },
  { id: 'CommandOrchestrator', icon: '🛡️', name: 'Command Summary', desc: 'Assembles unified EOC briefing' },
];

export default function AgentChainPanel({ chainLog, result }) {
  function getStatus(agentId) {
    if (!chainLog || chainLog.length === 0) return 'pending';
    const entry = chainLog.find(e => e.agent === agentId);
    if (!entry) return 'pending';
    return entry.status;
  }

  function getReasoning(agentId, result) {
    if (!result) return null;
    if (agentId === 'CycloneInterpretation' && result.cyclone_interpretation) {
      const ci = result.cyclone_interpretation;
      return ci.interpretation_summary || (ci.factors && ci.factors.slice(0, 2).join(' · '));
    }
    if (agentId === 'FishermenAlert' && result.fishermen_alert) {
      const fa = result.fishermen_alert;
      return `Alert Level: ${fa.alert_level} | Boat recall: ${fa.boat_recall ? 'YES' : 'no'}`;
    }
    if (agentId === 'EvacuationPlanning' && result.evacuation_plan) {
      const ep = result.evacuation_plan;
      const n = ep.evacuation_priorities ? ep.evacuation_priorities.length : 0;
      return `${n} settlements prioritized | Window: ${ep.timing_window_hours}h | Deficit: ${ep.overall_shelter_deficit?.toLocaleString()}`;
    }
    if (agentId === 'ReliefCoordination' && result.relief_coordination) {
      const rc = result.relief_coordination;
      return rc.resource_summary
        ? `Shelter gap: ${rc.resource_summary.shelter_deficit?.toLocaleString()} | Medical teams: ${rc.resource_requirements?.medical_teams_needed}`
        : null;
    }
    if (agentId === 'CommandOrchestrator' && result.command_summary) {
      const cs = result.command_summary;
      return cs.command_summary?.substring(0, 120) + '...';
    }
    return null;
  }

  return (
    <div>
      <div className="card-title"><span className="icon">🤖</span> Agent Reasoning Panel</div>
      <div className="agent-chain">
        {AGENTS.map((agent, i) => {
          const status = getStatus(agent.id);
          const reasoning = getReasoning(agent.id, result);
          return (
            <div key={agent.id} className={`agent-step ${status}`}>
              <div className="agent-step-header">
                <span className="agent-step-icon">{agent.icon}</span>
                <span className="agent-step-name">{agent.name}</span>
                <span className={`agent-step-status ${status === 'running' ? 'running-dot' : ''}`}>
                  {status === 'pending' && '—'}
                  {status === 'running' && 'Processing'}
                  {status === 'done' && '✓ Done'}
                  {status === 'error' && '✕ Error'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#8a9ab8', marginTop: 3 }}>{agent.desc}</div>
              {reasoning && (
                <div className="agent-reasoning">{reasoning}</div>
              )}
            </div>
          );
        })}
      </div>

      {result && result.total_latency_ms && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#8a9ab8', textAlign: 'right' }}>
          Chain completed in {(result.total_latency_ms / 1000).toFixed(1)}s
          {result.command_summary?._model && <span> · {result.command_summary._model}</span>}
        </div>
      )}
    </div>
  );
}
