import { useState, useRef } from 'react';
import { damageAssessment } from '../api';
import { ProvenanceBadge } from './Badges';

export default function DamageAssessment() {
  const [form, setForm] = useState({
    location: '',
    damage_description: '',
    structure_type: 'residential',
    estimated_affected_count: '',
    reporter_name: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.damage_description.trim()) {
      setError('Please describe the observed damage.');
      return;
    }
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('image', imageFile);
      const r = await damageAssessment(fd);
      setResult(r.data);
    } catch (e) {
      setError('Assessment failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div>
      <div className="damage-upload-notice">
        ⚠️ Image analysis unavailable with current model (ibm/granite-4-h-small does not support vision).
        Please describe the damage in text below. AI assessment will be based on your description and labeled as <strong>AI-Generated Text Analysis</strong>, not AI Image Analysis.
      </div>

      <form className="damage-form" onSubmit={handleSubmit}>
        {/* Image upload zone — accepted but only filename is logged */}
        <div>
          <label>Attach Photo (optional — for reference only, not analyzed by AI)</label>
          <div className="damage-upload-zone" onClick={() => fileRef.current.click()}>
            {imageFile
              ? <span style={{ color: '#60a5fa' }}>📷 {imageFile.name} attached (reference only)</span>
              : <span style={{ color: '#8a9ab8' }}>Click to attach a photo (optional)</span>
            }
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => setImageFile(e.target.files[0])} />
          </div>
        </div>

        <div>
          <label>Location *</label>
          <input placeholder="e.g. Jakhau village, Kutch" value={form.location} onChange={e => set('location', e.target.value)} />
        </div>

        <div>
          <label>Damage Description * (describe what you observe)</label>
          <textarea placeholder="e.g. Roof collapsed on 3 houses, main road flooded, fishing boats washed ashore..."
            value={form.damage_description} onChange={e => set('damage_description', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label>Structure Type</label>
            <select value={form.structure_type} onChange={e => set('structure_type', e.target.value)}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="fishing_boat">Fishing Boats</option>
              <option value="agricultural">Agricultural</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label>Est. Affected Count</label>
            <input type="number" placeholder="No. of people/structures" value={form.estimated_affected_count}
              onChange={e => set('estimated_affected_count', e.target.value)} />
          </div>
        </div>

        <div>
          <label>Reporter Name (optional)</label>
          <input placeholder="Name / Agency" value={form.reporter_name} onChange={e => set('reporter_name', e.target.value)} />
        </div>

        {error && <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>}

        <button type="submit" className="run-btn" disabled={loading}>
          {loading ? <><span className="spinner" /> Assessing...</> : '🔍 Assess Damage'}
        </button>
      </form>

      {result && result.data && (
        <div style={{ marginTop: 16 }}>
          <div className={`damage-tier ${result.data.damage_tier}`}>
            {result.data.damage_tier} — Score: {result.data.damage_score}/100
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#e8edf5', lineHeight: 1.7 }}>
            <strong>Structural Assessment:</strong> {result.data.structural_assessment}
          </div>
          {result.data.immediate_needs?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 12 }}>Immediate Needs:</strong>
              <ul style={{ fontSize: 12, color: '#8a9ab8', marginTop: 4, paddingLeft: 16 }}>
                {result.data.immediate_needs.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {result.data.search_rescue_required && <span style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>🆘 Search & Rescue Required</span>}
            {result.data.medical_emergency && <span style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>🏥 Medical Emergency</span>}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#8a9ab8' }}>
            Analysis basis: {result.data._ui_notice || result.data.assessment_basis} &nbsp;·&nbsp;
            <ProvenanceBadge provenance={result.data.provenance || 'demo'} />
          </div>
          {result.data.disclaimer && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#8a9ab8', fontStyle: 'italic' }}>
              ⚠️ {result.data.disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
