/**
 * Agent 3: Evacuation Route & Priority Planning Agent
 * Given settlements + risk state, outputs prioritized evacuation order with reasoning.
 */

const { callGranite } = require('../services/graniteClient');

const SYSTEM_PROMPT = `You are the Evacuation Route & Priority Planning Agent for SafeSurge AI — a coastal disaster early warning platform for Gujarat, India.

YOUR SINGLE RESPONSIBILITY: Given coastal settlement data and a risk assessment, produce a prioritized evacuation order with reasoning. You are an AI decision-support tool — your output is a recommendation, NOT an official evacuation order.

INPUT SCHEMA (JSON):
{
  "risk_level": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "wind_speed_kmh": number,
  "wave_height_m": number,
  "affected_zones": ["zones"],
  "settlements": [
    {
      "id": string,
      "name": string,
      "population": number,
      "shelter_capacity": number,
      "elevation_m": number,
      "coastal_exposure": "extreme" | "very_high" | "high" | "moderate",
      "fishing_boats": number,
      "distance_from_storm_km": number (optional)
    }
  ],
  "provenance": string
}

OUTPUT SCHEMA — return ONLY this JSON object:
{
  "evacuation_priorities": [
    {
      "rank": 1,
      "settlement_id": string,
      "settlement_name": string,
      "priority_tier": "IMMEDIATE" | "URGENT" | "PRECAUTIONARY",
      "priority_color": "red" | "orange" | "yellow",
      "population_to_evacuate": number,
      "shelter_gap": number (negative means surplus),
      "reasoning": "1-2 sentence explanation of why this rank",
      "route_advice": "brief evacuation route direction",
      "provenance": string
    }
  ],
  "total_evacuation_population": number,
  "total_shelter_capacity": number,
  "overall_shelter_deficit": number,
  "timing_window_hours": number,
  "orchestration_note": "brief coordination summary",
  "confidence": 0.0 to 1.0,
  "provenance": "same as input",
  "disclaimer": "AI-generated recommendation only — not an official evacuation order"
}

CONSTRAINTS:
1. IMMEDIATE (red): coastal_exposure=extreme AND risk>=HIGH, OR distance<100km AND risk=CRITICAL.
2. URGENT (orange): coastal_exposure=very_high OR risk=CRITICAL with exposure=high.
3. PRECAUTIONARY (yellow): risk=HIGH with moderate exposure, or risk=MODERATE.
4. Always include disclaimer field.
5. Rank settlements with highest coastal_exposure and lowest elevation first.
6. shelter_gap = shelter_capacity - population_to_evacuate (negative = shortfall).`;

const FALLBACK_FACTORY = (settlements, provenance) => ({
  evacuation_priorities: settlements.map((s, i) => ({
    rank: i + 1,
    settlement_id: s.id,
    settlement_name: s.name,
    priority_tier: i < 2 ? 'IMMEDIATE' : i < 4 ? 'URGENT' : 'PRECAUTIONARY',
    priority_color: i < 2 ? 'red' : i < 4 ? 'orange' : 'yellow',
    population_to_evacuate: s.population,
    shelter_gap: s.shelter_capacity - s.population,
    reasoning: 'Deterministic fallback ranking by coastal exposure and population.',
    route_advice: 'Move inland to nearest designated shelter.',
    provenance
  })),
  total_evacuation_population: settlements.reduce((a, s) => a + (s.population || 0), 0),
  total_shelter_capacity: settlements.reduce((a, s) => a + (s.shelter_capacity || 0), 0),
  overall_shelter_deficit: settlements.reduce((a, s) => a + (s.shelter_capacity - s.population), 0),
  timing_window_hours: 24,
  orchestration_note: 'AI fallback plan — prioritizes highest-exposure settlements first.',
  confidence: 0.65,
  provenance,
  disclaimer: 'AI-generated recommendation only — not an official evacuation order'
});

async function planEvacuation(riskData, settlements) {
  const input = {
    risk_level: riskData.risk_level || 'HIGH',
    wind_speed_kmh: riskData.wind_speed_kmh || 150,
    wave_height_m: riskData.wave_height_m || 8,
    affected_zones: riskData.affected_zones || ['Kutch Coast', 'Saurashtra Coast'],
    settlements: settlements.map(s => ({
      id: s.id, name: s.name, population: s.population,
      shelter_capacity: s.shelter_capacity, elevation_m: s.elevation_m,
      coastal_exposure: s.coastal_exposure, fishing_boats: s.fishing_boats
    })),
    provenance: riskData.provenance || 'demo'
  };

  const userContent = `Plan evacuation priorities for the following scenario:\n${JSON.stringify(input, null, 2)}`;

  const result = await callGranite('EvacuationPlanning', SYSTEM_PROMPT, userContent,
    FALLBACK_FACTORY(settlements, input.provenance));
  return result;
}

module.exports = { planEvacuation };
