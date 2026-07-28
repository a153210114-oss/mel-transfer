const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = (process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY || '';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function cleanText(value = '', max = 260) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function componentMap(components = []) {
  const out = {};
  for (const item of components) {
    const types = item.types || [];
    const longName = cleanText(item.long_name || '');
    if (types.includes('street_number')) out.street_number = longName;
    if (types.includes('route')) out.street = longName;
    if (types.includes('locality')) out.city = longName;
    if (types.includes('postal_town') && !out.city) out.city = longName;
    if (types.includes('administrative_area_level_2')) out.district = longName;
    if (types.includes('sublocality') || types.includes('sublocality_level_1')) out.suburb = longName;
    if (types.includes('administrative_area_level_1')) out.state = cleanText(item.short_name || longName, 80);
    if (types.includes('country')) out.country = longName;
    if (types.includes('postal_code')) out.postal_code = longName;
  }
  return out;
}

function precisionFromTypes(types = []) {
  if (types.includes('street_address') || types.includes('premise') || types.includes('subpremise')) return 'premise';
  if (types.includes('route')) return 'street';
  if (types.includes('sublocality') || types.includes('sublocality_level_1')) return 'suburb';
  if (types.includes('locality')) return 'city';
  if (types.includes('administrative_area_level_1')) return 'state';
  if (types.includes('country')) return 'country';
  return 'coordinate';
}

function normalizeGoogleResult(result = {}) {
  const location = result.geometry?.location || {};
  const components = componentMap(result.address_components || []);
  const placeId = cleanText(result.place_id || '', 180);
  return {
    ...components,
    latitude: numberOrNull(location.lat),
    longitude: numberOrNull(location.lng),
    formatted_address: cleanText(result.formatted_address || '', 360),
    place_id: placeId,
    google_maps_uri: placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : '',
    precision_level: precisionFromTypes(result.types || []),
    raw_components: result
  };
}

async function googleGeocode(params = {}) {
  if (!GOOGLE_KEY) throw new Error('Google Maps API Key 未配置');
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('language', params.language || 'zh-CN');
  url.searchParams.set('region', params.region || 'au');
  url.searchParams.set('key', GOOGLE_KEY);
  if (params.latlng) url.searchParams.set('latlng', params.latlng);
  if (params.address) url.searchParams.set('address', params.address);
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || json.status !== 'OK') {
    throw new Error(`Google Geocoding ${response.status} ${json.status || ''}${json.error_message ? `: ${json.error_message}` : ''}`);
  }
  return (json.results || []).map(normalizeGoogleResult);
}

async function supa(path, options = {}) {
  if (!SERVICE_KEY) throw new Error('Supabase 服务密钥未配置');
  const response = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} ${response.status}: ${text}`);
  return body;
}

async function saveLocation(body = {}) {
  const address = body.location || body.address || {};
  const latitude = numberOrNull(address.latitude ?? body.latitude);
  const longitude = numberOrNull(address.longitude ?? body.longitude);
  if (latitude === null || longitude === null) throw new Error('缺少有效经纬度');
  const entityType = cleanText(body.entity_type || body.entityType || 'user_profile', 40);
  const legacyKey = cleanText(body.legacy_entity_key || body.legacyEntityKey || body.owner_code || body.ownerCode || body.friend_code || body.friendCode || '', 160);
  const payload = {
    entity_type: entityType,
    legacy_entity_key: legacyKey,
    latitude,
    longitude,
    country: cleanText(address.country || body.country || 'Australia', 80),
    state: cleanText(address.state || body.state || '', 80),
    city: cleanText(address.city || body.city || '', 100),
    suburb: cleanText(address.suburb || body.suburb || '', 120),
    district: cleanText(address.district || body.district || '', 120),
    street: cleanText(address.street || body.street || '', 160),
    street_number: cleanText(address.street_number || body.street_number || '', 40),
    postal_code: cleanText(address.postal_code || body.postal_code || '', 40),
    formatted_address: cleanText(address.formatted_address || body.formatted_address || '', 360),
    place_id: cleanText(address.place_id || body.place_id || '', 180),
    google_maps_uri: cleanText(address.google_maps_uri || body.google_maps_uri || '', 360),
    address_source: cleanText(body.address_source || body.addressSource || 'google_place', 40),
    precision_level: cleanText(address.precision_level || body.precision_level || 'coordinate', 40),
    visibility_level: cleanText(body.visibility_level || body.visibilityLevel || 'city', 40),
    address_verified: body.confirmed === true,
    verification_status: body.confirmed === true ? 'confirmed_by_user' : 'needs_user_confirmation',
    raw_components: address.raw_components || {},
    fields: {
      owner_code: cleanText(body.owner_code || body.ownerCode || '', 80),
      friend_code: cleanText(body.friend_code || body.friendCode || '', 80),
      source: 'huaban_location_api'
    },
    resolved_at: new Date().toISOString()
  };
  const conflict = legacyKey ? 'entity_type,legacy_entity_key' : 'entity_type,entity_id';
  const rows = await supa(`hb_location_addresses?on_conflict=${conflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      google_geocoding: Boolean(GOOGLE_KEY),
      supabase_write: Boolean(SERVICE_KEY),
      modes: ['search', 'reverse_geocode', 'save']
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const action = cleanText(body.action || 'search', 40);
    if (action === 'search') {
      const query = cleanText(body.query || body.address || '', 260);
      if (!query) return res.status(400).json({ error: '请输入地点或地址' });
      const city = cleanText(body.city || 'Melbourne', 80);
      const results = await googleGeocode({ address: `${query} ${city} Australia`, language: body.language || 'zh-CN' });
      return res.status(200).json({ ok: true, results: results.slice(0, 6) });
    }
    if (action === 'reverse_geocode') {
      const lat = numberOrNull(body.latitude ?? body.lat);
      const lng = numberOrNull(body.longitude ?? body.lng);
      if (lat === null || lng === null) return res.status(400).json({ error: '缺少有效经纬度' });
      const results = await googleGeocode({ latlng: `${lat},${lng}`, language: body.language || 'zh-CN' });
      return res.status(200).json({ ok: true, results: results.slice(0, 6), location: results[0] || null });
    }
    if (action === 'save') {
      const row = await saveLocation(body);
      return res.status(200).json({ ok: true, location: row });
    }
    return res.status(400).json({ error: '未知位置动作' });
  } catch (error) {
    console.error('locations error', error);
    return res.status(500).json({ error: error.message || '位置服务暂不可用' });
  }
};
