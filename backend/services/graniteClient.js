/**
 * graniteClient.js — Single watsonx.ai client for all agent calls.
 * Uses ibm/granite-4-h-small via /ml/v1/text/chat (Chat Completions API).
 * IAM token is cached for 55 minutes to avoid re-auth on every call.
 * Logs every call to the DB agent_run_log table.
 */

const https = require('https');
const { logAgentRun } = require('../db/schema');

const WATSONX_URL = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID;
const WATSONX_API_KEY = process.env.WATSONX_API_KEY;

// Resolved at startup via discoverModel()
let selectedModelId = process.env.WATSONX_MODEL_ID || '';

// IAM token cache
let tokenCache = { token: null, expiresAt: 0 };

async function getIamToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  return new Promise((resolve, reject) => {
    const body = `grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=${encodeURIComponent(WATSONX_API_KEY)}`;
    const req = https.request({
      hostname: 'iam.cloud.ibm.com',
      path: '/identity/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (!j.access_token) throw new Error('No access_token in IAM response');
          tokenCache.token = j.access_token;
          tokenCache.expiresAt = Date.now() + 55 * 60 * 1000;
          resolve(j.access_token);
        } catch (e) {
          reject(new Error('IAM token error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function discoverModel() {
  if (selectedModelId) {
    console.log(`[Granite] Using configured model: ${selectedModelId}`);
    return selectedModelId;
  }
  try {
    const token = await getIamToken();
    const models = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: new URL(WATSONX_URL).hostname,
        path: '/ml/v1/foundation_model_specs?version=2024-03-14&limit=200',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d).resources || []));
      });
      req.on('error', reject);
      req.end();
    });

    // Prefer Granite 4, fall back to granite-3 instruct
    const granite4 = models.find(m => m.model_id && m.model_id.includes('granite-4'));
    const granite3i = models.find(m => m.model_id && m.model_id.includes('granite-3') && m.model_id.includes('instruct'));
    const granite3 = models.find(m => m.model_id && m.model_id.includes('granite-3'));
    const chosen = granite4 || granite3i || granite3;

    if (!chosen) throw new Error('No Granite model found in available models');
    selectedModelId = chosen.model_id;
    console.log(`[Granite] Auto-selected model: ${selectedModelId}`);
    return selectedModelId;
  } catch (e) {
    selectedModelId = 'ibm/granite-4-h-small';
    console.log(`[Granite] Model discovery failed (${e.message}), using fallback: ${selectedModelId}`);
    return selectedModelId;
  }
}

/**
 * Parse JSON from a model response string, with one retry attempt.
 * Falls back to extracting a JSON block if the response has extra text.
 */
function parseStructuredResponse(text) {
  // Direct parse
  try { return JSON.parse(text.trim()); } catch (_) {}
  // Extract JSON from code block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) { try { return JSON.parse(codeBlock[1].trim()); } catch (_) {} }
  // Find first { ... } block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) { try { return JSON.parse(jsonMatch[0]); } catch (_) {} }
  return null;
}

/**
 * Main call method. All agents go through here.
 * @param {string} agentName - for logging
 * @param {string} systemPrompt - the agent's system role
 * @param {string} userContent - the user message / data payload
 * @param {object} fallbackResponse - returned if Granite fails
 */
async function callGranite(agentName, systemPrompt, userContent, fallbackResponse) {
  const start = Date.now();
  let parsedResponse = null;
  let latencyMs = 0;

  try {
    const [token, modelId] = await Promise.all([getIamToken(), discoverModel()]);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    const body = JSON.stringify({
      model_id: modelId,
      messages,
      project_id: WATSONX_PROJECT_ID,
      max_tokens: 1200,
      temperature: 0.3
    });

    const responseText = await new Promise((resolve, reject) => {
      const hostname = new URL(WATSONX_URL).hostname;
      const req = https.request({
        hostname,
        path: '/ml/v1/text/chat?version=2024-03-14',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            if (j.choices && j.choices[0]) {
              resolve(j.choices[0].message.content);
            } else {
              reject(new Error('Unexpected response shape: ' + JSON.stringify(j).substring(0, 200)));
            }
          } catch (e) {
            reject(new Error('Response parse failed: ' + e.message));
          }
        });
      });
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    latencyMs = Date.now() - start;
    parsedResponse = parseStructuredResponse(responseText);

    if (!parsedResponse) {
      // One retry with a stricter prompt
      console.warn(`[Granite][${agentName}] First parse failed, retrying...`);
      const retryMessages = [
        { role: 'system', content: systemPrompt + '\n\nCRITICAL: Your response MUST be a single valid JSON object with no extra text, no markdown, no explanation.' },
        { role: 'user', content: userContent },
        { role: 'assistant', content: responseText },
        { role: 'user', content: 'Invalid format. Return ONLY the JSON object, nothing else.' }
      ];
      const retryBody = JSON.stringify({
        model_id: modelId,
        messages: retryMessages,
        project_id: WATSONX_PROJECT_ID,
        max_tokens: 1200,
        temperature: 0.1
      });
      const retryText = await new Promise((resolve, reject) => {
        const hostname = new URL(WATSONX_URL).hostname;
        const req = https.request({
          hostname,
          path: '/ml/v1/text/chat?version=2024-03-14',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(retryBody)
          }
        }, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => {
            try {
              const j = JSON.parse(d);
              resolve(j.choices && j.choices[0] ? j.choices[0].message.content : '');
            } catch { resolve(''); }
          });
        });
        req.setTimeout(20000, () => { req.destroy(); resolve(''); });
        req.on('error', () => resolve(''));
        req.write(retryBody);
        req.end();
      });
      parsedResponse = parseStructuredResponse(retryText);
    }

    if (!parsedResponse) {
      console.error(`[Granite][${agentName}] Both parse attempts failed, using fallback`);
      parsedResponse = fallbackResponse;
    }

    // Log to DB (sanitized — no keys, no full prompts)
    const promptSummary = systemPrompt.substring(0, 120) + '...';
    const responseSummary = JSON.stringify(parsedResponse).substring(0, 300);
    logAgentRun(agentName, promptSummary, responseSummary, latencyMs, parsedResponse.provenance || 'demo');

    return { ...parsedResponse, _latency_ms: latencyMs, _model: modelId };

  } catch (e) {
    latencyMs = Date.now() - start;
    console.error(`[Granite][${agentName}] Error: ${e.message}`);
    logAgentRun(agentName, agentName + ' call failed', e.message, latencyMs, 'demo');
    return { ...fallbackResponse, _error: e.message, _latency_ms: latencyMs };
  }
}

module.exports = { callGranite, discoverModel };
