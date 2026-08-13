/**
 * Agent 6: Command Orchestrator Agent
 * Sequences the 5 operational agents, assembles a unified Command Center summary.
 * Damage Assessment is NOT part of this chain — it runs independently.
 */

const { callGranite } = require('../services/graniteClient');
const { interpretRisk } = require('./cycloneInterpretationAgent');
const { generateFishermenAlert } = require('./fishermenAlertAgent');
const { planEvacuation } = require('./evacuationAgent');
const { coordinateRelief } = require('./reliefCoordinationAgent');

const SYSTEM_PROMPT = `You are the Command Orchestrator Agent for SafeSurge AI — a coastal disaster intelligence platform for Gujarat, India.

YOUR SINGLE RESPONSIBILITY: Synthesize outputs from multiple specialist agents (Cyclone Interpretation, Fishermen Alert, Evacuation Planning, Relief Coordination) into a unified Command Center summary for emergency managers.

INPUT SCHEMA (JSON):
{
  "cyclone_interpretation": { ...risk assessment output },
  "fishermen_alert": { ...alert output },
  "evacuation_plan": { ...evacuation output },
  "relief_coordination": { ...resource output },
  "scenario_conditions": { wind_speed_kmh, wave_height_m, pressure_hpa, category, provenance }
}

OUTPUT SCHEMA — return ONLY this JSON object:
{
  "command_summary": "3-4 sentence executive summary for the district emergency operations center",
  "overall_threat_level": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "immediate_priorities": ["top 3 immediate actions in priority order"],
  "coordination_status": {
    "fishermen_alert_sent": true | false,
    "evacuation_ordered": true | false,
    "relief_mobilized": true | false,
    "coast_guard_alerted": true | false
  },
  "time_to_impact_estimate": "estimated time to landfall or peak impact",
  "key_risks": ["risk 1", "risk 2", "risk 3"],
  "recommended_next_steps": ["step 1", "step 2", "step 3"],
  "confidence": 0.0 to 1.0,
  "provenance": "same as scenario provenance",
  "disclaimer": "AI-generated command summary — not an official government order or advisory"
}

CONSTRAINTS:
1. Be concise and actionable — this is for emergency managers, not the public.
2. NEVER claim official government authority.
3. If any agent returned an error, still produce a coherent summary from available data.
4. overall_threat_level must match cyclone_interpretation.risk_level.`;

const FALLBACK = {
  command_summary: 'Severe cyclonic conditions approaching Gujarat coastline. All coastal district operations centers activated. Fishermen boat recall in effect. Evacuation of highest-risk settlements underway.',
  overall_threat_level: 'CRITICAL',
  immediate_priorities: [
    'Complete fishing vessel recall — Jakhau and Mandvi ports',
    'Initiate IMMEDIATE-tier settlement evacuation in Kutch district',
    'Pre-position NDRF teams at Bhuj and Gandhidham staging areas'
  ],
  coordination_status: {
    fishermen_alert_sent: true,
    evacuation_ordered: true,
    relief_mobilized: true,
    coast_guard_alerted: true
  },
  time_to_impact_estimate: '18-24 hours',
  key_risks: ['Storm surge up to 3-5m above normal tide', 'Extreme wind damage to coastal structures', 'Flooding of low-lying settlements'],
  recommended_next_steps: [
    'Deploy second NDRF battalion to Kutch coastal zone',
    'Open all designated cyclone shelters in Kutch and Devbhumi Dwarka',
    'Issue public communication in Gujarati via All India Radio'
  ],
  confidence: 0.72,
  provenance: 'historical',
  disclaimer: 'AI-generated command summary — not an official government order or advisory'
};

/**
 * Run the full 5-agent operational chain:
 * 1. Cyclone Interpretation (sequential)
 * 2. Fishermen Alert + Evacuation Planning (parallel)
 * 3. Relief Coordination (depends on evacuation output)
 * 4. Command Orchestrator Summary
 */
async function runFullChain(conditionsData, settlements) {
  const chainLog = [];
  const start = Date.now();

  // Step 1: Cyclone Interpretation
  chainLog.push({ agent: 'CycloneInterpretation', status: 'running', startedAt: Date.now() });
  const cycloneResult = await interpretRisk({
    wind_speed_kmh: conditionsData.wind_speed_kmh || conditionsData.wind_kmh || 157,
    wave_height_m: conditionsData.wave_height_m || 8.0,
    pressure_hpa: conditionsData.pressure_hpa || 950,
    category: conditionsData.category || 'Extremely Severe Cyclonic Storm',
    distance_from_gujarat_km: conditionsData.distance_from_gujarat_km || 100,
    timestamp: conditionsData.timestamp || new Date().toISOString(),
    provenance: conditionsData.provenance || 'historical'
  });
  chainLog[0].status = 'done';
  chainLog[0].result_summary = `risk_level=${cycloneResult.risk_level}`;

  // Step 2: Fishermen Alert + Evacuation (parallel)
  chainLog.push({ agent: 'FishermenAlert', status: 'running', startedAt: Date.now() });
  chainLog.push({ agent: 'EvacuationPlanning', status: 'running', startedAt: Date.now() });

  const riskForDownstream = {
    risk_level: cycloneResult.risk_level || 'CRITICAL',
    wind_speed_kmh: conditionsData.wind_speed_kmh || conditionsData.wind_kmh || 157,
    wave_height_m: conditionsData.wave_height_m || 8.0,
    affected_zones: cycloneResult.affected_zones || ['Kutch Coast'],
    recommended_actions: cycloneResult.recommended_actions || [],
    provenance: conditionsData.provenance || 'historical'
  };

  const [alertResult, evacuationResult] = await Promise.all([
    generateFishermenAlert(riskForDownstream),
    planEvacuation(riskForDownstream, settlements)
  ]);
  chainLog[1].status = 'done';
  chainLog[1].result_summary = `alert_level=${alertResult.alert_level}`;
  chainLog[2].status = 'done';
  chainLog[2].result_summary = `priorities=${evacuationResult.evacuation_priorities ? evacuationResult.evacuation_priorities.length : 0}`;

  // Step 3: Relief Coordination (depends on evacuation)
  chainLog.push({ agent: 'ReliefCoordination', status: 'running', startedAt: Date.now() });
  const reliefResult = await coordinateRelief(evacuationResult, cycloneResult.risk_level, conditionsData.provenance || 'historical');
  chainLog[3].status = 'done';
  chainLog[3].result_summary = `shelter_deficit=${reliefResult.resource_summary ? reliefResult.resource_summary.shelter_deficit : 'n/a'}`;

  // Step 4: Command Orchestrator Summary
  chainLog.push({ agent: 'CommandOrchestrator', status: 'running', startedAt: Date.now() });
  const orchestratorInput = {
    cyclone_interpretation: cycloneResult,
    fishermen_alert: alertResult,
    evacuation_plan: evacuationResult,
    relief_coordination: reliefResult,
    scenario_conditions: {
      wind_speed_kmh: conditionsData.wind_speed_kmh || conditionsData.wind_kmh,
      wave_height_m: conditionsData.wave_height_m,
      pressure_hpa: conditionsData.pressure_hpa,
      category: conditionsData.category,
      provenance: conditionsData.provenance || 'historical'
    }
  };

  const summaryResult = await callGranite(
    'CommandOrchestrator',
    SYSTEM_PROMPT,
    `Synthesize this multi-agent response into a command center summary:\n${JSON.stringify(orchestratorInput, null, 2)}`,
    { ...FALLBACK, provenance: conditionsData.provenance || 'historical' }
  );
  chainLog[4].status = 'done';
  chainLog[4].result_summary = `threat_level=${summaryResult.overall_threat_level}`;

  return {
    chain_log: chainLog,
    total_latency_ms: Date.now() - start,
    cyclone_interpretation: cycloneResult,
    fishermen_alert: alertResult,
    evacuation_plan: evacuationResult,
    relief_coordination: reliefResult,
    command_summary: summaryResult,
    provenance: conditionsData.provenance || 'historical'
  };
}

module.exports = { runFullChain };
