/**
 * incoisAdapter.js
 *
 * Official source: INCOIS (Indian National Centre for Ocean Information Services)
 * THREDDS Data Server — Ocean State Forecast (OSF) operational products
 * URL base: https://incois.gov.in/thredds/wms/osf/
 *
 * Data type: OPERATIONAL FORECAST (not live sensor observation).
 * These are model-based operational ocean state forecasts updated daily.
 * The files are named by the date they were generated (e.g. WAVES_io_20260811.nc).
 * Forecast coverage: today T+0 to T+7 days at 3-hour steps.
 *
 * Endpoints used (WMS GetFeatureInfo):
 *   Significant Wave Height (SWH):
 *     /thredds/wms/osf/ww3/WAVES_io_YYYYMMDD.nc  layer=SWH
 *   Wind Speed Magnitude (WSM):
 *     /thredds/wms/osf/winds/WINDS_YYYYMMDD.nc   layer=WSM
 *   Wind Direction:
 *     /thredds/wms/osf/winds/WINDS_YYYYMMDD.nc   layer=WSXM:WSYM-dir
 *   Sea Surface Temperature (SST):
 *     /thredds/wms/osf/ww3/SST_NIO_YYYYMMDD.nc   layer=SST
 *   Current Speed (U:V-mag):
 *     /thredds/wms/osf/currents/CURRENTS_NIO_YYYYMMDD.nc  layer=U:V-mag
 *
 * Geographic coverage: Arabian Sea / North Indian Ocean.
 * Coastal land-masking: exact coastal points return empty; use offshore representative
 * point at 20.5N 68.5E for the Gujarat Sea Area (NE Arabian Sea).
 * Distance from Porbandar: ~130 km offshore — genuinely covers Gujarat coastal waters.
 *
 * Authentication: None required. Publicly accessible.
 *
 * Units returned and normalization applied:
 *   WSM: m/s  → converted to km/h  (×3.6)
 *   WSM: m/s  → converted to knots (×1.94384)
 *   SWH: metres (no conversion)
 *   SST: °C   (no conversion)
 *   Current U:V-mag: m/s → knots (×1.94384)
 */

const https = require('https');

const INCOIS_HOST = 'incois.gov.in';
const OFFSHORE_GUJARAT = { lat: 20.5, lon: 68.5, name: 'Gujarat Sea Area (NE Arabian Sea)' };

// Timeout for each individual WMS request
const REQUEST_TIMEOUT_MS = 8000;
// Overall fetch timeout (all variables)
const TOTAL_TIMEOUT_MS = 25000;

/**
 * Fetch current Mean Sea Level Pressure from Open-Meteo (ECMWF-based, free, no key).
 * Used as the pressure source since INCOIS OSF does not expose MSLP.
 * Returns { value_hpa, source } or null on failure.
 *
 * API: https://api.open-meteo.com/v1/forecast
 * Variable: surface_pressure (hPa at surface ≈ MSLP for coastal/offshore point)
 * No API key required. 5-second timeout.
 */
async function fetchOpenMeteoMSLP(lat, lon) {
  return new Promise((resolve) => {
    const path = '/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=surface_pressure&forecast_days=1&timeformat=unixtime';
    const req = https.request({
      hostname: 'api.open-meteo.com',
      path,
      method: 'GET',
      headers: { 'User-Agent': 'SafeSurgeAI/1.0 (Open-Meteo MSLP)' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const p = j.current && j.current.surface_pressure;
          if (p == null || isNaN(p)) { resolve(null); return; }
          resolve({
            value_hpa: Math.round(p * 10) / 10,
            source: 'Open-Meteo (ECMWF ERA5-seamless, surface_pressure)',
            source_url: 'https://open-meteo.com',
            retrieved_at: new Date().toISOString()
          });
        } catch (_) { resolve(null); }
      });
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function httpsGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: INCOIS_HOST,
      path,
      method: 'GET',
      headers: { 'User-Agent': 'SafeSurgeAI/1.0 (INCOIS OSF Adapter)' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('INCOIS WMS request timeout (' + REQUEST_TIMEOUT_MS + 'ms)'));
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Build a WMS GetFeatureInfo URL for a scalar layer.
 */
function wmsGetFeatureInfo(ncRelPath, layer, lat, lon, time) {
  const delta = 2.0;
  const bbox = (lon - delta) + ',' + (lat - delta) + ',' + (lon + delta) + ',' + (lat + delta);
  const timeParam = time ? '&TIME=' + encodeURIComponent(time) : '';
  return '/thredds/wms/' + ncRelPath +
    '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo' +
    '&LAYERS=' + encodeURIComponent(layer) +
    '&QUERY_LAYERS=' + encodeURIComponent(layer) +
    '&CRS=CRS:84&BBOX=' + bbox +
    '&WIDTH=101&HEIGHT=101&I=50&J=50' +
    '&INFO_FORMAT=text%2Fxml' + timeParam;
}

/**
 * Parse WMS GetFeatureInfo XML response.
 * Returns { value, time } or null if not found.
 */
function parseFI(xml) {
  if (!xml || !xml.includes('<FeatureInfoResponse>')) return null;
  const valMatch = xml.match(/<value>([^<]+)<\/value>/);
  const timeMatch = xml.match(/<time>([^<]+)<\/time>/);
  if (!valMatch) return null; // empty response (land-masked)
  const value = parseFloat(valMatch[1]);
  if (isNaN(value)) return null;
  return {
    value,
    time: timeMatch ? timeMatch[1] : null
  };
}

/**
 * Determine today's NC file date string (YYYYMMDD).
 * INCOIS updates files daily; today's file is the operational run.
 * We also probe yesterday as fallback in case today's file isn't up yet.
 */
function getDateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - (daysAgo || 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return '' + y + m + day;
}

/**
 * Get the first available forecast timestamp from a WMS GetCapabilities response.
 * Returns an ISO8601 string or null.
 */
function getFirstForecastTime(capsXml) {
  const dimMatch = capsXml.match(/Dimension[^>]*name=.time.[^>]*default="([^"]+)"/);
  if (dimMatch) return dimMatch[1];
  const rangeMatch = capsXml.match(/>([^<]+T[^<]+Z\/[^<]+T[^<]+Z\/[^<]+)</);
  if (rangeMatch) {
    const parts = rangeMatch[1].trim().split('/');
    if (parts.length >= 1) return parts[0];
  }
  return null;
}

/**
 * Discover the current operational date: check today, then yesterday.
 * Returns { dateStr, firstForecastTime } or throws.
 */
async function discoverOperationalDate() {
  for (const daysAgo of [0, 1]) {
    const dateStr = getDateStr(daysAgo);
    try {
      const capsPath = '/thredds/wms/osf/ww3/WAVES_io_' + dateStr + '.nc?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities';
      const r = await httpsGet(capsPath);
      if (r.status === 200 && r.body.includes('<WMS_Capabilities')) {
        const firstTime = getFirstForecastTime(r.body);
        return { dateStr, firstForecastTime: firstTime };
      }
    } catch (_) { /* try next */ }
  }
  throw new Error('Could not find operational INCOIS NC files for today or yesterday');
}

/**
 * Fetch a single variable, returning null on any failure.
 */
async function fetchVar(ncPath, layer, lat, lon, time) {
  try {
    const url = wmsGetFeatureInfo(ncPath, layer, lat, lon, time);
    const r = await httpsGet(url);
    if (r.status !== 200) return null;
    return parseFI(r.body);
  } catch (_) {
    return null;
  }
}

/**
 * Main adapter entry point.
 * Returns a normalized data object or throws if INCOIS is completely unreachable.
 */
async function fetchIncoisOperationalData() {
  const retrievedAt = new Date().toISOString();

  // Step 1: discover operational date
  const { dateStr, firstForecastTime } = await discoverOperationalDate();
  const forecastTime = firstForecastTime;

  // SST and currents use a different time grid than waves/winds.
  // Rather than constructing a time string that may mismatch (the file date
  // is the INITIALIZATION date but forecast times are next-day onwards),
  // we omit the TIME parameter so THREDDS returns the default/current value.
  const sstTime = null;   // no TIME parameter → THREDDS uses default (current)
  const currTime = null;  // same

  const lat = OFFSHORE_GUJARAT.lat;
  const lon = OFFSHORE_GUJARAT.lon;

  // Step 2: fetch all variables in parallel (INCOIS + Open-Meteo pressure)
  const [swhResult, wsmResult, wdirResult, sstResult, curResult, mslpResult] = await Promise.all([
    fetchVar('osf/ww3/WAVES_io_' + dateStr + '.nc', 'SWH', lat, lon, forecastTime),
    fetchVar('osf/winds/WINDS_' + dateStr + '.nc', 'WSM', lat, lon, forecastTime),
    fetchVar('osf/winds/WINDS_' + dateStr + '.nc', 'WSXM:WSYM-dir', lat, lon, forecastTime),
    fetchVar('osf/ww3/SST_NIO_' + dateStr + '.nc', 'SST', lat, lon, sstTime),
    fetchVar('osf/currents/CURRENTS_NIO_' + dateStr + '.nc', 'U:V-mag', lat, lon, currTime),
    fetchOpenMeteoMSLP(lat, lon),   // ECMWF-based MSLP — separate source, clearly labeled
  ]);

  // Step 3: validate — SWH is the critical variable
  if (!swhResult) {
    throw new Error('INCOIS SWH fetch failed — source unavailable');
  }

  // Step 4: convert units
  const windSpeedMs = wsmResult ? wsmResult.value : null;
  const windSpeedKmh = windSpeedMs !== null ? Math.round(windSpeedMs * 3.6 * 10) / 10 : null;
  const windSpeedKnots = windSpeedMs !== null ? Math.round(windSpeedMs * 1.94384 * 10) / 10 : null;
  const currentSpeedMs = curResult ? curResult.value : null;
  const currentSpeedKnots = currentSpeedMs !== null ? Math.round(currentSpeedMs * 1.94384 * 100) / 100 : null;

  // Step 5: build forecast_initialized_at from dateStr
  const forecastInitialized = dateStr.substring(0, 4) + '-' +
    dateStr.substring(4, 6) + '-' +
    dateStr.substring(6, 8) + 'T00:00:00.000Z';

  return {
    source: 'INCOIS',
    source_full: 'Indian National Centre for Ocean Information Services',
    source_url: 'https://incois.gov.in/oceanservices/osfforecast.jsp',
    source_type: 'operational_forecast',
    provenance: 'live',
    retrieved_at: retrievedAt,
    forecast_initialized_at: forecastInitialized,
    forecast_valid_at: forecastTime,
    nc_file_date: dateStr,
    location: {
      name: OFFSHORE_GUJARAT.name,
      description: 'Representative point for Gujarat coastal waters (NE Arabian Sea). Land-masked grid: offset 130km from Porbandar.',
      latitude: lat,
      longitude: lon
    },
    wave: {
      significant_height_m: Math.round(swhResult.value * 100) / 100,
      unit: 'm',
      source_layer: 'SWH (Significant Wave Height)',
      source_nc: 'WAVES_io_' + dateStr + '.nc',
      forecast_time: swhResult.time || forecastTime
    },
    wind: {
      speed_ms: windSpeedMs !== null ? Math.round(windSpeedMs * 10) / 10 : null,
      speed_kmh: windSpeedKmh,
      speed_knots: windSpeedKnots,
      direction_deg: wdirResult ? Math.round(wdirResult.value * 10) / 10 : null,
      unit_speed: 'm/s',
      source_layer: 'WSM (Wind Speed Magnitude)',
      source_nc: 'WINDS_' + dateStr + '.nc'
    },
    sea_surface_temperature: {
      value_c: sstResult ? Math.round(sstResult.value * 10) / 10 : null,
      unit: '°C',
      source_layer: 'SST',
      source_nc: 'SST_NIO_' + dateStr + '.nc',
      forecast_time: sstResult ? sstResult.time : null
    },
    current: {
      speed_ms: currentSpeedMs !== null ? Math.round(currentSpeedMs * 1000) / 1000 : null,
      speed_knots: currentSpeedKnots,
      unit: 'm/s',
      source_layer: 'U:V-mag (current speed magnitude)',
      source_nc: 'CURRENTS_NIO_' + dateStr + '.nc',
      forecast_time: currTime
    },
    // Pressure from Open-Meteo (ECMWF) — separate source, clearly distinguished from INCOIS
    pressure: mslpResult ? {
      value_hpa: mslpResult.value_hpa,
      unit: 'hPa',
      source: mslpResult.source,
      source_url: mslpResult.source_url,
      provenance: 'live',
      data_notice: 'Surface pressure from Open-Meteo (ECMWF ERA5-seamless). Not from INCOIS — INCOIS OSF does not provide atmospheric pressure.'
    } : {
      value_hpa: null,
      unit: 'hPa',
      source: 'Unavailable',
      provenance: 'demo',
      data_notice: 'Pressure unavailable — Open-Meteo request failed and INCOIS OSF does not expose MSLP.'
    },
    data_notice: 'INCOIS Ocean State Forecast — Operational model product. This is a numerical forecast, not a live buoy/sensor observation.',
    availability: {
      swh: !!swhResult,
      wind_speed: !!wsmResult,
      wind_direction: !!wdirResult,
      sst: !!sstResult,
      current: !!curResult,
      pressure: !!mslpResult
    }
  };
}

module.exports = { fetchIncoisOperationalData };
