/**
 * Agent 2: Fishermen Safety Alert Agent
 * Generates actionable safety alerts in English, Hindi, and Gujarati.
 * All three languages in one call to minimize latency.
 */

const { callGranite } = require('../services/graniteClient');

const SYSTEM_PROMPT = `You are the Fishermen Safety Alert Agent for SafeSurge AI — a coastal disaster early warning platform serving Gujarat, India.

YOUR SINGLE RESPONSIBILITY: Convert a risk assessment into clear, actionable safety alerts for fishermen and coastal communities in THREE languages simultaneously: English, Hindi (Devanagari script), and Gujarati (Gujarati script). Do not use transliteration — use actual Unicode script for Hindi and Gujarati.

INPUT SCHEMA (JSON):
{
  "risk_level": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "wind_speed_kmh": number,
  "wave_height_m": number,
  "affected_zones": ["zone names"],
  "recommended_actions": ["actions"],
  "provenance": "live" | "historical" | "demo"
}

OUTPUT SCHEMA — return ONLY this JSON object:
{
  "alert_level": "GREEN" | "AMBER" | "RED" | "EXTREME_RED",
  "alert_en": {
    "headline": "short headline in English",
    "body": "2-3 sentence alert body in English with specific guidance",
    "fishing_advice": "specific advice for fishermen (stay in port / return immediately / do not venture out)"
  },
  "alert_hi": {
    "headline": "हिंदी में संक्षिप्त शीर्षक",
    "body": "हिंदी में 2-3 वाक्य का अलर्ट संदेश",
    "fishing_advice": "मछुआरों के लिए विशेष सलाह"
  },
  "alert_gu": {
    "headline": "ગુજરાતીમાં ટૂંકો શીર્ષ",
    "body": "ગુજરાતીમાં 2-3 વાક્યયોનો ચેતવણી સંદેશ",
    "fishing_advice": "માછીમારો માટે ખાસ સલાહ"
  },
  "boat_recall": true | false,
  "port_closure_advised": true | false,
  "confidence": 0.0 to 1.0,
  "provenance": "same as input"
}

CONSTRAINTS:
1. For CRITICAL risk: boat_recall=true, port_closure_advised=true, alert_level=EXTREME_RED.
2. For HIGH: boat_recall=true, port_closure_advised=true, alert_level=RED.
3. For MODERATE: boat_recall=true, alert_level=AMBER.
4. Use real Devanagari script for Hindi and real Gujarati Unicode script — NOT transliteration.
5. Keep advice practical and actionable — fishermen need simple, direct instructions.
6. NEVER label this as an "official government warning."`;

const FALLBACK = {
  alert_level: 'RED',
  alert_en: {
    headline: 'URGENT: High Seas Warning — Return to Port Immediately',
    body: 'Severe cyclonic conditions are approaching the Gujarat coast. Wind speeds exceed safe navigation thresholds. All fishing vessels must return to port immediately.',
    fishing_advice: 'DO NOT venture into the sea. All boats must return to port immediately. Secure vessels at harbor.'
  },
  alert_hi: {
    headline: 'अत्यावश्यक: उच्च समुद्री चेतावनी — तुरंत बंदरगाह लौटें',
    body: 'गुजरात तट पर भीषण चक्रवाती स्थिति आ रही है। हवा की गति सुरक्षित नेविगेशन सीमा से अधिक है। सभी मछली पकड़ने वाले जहाजों को तुरंत बंदरगाह लौटना चाहिए।',
    fishing_advice: 'समुद्र में मत जाइए। सभी नावें तुरंत बंदरगाह लौटें। बंदरगाह पर नावें सुरक्षित करें।'
  },
  alert_gu: {
    headline: 'તાત્કાલિક: ઊંચા સમુદ્રની ચેતવણી — તત્કાળ બંદર પર પાછા ફરો',
    body: 'ગુજરાત દરિયાકિનારે ભારે વાવાઝોડાની સ્થિતિ સર્જાઈ છે. પવનની ઝડપ સુરક્ષિત નૌકાચાલનની મર્યાદા કરતાં વધારે છે. તમામ માછીમારી નૌકાઓ તરત જ બંદર પર પાછી ફરે.',
    fishing_advice: 'દરિયામાં ન જશો. તમામ નૌકાઓ તરત બંદર પર પાછી ફરે. બંદર પર નૌકાઓ સુરક્ષિત કરો.'
  },
  boat_recall: true,
  port_closure_advised: true,
  confidence: 0.75,
  provenance: 'historical'
};

async function generateFishermenAlert(riskData) {
  const userContent = `Generate trilingual fishermen safety alerts for this risk situation:
${JSON.stringify(riskData, null, 2)}`;

  const result = await callGranite('FishermenAlert', SYSTEM_PROMPT, userContent, {
    ...FALLBACK,
    provenance: riskData.provenance || 'demo'
  });
  return result;
}

module.exports = { generateFishermenAlert };
