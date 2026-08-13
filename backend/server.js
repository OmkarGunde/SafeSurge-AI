require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/schema');
const { discoverModel } = require('./services/graniteClient');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes (registered after DB init)
async function start() {
  console.log('[SafeSurge AI] Initializing database...');
  await getDb(); // seeds data on first run

  // Discover and log Granite model
  console.log('[SafeSurge AI] Discovering watsonx model...');
  const modelId = await discoverModel();
  process.env._SELECTED_MODEL = modelId;
  console.log(`[SafeSurge AI] ✓ Model ready: ${modelId}`);

  const conditionsRouter = require('./routes/conditions');
  const agentsRouter = require('./routes/agents');
  const orchestratorRouter = require('./routes/orchestrator');
  const settlementsRouter = require('./routes/settlements');

  app.use('/api/conditions', conditionsRouter);
  app.use('/api/cyclone', conditionsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/orchestrator', orchestratorRouter);
  app.use('/api/settlements', settlementsRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SafeSurge AI Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      model: process.env._SELECTED_MODEL || 'ibm/granite-4-h-small'
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('[Server Error]', err.message);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  });

  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       SafeSurge AI — Backend Server Running          ║');
    console.log(`║  URL: http://localhost:${PORT}                          ║`);
    console.log(`║  Model: ${modelId.padEnd(44)}║`);
    console.log('║  Health: http://localhost:' + PORT + '/api/health          ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
  });
}

start().catch(e => {
  console.error('[SafeSurge AI] Startup failed:', e.message);
  process.exit(1);
});
