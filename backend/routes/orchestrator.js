const express = require('express');
const router = express.Router();
const { runFullChain } = require('../agents/commandOrchestrator');
const { getLatestConditions } = require('../services/dataFusionEngine');
const { getDb, getRecentAgentLogs, getAllSettlements } = require('../db/schema');

// POST /api/orchestrator/run-full-chain
router.post('/run-full-chain', async (req, res) => {
  try {
    await getDb();
    const settlements = getAllSettlements();

    // Use provided conditions or fall back to latest from DataFusionEngine
    let conditions = req.body && req.body.conditions;
    if (!conditions || Object.keys(conditions).length === 0) {
      const snapshot = await getLatestConditions();
      // Extract flat values from the nested snapshot structure (works for both live and historical modes)
      const windKmh = snapshot.wind_speed_kmh ? snapshot.wind_speed_kmh.value : null;
      const waveM = snapshot.wave_height_m ? snapshot.wave_height_m.value : null;
      const pressureHpa = snapshot.pressure_hpa ? snapshot.pressure_hpa.value : null;
      const isLive = snapshot.mode === 'live';
      conditions = {
        wind_speed_kmh: windKmh || (isLive ? null : 157),
        wave_height_m: waveM || (isLive ? null : 8.0),
        pressure_hpa: pressureHpa || (isLive ? null : 976),   // Open-Meteo value or historical fallback
        category: snapshot.cyclone_category ? snapshot.cyclone_category.value : (isLive ? 'Current Ocean Conditions' : 'Extremely Severe Cyclonic Storm'),
        distance_from_gujarat_km: snapshot.distance_from_gujarat_km ? snapshot.distance_from_gujarat_km.value : null,
        timestamp: snapshot.forecast_valid_at || snapshot.timestamp,
        provenance: isLive ? 'live' : 'historical',
        // Pass INCOIS metadata so agents can reference it
        data_source: isLive ? 'INCOIS Operational Forecast' : 'Biparjoy Historical Dataset',
        location: snapshot.location || null,
        wind_direction_deg: snapshot.wind_direction_deg ? snapshot.wind_direction_deg.value : null,
        sst_c: snapshot.sea_surface_temp_c ? snapshot.sea_surface_temp_c.value : null,
        current_speed_knots: snapshot.current_speed_knots ? snapshot.current_speed_knots.value : null,
      };
    }

    const result = await runFullChain(conditions, settlements);
    res.json({ success: true, data: result });
  } catch (e) {
    console.error('[Orchestrator] Error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/orchestrator/agent-logs
router.get('/agent-logs', async (req, res) => {
  try {
    await getDb();
    const logs = getRecentAgentLogs(30);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
