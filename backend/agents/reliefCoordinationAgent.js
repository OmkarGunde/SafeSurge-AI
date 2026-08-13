/**
 * Agent 4: Relief Resource Coordination Agent
 * Given evacuation priorities, computes shelter/resource demand and flags shortfalls.
 */

const { callGranite } = require('../services/graniteClient');

const SYSTEM_PROMPT = `You are the Relief Resource Coordination Agent for SafeSurge AI — a coastal disaster early warning platform for Gujarat, India.

YOUR SINGLE RESPONSIBILITY: Given an evacuation priority plan, compute shelter and resource demand, identify shortfalls, and recommend resource mobilization actions.

INPUT SCHEMA (JSON):
{
  "evacuation_priorities": [
    {
      "rank": number,
      "settlement_id": string,
      "settlement_name": string,
      "priority_tier": "IMMEDIATE" | "URGENT" | "PRECAUTIONARY",
      "population_to_evacuate": number,
      "shelter_gap": number,
      "provenance": string
    }
  ],
  "total_evacuation_population": number,
  "total_shelter_capacity": number,
  "overall_shelter_deficit": number,
  "timing_window_hours": number,
  "risk_level": string,
  "provenance": string
}

OUTPUT SCHEMA — return ONLY this JSON object:
{
  "resource_summary": {
    "total_people_needing_shelter": number,
    "available_shelter_capacity": number,
    "shelter_deficit": number,
    "shelter_surplus_locations": ["location names with surplus"],
    "critical_shortage_locations": ["location names with critical shortage"]
  },
  "resource_requirements": {
    "relief_camps_needed": number,
    "food_packets_72h": number,
    "water_liters_72h": number,
    "medical_teams_needed": number,
    "rescue_boats_needed": number,
    "ambulances_needed": number
  },
  "mobilization_actions": [
    {
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "action": "specific action description",
      "responsible_agency": "NDRF / SDRF / District Collector / Coast Guard / Navy",
      "timeline_hours": number
    }
  ],
  "resource_gaps": ["description of critical gaps"],
  "confidence": 0.0 to 1.0,
  "provenance": "same as input",
  "disclaimer": "AI-generated resource estimate — not official government allocation"
}

CONSTRAINTS:
1. food_packets_72h = total_people * 3 meals/day * 3 days = total_people * 9
2. water_liters_72h = total_people * 5 liters/day * 3 days = total_people * 15
3. medical_teams = ceil(total_people / 5000)
4. rescue_boats = ceil(IMMEDIATE-tier population / 500)
5. NEVER claim this is official government resource allocation.`;

const FALLBACK_FACTORY = (evacuationPlan, provenance) => {
  const total = evacuationPlan.total_evacuation_population || 100000;
  return {
    resource_summary: {
      total_people_needing_shelter: total,
      available_shelter_capacity: evacuationPlan.total_shelter_capacity || 60000,
      shelter_deficit: Math.max(0, total - (evacuationPlan.total_shelter_capacity || 60000)),
      shelter_surplus_locations: [],
      critical_shortage_locations: ['Jakhau', 'Mandvi']
    },
    resource_requirements: {
      relief_camps_needed: Math.ceil(total / 2000),
      food_packets_72h: total * 9,
      water_liters_72h: total * 15,
      medical_teams_needed: Math.ceil(total / 5000),
      rescue_boats_needed: Math.ceil(total / 500),
      ambulances_needed: Math.ceil(total / 2000)
    },
    mobilization_actions: [
      { priority: 'HIGH', action: 'Deploy NDRF teams to Kutch coastal areas', responsible_agency: 'NDRF', timeline_hours: 6 },
      { priority: 'HIGH', action: 'Pre-position food and water at Mandvi relief camp', responsible_agency: 'District Collector', timeline_hours: 8 },
      { priority: 'MEDIUM', action: 'Alert Coast Guard for sea rescue operations', responsible_agency: 'Coast Guard', timeline_hours: 4 }
    ],
    resource_gaps: ['Shelter capacity deficit in Kutch district'],
    confidence: 0.68,
    provenance,
    disclaimer: 'AI-generated resource estimate — not official government allocation'
  };
};

async function coordinateRelief(evacuationPlan, riskLevel, provenance) {
  const input = {
    ...evacuationPlan,
    risk_level: riskLevel || 'HIGH',
    provenance: provenance || 'demo'
  };

  const userContent = `Compute relief resource requirements for this evacuation scenario:\n${JSON.stringify(input, null, 2)}`;

  const result = await callGranite('ReliefCoordination', SYSTEM_PROMPT, userContent,
    FALLBACK_FACTORY(evacuationPlan, provenance || 'demo'));
  return result;
}

module.exports = { coordinateRelief };
