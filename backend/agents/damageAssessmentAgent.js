/**
 * Agent 5: Post-Disaster Damage Assessment Agent
 * NOTE: No vision model is available (confirmed in Step Zero). 
 * This agent accepts structured text descriptions of damage (not image analysis).
 * UI must clearly state this limitation.
 */

const { callGranite } = require('../services/graniteClient');

const VISION_CAPABLE = false; // Confirmed false: no vision model available in this project

const SYSTEM_PROMPT = `You are the Post-Disaster Damage Assessment Agent for SafeSurge AI — a coastal disaster platform for Gujarat, India.

YOUR SINGLE RESPONSIBILITY: Assess post-disaster damage based on a structured text description provided by the user. You do NOT analyze images. You score the described damage and produce a structured assessment.

INPUT SCHEMA (JSON):
{
  "location": string,
  "damage_description": string (free text description of observed damage),
  "structure_type": "residential" | "commercial" | "infrastructure" | "fishing_boat" | "agricultural" | "mixed",
  "estimated_affected_count": number (people or structures),
  "reporter_name": string (optional),
  "timestamp": string
}

OUTPUT SCHEMA — return ONLY this JSON object:
{
  "damage_tier": "NONE" | "MINOR" | "MODERATE" | "SEVERE" | "CATASTROPHIC",
  "damage_score": 0 to 100,
  "structural_assessment": "brief assessment of structural damage",
  "immediate_needs": ["need 1", "need 2", "need 3"],
  "search_rescue_required": true | false,
  "medical_emergency": true | false,
  "estimated_repair_timeline": "e.g., 2-4 weeks",
  "priority_actions": ["action 1", "action 2"],
  "confidence": 0.0 to 1.0,
  "assessment_basis": "Text description analysis",
  "provenance": "demo",
  "disclaimer": "AI damage assessment based on reported description only — not a certified structural or insurance survey"
}

CONSTRAINTS:
1. CATASTROPHIC (score 80-100): complete structural collapse, multiple casualties, widespread flooding.
2. SEVERE (score 60-79): major structural damage, displacement required, utilities disrupted.
3. MODERATE (score 40-59): significant damage but structures standing, some displacement.
4. MINOR (score 20-39): superficial damage, no displacement.
5. NONE (score 0-19): cosmetic/no damage.
6. Always include disclaimer.`;

const FALLBACK = {
  damage_tier: 'MODERATE',
  damage_score: 55,
  structural_assessment: 'Moderate damage indicated based on description. Structural integrity requires on-site verification.',
  immediate_needs: ['Emergency shelter', 'Clean water supply', 'Medical assessment'],
  search_rescue_required: false,
  medical_emergency: false,
  estimated_repair_timeline: '4-8 weeks',
  priority_actions: ['Deploy assessment team', 'Register displaced families at relief camp'],
  confidence: 0.60,
  assessment_basis: 'Text description analysis (AI fallback)',
  provenance: 'demo',
  disclaimer: 'AI damage assessment based on reported description only — not a certified structural or insurance survey'
};

async function assessDamage(damageReport) {
  const userContent = `Assess the following post-disaster damage report:\n${JSON.stringify(damageReport, null, 2)}`;

  const result = await callGranite('DamageAssessment', SYSTEM_PROMPT, userContent, FALLBACK);
  return {
    ...result,
    _vision_capable: VISION_CAPABLE,
    _analysis_mode: 'text_description',
    _ui_notice: 'Image analysis unavailable with current model (ibm/granite-4-h-small does not support vision). Damage assessment is based on your text description only. This output is labeled AI-Generated Text Analysis, not AI Image Analysis.'
  };
}

module.exports = { assessDamage, VISION_CAPABLE };
