const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { interpretRisk } = require('../agents/cycloneInterpretationAgent');
const { generateFishermenAlert } = require('../agents/fishermenAlertAgent');
const { planEvacuation } = require('../agents/evacuationAgent');
const { coordinateRelief } = require('../agents/reliefCoordinationAgent');
const { assessDamage, VISION_CAPABLE } = require('../agents/damageAssessmentAgent');
const { getDb, getAllSettlements } = require('../db/schema');

// In-memory response cache (30s TTL)
const cache = new Map();
function getCacheKey(agentName, body) {
  return agentName + ':' + JSON.stringify(body).substring(0, 200);
}
function checkCache(key) {
  const entry = cache.get(key);
  if (entry && (Date.now() - entry.ts) < 30000) return entry.data;
  return null;
}
function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// POST /api/agents/interpret-risk
router.post('/interpret-risk', async (req, res) => {
  try {
    const key = getCacheKey('interpret-risk', req.body);
    const cached = checkCache(key);
    if (cached) return res.json({ success: true, data: cached, _cached: true });

    const result = await interpretRisk(req.body);
    setCache(key, result);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/agents/fishermen-alert
router.post('/fishermen-alert', async (req, res) => {
  try {
    const key = getCacheKey('fishermen-alert', req.body);
    const cached = checkCache(key);
    if (cached) return res.json({ success: true, data: cached, _cached: true });

    const result = await generateFishermenAlert(req.body);
    setCache(key, result);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/agents/evacuation-plan
router.post('/evacuation-plan', async (req, res) => {
  try {
    const { risk_data, settlements: reqSettlements } = req.body;
    await getDb();
    const allSettlements = reqSettlements || getAllSettlements();
    const key = getCacheKey('evacuation-plan', { risk_data, ids: allSettlements.map(s => s.id) });
    const cached = checkCache(key);
    if (cached) return res.json({ success: true, data: cached, _cached: true });

    const result = await planEvacuation(risk_data || req.body, allSettlements);
    setCache(key, result);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/agents/relief-coordination
router.post('/relief-coordination', async (req, res) => {
  try {
    const { evacuation_plan, risk_level, provenance } = req.body;
    const result = await coordinateRelief(evacuation_plan, risk_level, provenance);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/agents/damage-assessment
router.post('/damage-assessment', upload.single('image'), async (req, res) => {
  try {
    let damageReport;
    if (req.file) {
      damageReport = {
        location: req.body.location || 'Unknown',
        damage_description: req.body.damage_description || '',
        structure_type: req.body.structure_type || 'mixed',
        estimated_affected_count: parseInt(req.body.estimated_affected_count) || 0,
        reporter_name: req.body.reporter_name || '',
        timestamp: new Date().toISOString(),
        _image_filename: req.file.originalname
      };
    } else {
      damageReport = { ...req.body, timestamp: req.body.timestamp || new Date().toISOString() };
    }

    const result = await assessDamage(damageReport);
    res.json({
      success: true,
      data: result,
      vision_capable: VISION_CAPABLE,
      image_received: !!req.file,
      image_filename: req.file ? req.file.originalname : null
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
