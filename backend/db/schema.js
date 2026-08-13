/**
 * schema.js — SQLite DB using sql.js (pure WASM, no native compilation required)
 * The database is kept in memory during the process lifetime and persisted to a file.
 */

const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'safesurge.db.bin');

let db = null;
let SQL = null;

async function initSqlJs() {
  if (SQL) return SQL;
  SQL = await require('sql.js')();
  return SQL;
}

async function getDb() {
  if (db) return db;
  const sql = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new sql.Database(fileBuffer);
  } else {
    db = new sql.Database();
  }
  initSchema();
  await seedData();
  return db;
}

function persistDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buf = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buf);
  } catch (e) {
    console.error('[DB] Persist error:', e.message);
  }
}

// Persist every 10 seconds
setInterval(persistDb, 10000);
process.on('exit', persistDb);
process.on('SIGINT', () => { persistDb(); process.exit(0); });
process.on('SIGTERM', () => { persistDb(); process.exit(0); });

function run(sql, params = []) {
  db.run(sql, params);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_hi TEXT,
      name_gu TEXT,
      district TEXT,
      lat REAL,
      lon REAL,
      population INTEGER,
      population_provenance TEXT DEFAULT 'historical',
      shelter_capacity INTEGER,
      shelter_capacity_provenance TEXT DEFAULT 'demo',
      shelter_name TEXT,
      elevation_m REAL,
      coastal_exposure TEXT,
      fishing_boats INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS cyclone_track_points (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      lat REAL,
      lon REAL,
      wind_knots REAL,
      wind_kmh REAL,
      pressure_hpa REAL,
      category TEXT,
      sea_state TEXT,
      wave_height_m REAL,
      distance_from_gujarat_km REAL,
      provenance TEXT DEFAULT 'historical',
      source TEXT,
      note TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT,
      risk_level TEXT,
      message_en TEXT,
      message_hi TEXT,
      message_gu TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_run_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT,
      prompt_summary TEXT,
      response_summary TEXT,
      latency_ms INTEGER,
      provenance TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
}

async function seedData() {
  const settlementCount = get('SELECT COUNT(*) as c FROM settlements');
  if (!settlementCount || settlementCount.c === 0) {
    const settlementsFile = path.join(__dirname, '..', 'data', 'settlements.json');
    const settlements = JSON.parse(fs.readFileSync(settlementsFile, 'utf8'));
    for (const s of settlements) {
      db.run(`
        INSERT OR IGNORE INTO settlements 
        (id, name, name_hi, name_gu, district, lat, lon, population, population_provenance, 
         shelter_capacity, shelter_capacity_provenance, shelter_name, elevation_m, coastal_exposure, fishing_boats)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [s.id, s.name, s.name_hi, s.name_gu, s.district, s.lat, s.lon,
          s.population, s.population_provenance, s.shelter_capacity,
          s.shelter_capacity_provenance, s.shelter_name, s.elevation_m,
          s.coastal_exposure, s.fishing_boats]);
    }
    console.log(`[DB] Seeded ${settlements.length} settlements`);
    persistDb();
  }

  const trackCount = get('SELECT COUNT(*) as c FROM cyclone_track_points');
  if (!trackCount || trackCount.c === 0) {
    const trackFile = path.join(__dirname, '..', 'data', 'biparjoy_track.json');
    const track = JSON.parse(fs.readFileSync(trackFile, 'utf8'));
    for (const p of track) {
      db.run(`
        INSERT OR IGNORE INTO cyclone_track_points
        (id, timestamp, lat, lon, wind_knots, wind_kmh, pressure_hpa, category, sea_state, wave_height_m, distance_from_gujarat_km, provenance, source, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [p.id, p.timestamp, p.lat, p.lon, p.wind_knots, p.wind_kmh,
          p.pressure_hpa, p.category, p.sea_state, p.wave_height_m,
          p.distance_from_gujarat_km, p.provenance, p.source, p.note || null]);
    }
    console.log(`[DB] Seeded ${track.length} cyclone track points`);
    persistDb();
  }
}

function logAgentRun(agentName, promptSummary, responseSummary, latencyMs, provenance) {
  if (!db) return;
  try {
    db.run(`
      INSERT INTO agent_run_log (agent_name, prompt_summary, response_summary, latency_ms, provenance)
      VALUES (?, ?, ?, ?, ?)
    `, [agentName, promptSummary, responseSummary, latencyMs, provenance]);
  } catch (e) {
    console.error('[DB] logAgentRun error:', e.message);
  }
}

function getRecentAgentLogs(limit = 20) {
  if (!db) return [];
  return all('SELECT * FROM agent_run_log ORDER BY id DESC LIMIT ?', [limit]);
}

function getAllSettlements() {
  if (!db) return [];
  return all('SELECT * FROM settlements');
}

module.exports = { getDb, logAgentRun, getRecentAgentLogs, getAllSettlements };
