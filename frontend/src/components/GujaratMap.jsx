import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';

const GUJARAT_CENTER = [22.0, 70.5];

// Exposure color for settlement markers
function exposureColor(tier) {
  if (!tier) return '#3b82f6';
  if (tier === 'red') return '#dc2626';
  if (tier === 'orange') return '#f97316';
  if (tier === 'yellow') return '#f59e0b';
  return '#3b82f6';
}

// Storm track color by category
function trackColor(cat) {
  if (!cat) return '#94a3b8';
  if (cat.includes('Extremely')) return '#dc2626';
  if (cat.includes('Very Severe')) return '#f97316';
  if (cat.includes('Severe')) return '#f59e0b';
  if (cat.includes('Cyclonic Storm')) return '#60a5fa';
  return '#94a3b8';
}

function StormTrack({ track, currentIdx }) {
  if (!track || track.length === 0) return null;
  const visible = track.slice(0, Math.floor(currentIdx) + 1);
  const positions = visible.map(p => [p.lat, p.lon]);

  return (
    <>
      {positions.length > 1 && (
        <Polyline positions={positions} color="#3b82f6" weight={2} opacity={0.7} dashArray="4 4" />
      )}
      {visible.map((p, i) => (
        <CircleMarker key={p.id} center={[p.lat, p.lon]}
          radius={i === visible.length - 1 ? 8 : 4}
          fillColor={trackColor(p.category)}
          color={i === visible.length - 1 ? 'white' : trackColor(p.category)}
          weight={i === visible.length - 1 ? 2 : 1}
          fillOpacity={i === visible.length - 1 ? 1 : 0.6}
          opacity={1}>
          <Tooltip>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
              <strong>{p.category}</strong><br />
              🌀 {p.wind_kmh} km/h | {p.pressure_hpa} hPa<br />
              🌊 {p.wave_height_m}m | {new Date(p.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

function SettlementMarkers({ settlements, evacuationPriorities }) {
  const priorityMap = {};
  if (evacuationPriorities) {
    evacuationPriorities.forEach(p => { priorityMap[p.settlement_id] = p; });
  }
  return settlements.map(s => {
    const pri = priorityMap[s.id];
    const color = pri ? exposureColor(pri.priority_color) : '#3b82f6';
    return (
      <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={10}
        fillColor={color} color="white" weight={1.5} fillOpacity={0.85} opacity={1}>
        <Tooltip permanent={false} direction="top">
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            <strong>{s.name}</strong> {pri && <span style={{ color }}>[{pri.priority_tier}]</span>}<br />
            👥 Pop: {s.population?.toLocaleString()}<br />
            🏠 Shelter: {s.shelter_capacity?.toLocaleString()}<br />
            🎣 Boats: {s.fishing_boats}
          </div>
        </Tooltip>
      </CircleMarker>
    );
  });
}

export default function GujaratMap({ track, currentTrackIdx, settlements, evacuationPriorities }) {
  return (
    <div className="map-container">
      <MapContainer center={GUJARAT_CENTER} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>'
          maxZoom={18}
        />
        <StormTrack track={track} currentIdx={currentTrackIdx} />
        {settlements.length > 0 && (
          <SettlementMarkers settlements={settlements} evacuationPriorities={evacuationPriorities} />
        )}
      </MapContainer>
    </div>
  );
}
