const SUPA_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY || '';
const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');
const limitArg = process.argv.find(item => item.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 50), 1), 500);

function requiredEnv() {
  const missing = [];
  if (!SUPA_URL) missing.push('SUPABASE_URL');
  if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!GOOGLE_KEY) missing.push('GOOGLE_MAPS_API_KEY');
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(', ')}`);
  }
}

function cleanText(value = '', max = 260) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function supa(path, options = {}) {
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
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${text}`);
  }
  return body;
}

function componentMap(components = []) {
  const out = {};
  for (const item of components) {
    const types = item.types || [];
    const longName = cleanText(item.long_name || item.longText || '');
    if (types.includes('street_number')) out.street_number = longName;
    if (types.includes('route')) out.street = longName;
    if (types.includes('locality')) out.city = longName;
    if (types.includes('postal_town') && !out.city) out.city = longName;
    if (types.includes('administrative_area_level_2')) out.district = longName;
    if (types.includes('sublocality') || types.includes('sublocality_level_1')) out.suburb = longName;
    if (types.includes('administrative_area_level_1')) out.state = cleanText(item.short_name || item.shortText || longName, 80);
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

async function reverseGeocode(lat, lng) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('language', 'zh-CN');
  url.searchParams.set('key', GOOGLE_KEY);
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || json.status !== 'OK') {
    throw new Error(`Google Geocoding ${response.status} ${json.status || ''}`);
  }
  const result = json.results?.[0];
  if (!result) throw new Error('Google Geocoding empty result');
  const components = componentMap(result.address_components || []);
  return {
    ...components,
    formatted_address: cleanText(result.formatted_address || '', 360),
    place_id: cleanText(result.place_id || '', 180),
    google_maps_uri: result.place_id ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(result.place_id)}` : '',
    precision_level: precisionFromTypes(result.types || []),
    raw_components: result
  };
}

async function readLegacyAccounts() {
  const select = 'id,account_uid,friend_code,display_name,fields';
  const rows = await supa(`huaban_accounts?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&select=${select}&limit=${limit}`);
  return (rows || []).filter(row => {
    const lat = numberOrNull(row.fields?.location_lat);
    const lng = numberOrNull(row.fields?.location_lng);
    return lat !== null && lng !== null;
  });
}

async function upsertAddress(row, address) {
  const lat = numberOrNull(row.fields?.location_lat);
  const lng = numberOrNull(row.fields?.location_lng);
  const payload = {
    entity_type: 'legacy_account',
    legacy_entity_key: cleanText(row.account_uid || row.id || row.friend_code || '', 160),
    latitude: lat,
    longitude: lng,
    country: cleanText(address.country || row.fields?.country || 'Australia', 80),
    state: cleanText(address.state || '', 80),
    city: cleanText(address.city || row.fields?.city || '', 100),
    suburb: cleanText(address.suburb || '', 120),
    district: cleanText(address.district || '', 120),
    street: cleanText(address.street || '', 160),
    street_number: cleanText(address.street_number || '', 40),
    postal_code: cleanText(address.postal_code || '', 40),
    formatted_address: cleanText(address.formatted_address || row.fields?.location_address || '', 360),
    place_id: cleanText(address.place_id || '', 180),
    google_maps_uri: cleanText(address.google_maps_uri || '', 360),
    address_source: 'reverse_geocode',
    precision_level: address.precision_level || 'coordinate',
    visibility_level: 'city',
    address_verified: false,
    verification_status: 'needs_user_confirmation',
    raw_components: address.raw_components || {},
    fields: {
      legacy_account_id: row.id,
      friend_code: row.friend_code || '',
      display_name: row.display_name || '',
      previous_location_address: row.fields?.location_address || ''
    },
    resolved_at: new Date().toISOString()
  };
  await supa('hb_location_addresses?on_conflict=entity_type,legacy_entity_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  await supa(`huaban_accounts?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&id=eq.${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        ...(row.fields || {}),
        address_object: {
          country: payload.country,
          state: payload.state,
          city: payload.city,
          suburb: payload.suburb,
          district: payload.district,
          street: payload.street,
          street_number: payload.street_number,
          postal_code: payload.postal_code,
          formatted_address: payload.formatted_address,
          place_id: payload.place_id,
          source: payload.address_source,
          verified: false
        }
      }
    })
  });
}

async function main() {
  requiredEnv();
  const rows = await readLegacyAccounts();
  const result = { mode: writeMode ? 'write' : 'dry-run', checked: rows.length, resolved: 0, written: 0, failed: [] };
  for (const row of rows) {
    const lat = numberOrNull(row.fields?.location_lat);
    const lng = numberOrNull(row.fields?.location_lng);
    try {
      const address = await reverseGeocode(lat, lng);
      result.resolved += 1;
      if (writeMode) {
        await upsertAddress(row, address);
        result.written += 1;
      }
    } catch (error) {
      result.failed.push({
        legacy_entity_key: row.account_uid || row.id || row.friend_code,
        message: error.message
      });
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (!writeMode) {
    console.log('Dry run only. Re-run with --write to upsert hb_location_addresses and account fields.address_object.');
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
