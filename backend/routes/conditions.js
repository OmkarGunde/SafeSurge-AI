const express = require('express');
const router = express.Router();
const { getLatestConditions, getBiparjoyReplayAtTimestep, getBiparjoyTrack, refreshLiveData } = require('../services/dataFusionEngine');

// GET /api/conditions/latest
router.get('/latest', async (req, res) => {
  try {
    const data = await getLatestConditions();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/conditions/refresh — force bypass cache, re-fetch INCOIS
router.get('/refresh', async (req, res) => {
  try {
    const data = await refreshLiveData();
    res.json({ success: true, data, refreshed: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/cyclone/biparjoy-replay?timestep=N
router.get('/biparjoy-replay', (req, res) => {
  try {
    const timestep = parseFloat(req.query.timestep) || 0;
    const data = getBiparjoyReplayAtTimestep(timestep);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/cyclone/biparjoy-full — full track for map rendering
router.get('/biparjoy-full', (req, res) => {
  try {
    const track = getBiparjoyTrack();
    res.json({ success: true, data: track, provenance: 'historical', count: track.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
