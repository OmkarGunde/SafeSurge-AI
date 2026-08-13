import { useState, useEffect, useRef } from 'react';
import { ProvenanceBadge } from './Badges';
import { getBiparjoyReplay } from '../api';

// 27 track points — Jun 6 formation → Jun 15 landfall
// bp_001..bp_017: formation/intensification/stall (Jun 6–10)
// bp_018..bp_020: stall/slow NE movement (Jun 11–13)
// bp_021..bp_022: recurve/re-intensify (Jun 14)
// bp_023..bp_025: final approach/landfall (Jun 15)
// bp_026..bp_027: post-landfall weakening
const TRACK_LABELS = [
  'T-9d: Formation (Jun 6)',     // 0  bp_001
  'T-8.75d',                     // 1  bp_002
  'T-8.5d: Cyclonic Storm',      // 2  bp_003
  'T-8.25d',                     // 3  bp_004
  'T-8d: Severe',                // 4  bp_005
  'T-7.75d',                     // 5  bp_006
  'T-7.5d: Very Severe',         // 6  bp_007
  'T-7.25d',                     // 7  bp_008
  'T-7d: Extremely Severe',      // 8  bp_009
  'T-6.75d: Intensifying',       // 9  bp_010
  'T-6.5d',                      // 10 bp_011
  'T-6d: PEAK (250 km/h)',       // 11 bp_012
  'T-5.75d: Weakening',          // 12 bp_013
  'T-5.5d',                      // 13 bp_014
  'T-5.25d',                     // 14 bp_015
  'T-5d',                        // 15 bp_016
  'T-4.75d: Stalling (Jun 10)',  // 16 bp_017
  'Stall → NE Turn (Jun 11)',    // 17 bp_018
  'NNE Recurve (Jun 12)',        // 18 bp_019
  'Approaching Gujarat (Jun 13)',// 19 bp_020
  'Gujarat Sea Area (Jun 14)',   // 20 bp_021
  'T-24h to Landfall',           // 21 bp_022
  'T-6h to Landfall (Jun 15)',   // 22 bp_023
  'T-3h: Final Approach',        // 23 bp_024
  'LANDFALL — Jakhau',           // 24 bp_025
  'Post-Landfall Weakening',     // 25 bp_026
  'Cyclone Dissipating',         // 26 bp_027
];

const TOTAL = 26; // 0-indexed max (27 points = indices 0..26)

export default function BiparjoyReplay({ onTrackUpdate, onSimulate }) {
  const [timestep, setTimestep] = useState(21); // default T-24h (bp_022)
  const [playing, setPlaying] = useState(false);
  const [trackPoint, setTrackPoint] = useState(null);
  const [simWind, setSimWind] = useState(185);
  const [simWave, setSimWave] = useState(9.2);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchTrackPoint(timestep);
  }, [timestep]);

  async function fetchTrackPoint(idx) {
    try {
      const r = await getBiparjoyReplay(idx);
      if (r.data.success) {
        const pt = r.data.data;
        setTrackPoint(pt);
        onTrackUpdate && onTrackUpdate(pt, idx);
      }
    } catch (e) { /* silent */ }
  }

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setTimestep(prev => {
          if (prev >= TOTAL) { setPlaying(false); return TOTAL; }
          return prev + 1;
        });
      }, 800);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  const label = TRACK_LABELS[Math.round(timestep)] || `Step ${timestep}`;

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-title"><span className="icon">🔵</span> Biparjoy 2023 — Historical Replay <ProvenanceBadge provenance="historical" /></div>

      <div className="data-notice">
        Historical Replay — Cyclone Biparjoy, June 6–15 2023 (NOAA IBTrACS). Not current/live data. 27 track points from formation (Arabian Sea) to landfall (Jakhau, Gujarat).
      </div>

      {/* Replay Controls */}
      <div className="replay-controls">
        <button className="play-btn" onClick={() => {
          if (timestep >= TOTAL) setTimestep(0);
          setPlaying(p => !p);
        }}>
          {playing ? '⏸ Pause' : timestep >= TOTAL ? '↩ Restart' : '▶ Play'}
        </button>
        <input type="range" className="replay-slider" min={0} max={TOTAL} step={1}
          value={timestep} onChange={e => { setPlaying(false); setTimestep(Number(e.target.value)); }} />
        <span className="replay-time">{label}</span>
      </div>

      {/* Track stats */}
      {trackPoint && (
        <div className="replay-stats">
          <div className="replay-stat">
            <div className="replay-stat-val" style={{ color: '#f97316' }}>{Math.round(trackPoint.wind_kmh || 0)}</div>
            <div className="replay-stat-lbl">Wind km/h</div>
          </div>
          <div className="replay-stat">
            <div className="replay-stat-val" style={{ color: '#3b82f6' }}>{(trackPoint.wave_height_m || 0).toFixed(1)}</div>
            <div className="replay-stat-lbl">Wave (m)</div>
          </div>
          <div className="replay-stat">
            <div className="replay-stat-val" style={{ color: '#8a9ab8' }}>{Math.round(trackPoint.pressure_hpa || 0)}</div>
            <div className="replay-stat-lbl">Pressure hPa</div>
          </div>
          <div className="replay-stat">
            <div className="replay-stat-val" style={{ color: '#22c55e' }}>{Math.round(trackPoint.distance_from_gujarat_km || 0)}</div>
            <div className="replay-stat-lbl">km from Gujarat</div>
          </div>
        </div>
      )}
      {trackPoint && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#8a9ab8' }}>
          📍 {trackPoint.category} | {trackPoint.lat?.toFixed(2)}°N {trackPoint.lon?.toFixed(2)}°E
          {trackPoint.note && <span style={{ marginLeft: 8, color: '#60a5fa' }}>— {trackPoint.note}</span>}
        </div>
      )}

      {/* Simulate Intensification */}
      <div style={{ marginTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 10 }}><span className="icon">⚙️</span> Simulate Intensification <span style={{ fontSize: 10, color: '#8a9ab8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(drag sliders, then click Run AI Response)</span></div>
        <div className="sim-panel">
          <div className="sim-row">
            <span className="sim-label">Wind km/h</span>
            <input type="range" className="sim-slider" min={50} max={280} step={5}
              value={simWind} onChange={e => setSimWind(Number(e.target.value))} />
            <span className="sim-val">{simWind}</span>
          </div>
          <div className="sim-row">
            <span className="sim-label">Wave height (m)</span>
            <input type="range" className="sim-slider" min={1} max={15} step={0.5}
              value={simWave} onChange={e => setSimWave(Number(e.target.value))} />
            <span className="sim-val">{simWave}m</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#8a9ab8', flex: 1 }}>
              {simWind > 157
                ? <span style={{ color: '#f87171' }}>🔴 CRITICAL — exceeds 157 km/h threshold</span>
                : simWind > 120
                ? <span style={{ color: '#fb923c' }}>🟠 HIGH — exceeds 120 km/h threshold</span>
                : simWind > 75
                ? <span style={{ color: '#fcd34d' }}>🟡 MODERATE — exceeds 75 km/h threshold</span>
                : <span style={{ color: '#4ade80' }}>🟢 LOW — below warning thresholds</span>}
            </div>
            <button className="run-btn" style={{ width: 'auto', padding: '8px 18px', fontSize: 13 }}
              onClick={() => onSimulate && onSimulate({ wind_speed_kmh: simWind, wave_height_m: simWave, provenance: 'demo' })}>
              Run AI Response ⚡
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
