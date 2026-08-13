const express = require('express');
const router = express.Router();
const { getDb, getRecentAgentLogs } = require('../db/schema');

// GET /api/settlements
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const settlements = require('../db/schema').getAllSettlements
      ? require('../db/schema').getAllSettlements()
      : [];
    res.json({ success: true, data: settlements, provenance: 'mixed', count: settlements.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/settlements/:id
router.get('/:id', async (req, res) => {
  try {
    await getDb();
    const { all } = require('../db/schema');
    // Inline query via the schema module's all helper won't work — use getAllSettlements
    const settlements = require('../db/schema').getAllSettlements();
    const s = settlements.find(x => x.id === req.params.id);
    if (!s) return res.status(404).json({ success: false, error: 'Settlement not found' });
    res.json({ success: true, data: s });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
