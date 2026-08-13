/**
 * DataFusionEngine — Priority order:
 * 1. INCOIS operational forecast (live) via incoisAdapter.js
 * 2. Historical Biparjoy replay (guaranteed, bundled JSON)
 *
 * Every returned snapshot carries honest provenance labels.
 * The "CRITICAL" risk level has been removed as a hardcoded constant —
 * the dashboard shows "Awaiting AI assessment" until the agent chain runs.
 */

const path = require('path');
const fs = require('fs');
const { fetchIncoisOperationalData } = require('./incoisAdapter');

// In-memory cache for latest snapshot
let snapshotCache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 30000; // 30 seconds

// Load static Biparjoy data once
let biparjoyTrack = null;
function getBiparjoyTrack() {
  if (!biparjoyTrack) {
    biparjoyTrack = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'biparjoy_track.json'), 'utf8')
    );
  }
  return biparjoyTrack;
}

function interpolateTrack(track, timestepIndex) {
  const clamped = Math.max(0, Math.min(timestepIndex, track.length - 1));
  const lower = track[Math.floor(clamped)];
  const upper = track[Math.min(Math.ceil(clamped), track.length - 1)];
  const frac = clamped - Math.floor(clamped);

  if (lower === upper || frac === 0) return { ...lower };

  return {
    ...lower,
    lat: lower.lat + (upper.lat - lower.lat) * frac,
    lon: lower.lon + (upper.lon - lower.lon) * frac,
    wind_knots: lower.wind_knots + (upper.wind_knots - lower.wind_knots) * frac,
    wind_kmh: lower.wind_kmh + (upper.wind_kmh - lower.wind_kmh) * frac,
    pressure_hpa: lower.pressure_hpa + (upper.pressure_hpa - lower.pressure_hpa) * frac,
    wave_height_m: lower.wave_height_m + (upper.wave_height_m - lower.wave_height_m) * frac,
    distance_from_gujarat_km: lower.distance_from_gujarat_km + (upper.distance_from_gujarat_km - lower.distance_from_gujarat_km) * frac,
    id: `${lower.id}_interp`,
    _interpolated: true
  };
}

/**
 * Build the historical Biparjoy fallback snapshot.
 * Named explicitly so callers know exactly what they are getting.
 */
function buildHistoricalFallback(reason) {
  const track = getBiparjoyTrack();
  const approachPoint = track[21]; // bp_022: 2023-06-14T12:00:00Z, 176 km/h, T-24h to landfall
  return {
    mode: 'historical_replay',
    incois_available: false,
    incois_unavailable_reason: reason || 'INCOIS operational source not available',
    timestamp: approachPoint.timestamp,
    wind_speed_kmh: { value: approachPoint.wind_kmh, unit: 'km/h', provenance: 'historical' },
    wind_speed_ms: { value: Math.round(approachPoint.wind_kmh / 3.6 * 10) / 10, unit: 'm/s', provenance: 'historical' },
    wind_direction_deg: { value: null, provenance: 'historical', note: 'Not available in historical dataset' },
    wave_height_m: { value: approachPoint.wave_height_m, unit: 'm', provenance: 'historical' },
    sea_surface_temp_c: { value: 29.2, unit: '°C', provenance: 'demo', note: 'Synthetic — not from historical source' },
    current_speed_knots: { value: null, unit: 'kn', provenance: 'demo', note: 'Not available — demo placeholder' },
    pressure_hpa: { value: approachPoint.pressure_hpa, unit: 'hPa', provenance: 'historical' },
    coastal_risk_level: { value: 'AWAITING_ASSESSMENT', provenance: 'none', note: 'Run the AI agent chain for assessment' },
    cyclone_category: { value: approachPoint.category, provenance: 'historical' },
    distance_from_gujarat_km: { value: approachPoint.distance_from_gujarat_km, provenance: 'historical' },
    location: { name: 'Biparjoy 2023 track position', lat: approachPoint.lat, lon: approachPoint.lon, provenance: 'historical' },
    source_label: '🔵 HISTORICAL REAL — Cyclone Biparjoy, June 2023 (NOAA IBTrACS)',
    data_notice: 'Latest Available Dataset — Historical replay of Cyclone Biparjoy 2023. Not current/live data. INCOIS operational source is currently unavailable.'
  };
}

/**
 * Convert an INCOIS adapter response into the DataFusionEngine snapshot format.
 */
function buildLiveSnapshot(incoisData) {
  return {
    mode: 'live',
    incois_available: true,
    timestamp: incoisData.forecast_valid_at,
    retrieved_at: incoisData.retrieved_at,
    forecast_initialized_at: incoisData.forecast_initialized_at,
    forecast_valid_at: incoisData.forecast_valid_at,

    // Wind
    wind_speed_kmh: {
      value: incoisData.wind.speed_kmh,
      unit: 'km/h',
      provenance: 'live',
      source: 'INCOIS OSF — WINDS_' + incoisData.nc_file_date + '.nc (WSM layer)'
    },
    wind_speed_ms: {
      value: incoisData.wind.speed_ms,
      unit: 'm/s',
      provenance: 'live'
    },
    wind_direction_deg: {
      value: incoisData.wind.direction_deg,
      unit: '°',
      provenance: 'live',
      source: 'INCOIS OSF — WSXM:WSYM-dir'
    },

    // Wave
    wave_height_m: {
      value: incoisData.wave.significant_height_m,
      unit: 'm',
      provenance: 'live',
      source: 'INCOIS OSF — WAVES_io_' + incoisData.nc_file_date + '.nc (SWH layer)'
    },

    // SST
    sea_surface_temp_c: {
      value: incoisData.sea_surface_temperature.value_c,
      unit: '°C',
      provenance: incoisData.sea_surface_temperature.value_c !== null ? 'live' : 'demo',
      source: incoisData.sea_surface_temperature.value_c !== null
        ? 'INCOIS OSF — SST_NIO_' + incoisData.nc_file_date + '.nc'
        : 'Synthetic — not available from current INCOIS query'
    },

    // Current
    current_speed_knots: {
      value: incoisData.current.speed_knots,
      unit: 'kn',
      provenance: incoisData.current.speed_knots !== null ? 'live' : 'demo',
      source: incoisData.current.speed_knots !== null
        ? 'INCOIS OSF — CURRENTS_NIO_' + incoisData.nc_file_date + '.nc (U:V-mag)'
        : 'Not available'
    },
    current_speed_ms: {
      value: incoisData.current.speed_ms,
      unit: 'm/s',
      provenance: incoisData.current.speed_knots !== null ? 'live' : 'demo'
    },

    // Risk — NOT hardcoded; agents must compute this
    coastal_risk_level: {
      value: 'AWAITING_ASSESSMENT',
      provenance: 'none',
      note: 'Run the AI agent chain for risk assessment'
    },

    // Pressure from Open-Meteo (fetched in parallel with INCOIS)
    pressure_hpa: incoisData.pressure ? {
      value: incoisData.pressure.value_hpa,
      unit: 'hPa',
      provenance: incoisData.pressure.provenance,
      source: incoisData.pressure.source,
      source_url: incoisData.pressure.source_url,
      note: incoisData.pressure.data_notice
    } : { value: null, unit: 'hPa', provenance: 'demo', note: 'Pressure unavailable' },
    cyclone_category: { value: 'See AI Assessment', provenance: 'none' },
    distance_from_gujarat_km: { value: null, provenance: 'none', note: 'No active cyclone in current conditions' },

    location: incoisData.location,
    availability: incoisData.availability,

    source_label: '🟢 INCOIS OPERATIONAL FORECAST — Ocean State Forecast (OSF)',
    source_type: 'operational_forecast',
    data_notice: 'INCOIS Ocean State Forecast — operational model product for the Gujarat Sea Area (NE Arabian Sea). This is a numerical weather/ocean forecast, not a live buoy/sensor observation. Data generated: ' + incoisData.forecast_initialized_at + '. Valid: ' + incoisData.forecast_valid_at + '.',
    data_age_description: 'Operational forecast initialized ' + incoisData.forecast_initialized_at
  };
}

async function getLatestConditions() {
  // Check cache
  if (snapshotCache.data && (Date.now() - snapshotCache.fetchedAt) < CACHE_TTL_MS) {
    return snapshotCache.data;
  }

  // 1. Try INCOIS operational forecast
  let snapshot;
  try {
    const incoisData = await fetchIncoisOperationalData();
    snapshot = buildLiveSnapshot(incoisData);
    console.log('[DataFusion] ✓ INCOIS operational forecast fetched — SWH:', incoisData.wave.significant_height_m + 'm, Wind:', incoisData.wind.speed_kmh + 'km/h');
  } catch (e) {
    console.warn('[DataFusion] INCOIS unavailable (' + e.message + ') — using Biparjoy historical fallback');
    snapshot = buildHistoricalFallback(e.message);
  }

  snapshotCache = { data: snapshot, fetchedAt: Date.now() };
  return snapshot;
}

function getBiparjoyReplayAtTimestep(timestepIndex) {
  const track = getBiparjoyTrack();
  const n = track.length;
  const clampedN = Math.max(0, Math.min(parseFloat(timestepIndex) || 0, n - 1));
  const point = interpolateTrack(track, clampedN);
  return {
    mode: 'historical_replay',
    timestep: clampedN,
    total_timesteps: n,
    source_label: '🔵 HISTORICAL REAL — Cyclone Biparjoy 2023 (NOAA IBTrACS)',
    data_notice: 'Historical Replay Snapshot — Cyclone Biparjoy 2023. Not current/live data.',
    ...point,
    wind_speed_kmh: point.wind_kmh,
    provenance: 'historical'
  };
}

// Force-refresh live data, bypassing cache
async function refreshLiveData() {
  snapshotCache = { data: null, fetchedAt: 0 };
  return getLatestConditions();
}

module.exports = { getLatestConditions, getBiparjoyReplayAtTimestep, getBiparjoyTrack, refreshLiveData };
