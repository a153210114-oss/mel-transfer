const crypto = require('crypto');

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://www.huabanapp.com';
const { handleLocalNeedSavedScenario, handleServiceCompletionConfirmedScenario } = require('../lib/scenario-events');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a = '', b = '') {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyAdminToken(token = '') {
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || adminPassword;
  if (!adminPassword || !secret) return false;
  const [encoded, signature] = String(token).split('.');
  if (!encoded || !signature || !safeEqual(signature, sign(encoded, secret))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.sub === 'huaban-admin' && Number(payload.exp) > Date.now();
  } catch (error) {
    return false;
  }
}

function cleanText(value = '', max = 1000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function cleanCode(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase().slice(0, 40);
}

function cleanPhone(value = '') {
  const raw = stripHtml(String(value || '')).replace(/[^\d+]/g, '');
  if (!raw) return '';
  if (/^\+61[23478]\d{8}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (/^61[23478]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[23478]\d{8}$/.test(digits)) return digits;
  if (/^[23478]\d{8}$/.test(digits)) return `0${digits}`;
  if (/^\+[23478]\d{8}$/.test(raw)) return `0${digits}`;
  return raw.slice(0, 32);
}

function phoneVariants(value = '') {
  const phone = cleanPhone(value);
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '');
  const variants = new Set([phone]);
  if (/^0[23478]\d{8}$/.test(phone)) variants.add(`+61${phone.slice(1)}`);
  if (/^61[23478]\d{8}$/.test(digits)) variants.add(`+${digits}`);
  if (/^61[23478]\d{8}$/.test(digits)) variants.add(`0${digits.slice(2)}`);
  if (/^\+61[23478]\d{8}$/.test(phone)) variants.add(`0${digits.slice(2)}`);
  return Array.from(variants).filter(Boolean);
}

function supaIn(values = []) {
  return values
    .map(value => `"${String(value).replace(/"/g, '')}"`)
    .map(value => encodeURIComponent(value))
    .join(',');
}

function stripHtml(value = '') {
  return cleanText(value, 2000)
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAddress(value = '', max = 220) {
  return cleanText(stripHtml(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '')
    .replace(/(?:电话|手機|手机|电邮|邮箱|email|phone|tel)[:：]?\s*\+?[\d\s().-]{6,}/ig, '')
    .replace(/(?:电邮|邮箱|email)[:：]?.*$/i, '')
    .replace(/\b(?:wechat|微信)[:：]?\s*[a-z0-9_-]{4,}\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim(), max);
}

function urlHost(value = '') {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

function normalizeSearchResult(item = {}, provider = 'public_search') {
  return {
    title: stripHtml(item.title || item.name || ''),
    snippet: stripHtml(item.snippet || item.description || ''),
    url: cleanText(item.url || item.link || '', 520),
    provider
  };
}

function extractPhones(text = '') {
  const body = String(text || '').replace(/\s+/g, ' ');
  const matches = body.match(/(?:\+?61|0)\s?(?:2|3|4|7|8)\s?(?:[\d\s().-]{7,14})|\+?\d[\d\s().-]{8,18}\d/g) || [];
  return Array.from(new Set(matches
    .map(item => cleanPhone(item))
    .filter(item => item.length >= 9 && item.length <= 16 && !/^0{5,}/.test(item))
  )).slice(0, 4);
}

function extractEmails(text = '') {
  const matches = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [];
  return Array.from(new Set(matches
    .map(item => cleanText(item.toLowerCase(), 160))
    .filter(item => !/example\.com|test\.com|placeholder/i.test(item))
  )).slice(0, 4);
}

function orderNo() {
  return `HB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function supa(path, options = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Supabase ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

const PRODUCT_CATEGORY_RULES = [
  {
    code: 'building_materials',
    label: '建材',
    keywords: ['建材', '瓷砖', '地砖', '墙砖', '木地板', '地板', '水泥', '砂石', '石膏板', '油漆', '涂料', '门窗', '卫浴', 'tile', 'tiles', 'flooring', 'hardware', 'building material']
  },
  {
    code: 'plants_flowers',
    label: '花卉苗木',
    keywords: ['花卉', '苗木', '果树', '树苗', '盆栽', '绿植', '花盆', '种子', '菜苗', '苗圃', '园艺店', 'nursery', 'plant', 'plants', 'flower', 'garden centre', 'fruit tree']
  },
  {
    code: 'kitchenware',
    label: '厨具餐具',
    keywords: ['厨具', '锅', '炒锅', '汤锅', '电饭锅', '高压锅', '不粘锅', '刀具', '餐具', '碗', '盘子', '筷子', '厨房用品', 'cookware', 'kitchenware', 'wok', 'pan', 'pot']
  },
  {
    code: 'seafood',
    label: '海鲜海产品',
    keywords: ['海鲜', '海产', '水产', '龙虾', '澳洲龙虾', '虾', '螃蟹', '鱼', '生蚝', 'oyster', 'lobster', 'seafood', 'fish', 'crab', 'prawn', 'shrimp']
  },
  {
    code: 'asian_grocery',
    label: '亚洲食品杂货',
    keywords: ['华人超市', '亚洲超市', '调料', '火锅底料', '米面粮油', '零食', '茶叶', '酱油', '醋', '豆腐', 'grocery', 'asian grocery', 'supermarket']
  },
  {
    code: 'home_appliances',
    label: '家电',
    keywords: ['家电', '冰箱', '洗衣机', '烘干机', '电视', '空调', '微波炉', '吸尘器', 'appliance', 'fridge', 'washing machine', 'tv']
  },
  {
    code: 'furniture',
    label: '家具家居',
    keywords: ['家具', '沙发', '床垫', '床架', '桌子', '椅子', '柜子', '窗帘', '家居', 'furniture', 'sofa', 'mattress']
  },
  {
    code: 'baby_products',
    label: '母婴用品',
    keywords: ['母婴', '奶粉', '尿不湿', '纸尿裤', '婴儿车', '儿童座椅', 'baby', 'infant', 'stroller', 'car seat']
  },
  {
    code: 'chinese_school',
    label: '中文学校',
    keywords: ['中文学校', '中文课', '学中文', '汉语课', '华文学校', '周末中文', '中文补习', 'chinese school', 'mandarin school', 'mandarin class', 'chinese class']
  },
  {
    code: 'kids_activity',
    label: '儿童兴趣班',
    keywords: ['兴趣班', '课外班', '才艺班', '儿童班', '孩子学', '画画', '美术', '钢琴', '小提琴', '舞蹈', '芭蕾', '跆拳道', '游泳', '足球', '篮球', '机器人', '编程', '乐高', 'kids activity', 'after school', 'art class', 'dance class', 'music class', 'coding class', 'sports class']
  },
  {
    code: 'tutoring',
    label: '补习辅导',
    keywords: ['补习', '辅导', '家教', '数学补习', '英文补习', '私教', '考前辅导', 'naplan', 'vce', 'tutor', 'tuition', 'tutoring']
  }
];

function productCategoryFromText(text = '') {
  const body = cleanText(text, 1600).toLowerCase();
  return PRODUCT_CATEGORY_RULES.find(rule => rule.keywords.some(word => body.includes(String(word).toLowerCase()))) || null;
}

function productKeywordsForCode(code = '') {
  const rule = PRODUCT_CATEGORY_RULES.find(item => item.code === cleanText(code, 80));
  return rule ? rule.keywords.slice(0, 10) : [];
}

const CITY_FEED_RULES = [
  { type: 'service_intro', label: '本地服务', tags: ['服务', '手艺', '接送', '修车', '割草', '维修', '清洁', '搬家', '装修', '会计', '留学', '移民', 'service', 'repair'] },
  { type: 'resource', label: '商品资源', tags: ['有货', '出售', '转让', '龙虾', '海鲜', '果树', '瓷砖', '锅', '厨具', '建材', '二手', 'sale', 'sell'] },
  { type: 'activity', label: '活动邀约', tags: ['一起', '周末', '拼团', '旅游', '聚会', '打球', '徒步', '活动', '报名', 'join', 'event'] },
  { type: 'nearby_help', label: '附近求助', tags: ['求助', '帮忙', '急', '需要', '谁有', '哪里有', '找人', '找个', 'help'] },
  { type: 'note', label: '生活动态', tags: ['今天', '分享', '记录', '生活', '附近', '同城'] }
];

function classifyCityFeed(text = '') {
  const body = cleanText(text, 2000).toLowerCase();
  const product = productCategoryFromText(body);
  const matched = CITY_FEED_RULES.find(rule => rule.tags.some(tag => body.includes(String(tag).toLowerCase()))) || CITY_FEED_RULES[CITY_FEED_RULES.length - 1];
  const tags = new Set([matched.label]);
  if (product?.label) tags.add(product.label);
  if (/找|哪里|有没有|求|需要/.test(body)) tags.add('需求');
  if (/提供|可做|接单|出售|有货|店|服务/.test(body)) tags.add('供给');
  if (/墨尔本|melbourne/i.test(body)) tags.add('墨尔本');
  if (/悉尼|sydney/i.test(body)) tags.add('悉尼');
  return {
    post_type: product ? 'resource' : matched.type,
    category_label: product?.label || matched.label,
    category_code: product?.code || matched.type,
    tags: Array.from(tags).slice(0, 8)
  };
}

function cleanCityFeedMedia(media = []) {
  const rows = Array.isArray(media) ? media : [];
  return rows.slice(0, 4).map(item => ({
    type: ['image', 'video'].includes(cleanText(item.type, 20)) ? cleanText(item.type, 20) : 'image',
    name: cleanText(item.name || '', 160),
    mime: cleanText(item.mime || '', 120),
    data_url: cleanText(item.data_url || item.url || '', 300000)
  })).filter(item => item.data_url && /^data:(image|video)\//.test(item.data_url));
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const aLat = toNumber(lat1);
  const aLng = toNumber(lng1);
  const bLat = toNumber(lat2);
  const bLng = toNumber(lng2);
  if (aLat === null || aLng === null || bLat === null || bLng === null) return null;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * s2 * s2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearbyPersonFromAccount(row = {}, viewer = {}) {
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
  const lat = toNumber(fields.location_lat);
  const lng = toNumber(fields.location_lng);
  const dist = distanceKm(viewer.lat, viewer.lng, lat, lng);
  const city = cleanText(fields.city || '', 80);
  const name = cleanText(row.display_name || fields.display_name || '华伴用户', 80);
  const industry = cleanText(fields.industry || '', 100);
  return {
    code: cleanCode(row.friend_code || fields.canonical_friend_code || ''),
    name,
    industry,
    avatar: cleanText(fields.avatar || '👤', 800),
    city,
    address: cleanText(fields.location_address || '', 220),
    distance_km: dist === null ? null : Math.round(dist * 10) / 10,
    distance_text: dist === null ? (city ? '同城，距离待补' : '距离待补') : `${Math.round(dist * 10) / 10} km`,
    card_url: `${PUBLIC_ORIGIN}/ai.html?intent=friend_chat&friend=${encodeURIComponent(cleanCode(row.friend_code || ''))}`,
    updated_at: fields.nearby_updated_at || row.updated_at || row.created_at || ''
  };
}

function nearbyMatchesKeyword(person = {}, keyword = '') {
  const key = cleanText(keyword, 80).toLowerCase();
  if (!key) return true;
  const hay = [person.name, person.industry, person.city, person.address].join(' ').toLowerCase();
  return hay.includes(key);
}

function productSearchTermsForCode(code = '') {
  const terms = {
    building_materials: 'tiles flooring hardware building materials',
    plants_flowers: 'nursery plants fruit tree garden centre',
    kitchenware: 'kitchenware cookware wok pan pot store',
    seafood: 'seafood lobster fish market supplier',
    asian_grocery: 'asian grocery supermarket Chinese grocery',
    home_appliances: 'home appliances appliance store',
    furniture: 'furniture homeware store',
    baby_products: 'baby products baby store',
    chinese_school: 'Chinese school Mandarin class weekend school',
    kids_activity: 'kids activities after school art dance music sports classes',
    tutoring: 'tutoring tuition tutor learning centre'
  };
  return terms[cleanText(code, 80)] || '';
}

function isProductCategoryCode(code = '') {
  return PRODUCT_CATEGORY_RULES.some(item => item.code === cleanText(code, 80));
}

function canonicalServiceCode(code = '', label = '') {
  const text = `${code || ''} ${label || ''}`.toLowerCase();
  if (/接送机|机场接送|机场接机|机场送机|接机|送机|airport\s*(pickup|transfer|shuttle)|airport_pickup|airport_transfer/.test(text)) return 'airport_pickup';
  if (/汽车租赁|租车|车辆租赁|car\s*rent|car\s*rental|car_hire|vehicle\s*rental/.test(text)) return 'car_rental';
  return cleanText(code, 80);
}

function serviceFromText(text = '') {
  const t = text.toLowerCase();
  const productCategory = productCategoryFromText(text);
  if (productCategory) return { code: productCategory.code, label: productCategory.label };
  const rules = [
    { code: 'electrician', label: '电工', rx: /电工|电路|电闸|电线|插座|electrician|electrical/ },
    { code: 'plumber', label: '水管工', rx: /水管|漏水|下水道|马桶|plumber|plumbing/ },
    { code: 'cleaning', label: '清洁家政', rx: /清洁|保洁|家政|打扫|cleaner|cleaning/ },
    { code: 'airport_pickup', label: '接送机', rx: /机场接送|接送机|机场接机|机场送机|接机|送机|airport\s*(pickup|transfer|shuttle)/ },
    { code: 'car_rental', label: '汽车租赁', rx: /汽车租赁|租车|车辆租赁|car\s*rent|car\s*rental|car_hire|vehicle\s*rental/ },
    { code: 'local_ride', label: '本地接送', rx: /本地接送|出行协助|用车|ride|transport|pickup|drop.?off/ },
    { code: 'gardening', label: '割草园艺', rx: /割草|草坪|园艺|修剪|gardening|lawn|mowing/ },
    { code: 'auto', label: '汽车服务', rx: /二手车|修车|汽修|汽车|车商|mechanic|car/ },
    { code: 'accounting', label: '会计税务', rx: /会计|报税|税务|accountant|tax/ },
    { code: 'legal', label: '律师法律', rx: /律师|法律|合同|lawyer|legal/ },
    { code: 'migration', label: '移民留学', rx: /移民|签证|留学|visa|migration/ },
    { code: 'real_estate', label: '房产租售', rx: /房产|租房|买房|卖房|中介|real estate|property/ }
  ];
  return rules.find(rule => rule.rx.test(t)) || { code: 'local_service', label: '本地服务' };
}

function supplyServiceCodeAliases(code = '') {
  const normalized = canonicalServiceCode(code);
  const groups = [
    ['airport_pickup', 'airport_transfer', 'local_ride', 'ride', 'transport', 'pickup'],
    ['car_rental', 'car_hire', 'vehicle_rental', 'auto_rental', 'rental_car'],
    ['gardening', 'lawn_mowing', 'lawn', 'mowing', 'garden'],
    ['plumber', 'home_repair', 'plumbing'],
    ['electrician', 'home_repair', 'electrical'],
    ['cleaning', 'home_cleaning', 'cleaner'],
    ['auto', 'mechanic', 'car_service'],
    ['seafood', 'seafood_supplier', 'seafood_products', 'lobster', 'aquatic_products'],
    ['building_materials', 'tiles', 'tile', 'hardware', 'building_material', 'renovation_materials'],
    ['plants_flowers', 'nursery', 'plants', 'flowers', 'garden_centre', 'garden_center'],
    ['kitchenware', 'cookware', 'kitchen_supplies', 'homeware'],
    ['asian_grocery', 'grocery', 'supermarket', 'asian_supermarket'],
    ['home_appliances', 'appliances', 'electronics'],
    ['furniture', 'home_furnishing', 'homeware'],
    ['baby_products', 'baby_store', 'maternal_baby'],
    ['chinese_school', 'mandarin_school', 'language_school', 'chinese_class'],
    ['kids_activity', 'after_school', 'kids_classes', 'activity_classes'],
    ['tutoring', 'tuition', 'tutor', 'learning_centre']
  ];
  const group = groups.find(items => items.includes(normalized));
  return Array.from(new Set(group || [normalized])).filter(Boolean);
}

function supplyKeywordFallback(parsed = {}) {
  const code = cleanText(parsed.service_type_code || '', 80);
  const text = `${parsed.service_type || ''} ${parsed.rawText || ''} ${parsed.summary || ''}`;
  const codeKeywords = productKeywordsForCode(code);
  if (codeKeywords.length) return codeKeywords;
  const inferred = productCategoryFromText(text);
  if (inferred) return inferred.keywords.slice(0, 10);
  return [];
}

function supplyKeywordOrParam(keywords = []) {
  const clauses = [];
  for (const word of keywords) {
    const safe = cleanText(word, 40);
    if (!safe) continue;
    clauses.push(`service_type.ilike.*${safe}*`);
    clauses.push(`category.ilike.*${safe}*`);
    clauses.push(`name.ilike.*${safe}*`);
  }
  return clauses.length ? `or=${encodeURIComponent(`(${clauses.join(',')})`)}` : '';
}

function inferAustraliaCityFromText(text = '', fallback = '') {
  const body = cleanText(text, 2400).toLowerCase();
  const rules = [
    ['Melbourne', /墨尔本|melbourne|\bvic\b|victoria/],
    ['Sydney', /悉尼|雪梨|sydney|\bnsw\b|new south wales/],
    ['Brisbane', /布里斯班|brisbane|\bqld\b|queensland/],
    ['Perth', /珀斯|perth|\bwa\b|western australia/],
    ['Adelaide', /阿德莱德|adelaide|\bsa\b|south australia/],
    ['Canberra', /堪培拉|canberra|\bact\b/],
    ['Gold Coast', /黄金海岸|gold coast/],
    ['Hobart', /霍巴特|hobart|tasmania|\btas\b/],
    ['Darwin', /达尔文|darwin|northern territory|\bnt\b/]
  ];
  const found = rules.find(([, rx]) => rx.test(body));
  return found ? found[0] : cleanText(fallback, 80);
}

function hasConflictingCity(expected = '', inferred = '') {
  const a = cleanText(expected, 80).toLowerCase();
  const b = cleanText(inferred, 80).toLowerCase();
  return Boolean(a && b && a !== b);
}

function textMentionsOtherCity(expected = '', text = '') {
  const target = cleanText(expected, 80).toLowerCase();
  if (!target) return false;
  const body = cleanText(text, 2400).toLowerCase();
  const cityRules = [
    ['melbourne', /墨尔本|melbourne|\bvic\b|victoria/],
    ['sydney', /悉尼|雪梨|sydney|\bnsw\b|new south wales/],
    ['brisbane', /布里斯班|brisbane|\bqld\b|queensland/],
    ['perth', /珀斯|perth|\bwa\b|western australia/],
    ['adelaide', /阿德莱德|adelaide|\bsa\b|south australia/],
    ['canberra', /堪培拉|canberra|\bact\b/],
    ['gold coast', /黄金海岸|gold coast/],
    ['hobart', /霍巴特|hobart|tasmania|\btas\b/],
    ['darwin', /达尔文|darwin|northern territory|\bnt\b/]
  ];
  return cityRules.some(([city, rx]) => city !== target && rx.test(body));
}

function supplyMatchScore(item = {}, parsed = {}) {
  const fields = item.fields && typeof item.fields === 'object' ? item.fields : {};
  const vehicleTypes = Array.isArray(fields.vehicle_types) ? fields.vehicle_types.join(' ') : String(fields.vehicle_types || fields.vehicle_type || '');
  const businessModel = String(fields.business_model || fields.provider_model || fields.supply_model || '').toLowerCase();
  const text = `${item.name || ''} ${item.service_type || ''} ${item.service_area || ''} ${item.availability || ''} ${item.website || ''} ${fields.source_text || ''} ${vehicleTypes} ${fields.availability || ''} ${fields.service_area || ''} ${fields.pickup_range || ''} ${businessModel}`.toLowerCase();
  let score = Number(item.completeness_score || 0);
  const distanceScore = Number(item.match_scores?.distance_score || 0);
  const serviceRangeScore = Number(item.match_scores?.service_range_score || 0);
  const availabilityScore = Number(item.match_scores?.availability_score || 0);
  const trustScore = Number(item.match_scores?.trust_score || fields.trust_score || fields.reputation_score || 0);
  const replyScore = Number(item.match_scores?.reply_score || 0);
  const huabanScore = Number(item.match_scores?.huaban_score || 0);
  if (item.phone || item.email || item.display_contact) score += 40;
  if (parsed.city && String(item.city || '').toLowerCase().includes(parsed.city.toLowerCase())) score += 160;
  if (/airport|shuttle|taxi|transfer|pickup|接送机|接机|送机|包车|司机/.test(text)) score += 80;
  if (parsed.vehicle_type && text.includes(String(parsed.vehicle_type).toLowerCase())) score += 120;
  if (parsed.prefer_direct_driver && /driver_owner|owner_driver|self_operated|individual|私人|个人|自营|车主/.test(text)) score += 180;
  if (parsed.prefer_direct_driver && /platform|uber|didi|滴滴|平台|派单/.test(text)) score -= 140;
  if (/dangyiwang|meltoday|yeeyi|今日墨尔本|今日珀斯|亿忆/.test(text)) score -= 90;
  return score + distanceScore + serviceRangeScore + availabilityScore + trustScore + replyScore + huabanScore;
}

function isProductPurchaseIntent(parsed = {}) {
  return isProductCategoryCode(parsed.service_type_code) || /哪里.*(买|卖|有)|哪.*(买|卖|有)|买到|买|购买|采购|商店|店铺|供应商|批发/.test(parsed.rawText || '');
}

function rowConflictsWithProductPurchase(item = {}, parsed = {}) {
  if (!isProductPurchaseIntent(parsed)) return false;
  const fields = item.fields && typeof item.fields === 'object' ? item.fields : {};
  const text = `${item.name || ''} ${item.service_type || ''} ${item.category || ''} ${item.website || ''} ${fields.source_text || ''} ${fields.capability_text || ''}`.toLowerCase();
  if (!/repair|repairs|service|services|installation|install|maintenance|维修|修理|安装|保养|搬家|搬运|物流/.test(text)) return false;
  return !/shop|store|wholesale|supplier|supplies|market|supermarket|retail|超市|商店|门店|批发|供应商|销售|经销/.test(text);
}

function rowHasCityConflict(item = {}, parsed = {}) {
  if (!parsed.city) return false;
  const fields = item.fields && typeof item.fields === 'object' ? item.fields : {};
  const text = `${item.name || ''} ${item.website || ''} ${item.public_verification_url || ''} ${fields.source_text || ''} ${fields.snippet || ''}`;
  if (textMentionsOtherCity(parsed.city, text)) return true;
  const inferred = fields.inferred_city || inferAustraliaCityFromText(text, '');
  return hasConflictingCity(parsed.city, inferred);
}

function numericCoord(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = deg => deg * Math.PI / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function supplierCoords(item = {}) {
  const fields = item.fields && typeof item.fields === 'object' ? item.fields : {};
  const lat = numericCoord(fields.location_lat || fields.lat || fields.latitude || fields.geo_lat || item.location_lat || item.lat || item.latitude || item.geo_lat);
  const lng = numericCoord(fields.location_lng || fields.lng || fields.longitude || fields.geo_lng || item.location_lng || item.lng || item.longitude || item.geo_lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function distanceLabel(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)}米`;
  if (km < 10) return `${km.toFixed(1)}公里`;
  return `${Math.round(km)}公里`;
}

function enrichDistance(item = {}, parsed = {}) {
  const fields = item.fields && typeof item.fields === 'object' ? item.fields : {};
  const userLat = numericCoord(parsed.location_lat);
  const userLng = numericCoord(parsed.location_lng);
  const address = cleanAddress(item.normalized_address || fields.normalized_address || fields.address || item.service_area || fields.service_area || fields.pickup_range || '', 220);
  const defaultRadius = defaultRadiusKm(parsed.service_type_code);
  const serviceRadius = numericCoord(fields.service_radius_km || fields.radius_km || fields.willing_radius_km || fields.pickup_radius_km) || defaultRadius;
  const matchScores = matchQualityScores(item, parsed, null, serviceRadius);
  if (userLat === null || userLng === null) {
    return { ...item, service_address: address, service_radius_km: serviceRadius, match_scores: matchScores, distance_km: null, distance_text: address ? `同城，地址：${address}` : '同城' };
  }
  const coords = supplierCoords(item);
  if (!coords) {
    return { ...item, service_address: address, service_radius_km: serviceRadius, match_scores: matchScores, distance_km: null, distance_text: address ? `同城，地址：${address}，距离待补坐标` : '同城，距离待补坐标' };
  }
  const km = haversineKm(userLat, userLng, coords.lat, coords.lng);
  const scored = matchQualityScores(item, parsed, km, serviceRadius);
  return {
    ...item,
    service_address: address,
    service_radius_km: serviceRadius,
    distance_km: Number(km.toFixed(3)),
    distance_text: `约${distanceLabel(km)}`,
    match_scores: scored,
    match_score: supplyMatchScore({ ...item, distance_km: km, match_scores: scored }, parsed),
    distance_outlier: km > Math.max(120, serviceRadius * 2)
  };
}

function defaultRadiusKm(serviceTypeCode = '') {
  const map = {
    gardening: 5,
    plumber: 10,
    electrician: 10,
    cleaning: 10,
    moving: 20,
    auto: 15,
    car_rental: 30,
    tutor: 20,
    local_ride: 80,
    airport_pickup: 80,
    wedding: 120,
    travel: 250,
    lawyer: 999,
    accounting: 999,
    immigration: 999,
    web_dev: 20000
  };
  return map[serviceTypeCode] || 30;
}

function chatDepthLevel(text = '') {
  const body = cleanText(text, 1400);
  let signals = 0;
  if (body.length > 18) signals += 1;
  if (body.length > 45) signals += 1;
  if (/今天|明天|周末|上午|下午|晚上|凌晨|[0-9]{1,2}点/.test(body)) signals += 1;
  if (/预算|价格|\$|aud|澳币|报价/.test(body)) signals += 1;
  if (/区|路|街|glen|box hill|clayton|机场|airport/i.test(body)) signals += 1;
  if (/5座|7座|商务车|suv|行李|箱|van/i.test(body)) signals += 1;
  if (/中文|华人|个人|车主|自营|不要平台|不派单/.test(body)) signals += 1;
  if (signals >= 5) return 'high';
  if (signals >= 2) return 'medium';
  return 'low';
}

function matchQualityScores(item = {}, parsed = {}, distanceKm = null, serviceRadiusKm = 30) {
  const fields = item.fields && typeof item.fields === 'object' ? item.fields : {};
  const distance = Number.isFinite(distanceKm) ? distanceKm : null;
  const radius = Number(serviceRadiusKm || defaultRadiusKm(parsed.service_type_code));
  const responseMinutes = Number(fields.response_minutes || fields.response_speed_minutes || fields.avg_response_minutes || 0);
  const trustRaw = Number(fields.trust_score || fields.user_feedback_score || fields.source_confidence || 0);
  const availableText = `${item.availability || ''} ${fields.availability || ''} ${fields.availability_tags || ''}`.toLowerCase();
  const isHuaban = Boolean(item.is_huaban_user || fields.huaban_user || item.claimed_by_code || item.supplier_code);
  return {
    distance_score: distance === null ? 20 : Math.max(-80, Math.round(120 - Math.min(distance, 80) * 2)),
    service_range_score: distance === null ? 15 : (distance <= radius ? 90 : Math.max(-120, Math.round(40 - (distance - radius) * 4))),
    availability_score: /today|now|24|全天|今天|现在|可接|available/.test(availableText) ? 60 : 0,
    trust_score: Math.min(100, Math.max(0, Math.round(trustRaw))),
    reply_score: responseMinutes > 0 ? Math.max(0, 70 - Math.min(responseMinutes, 70)) : 0,
    huaban_score: isHuaban ? 80 : 0,
    radius_km: radius
  };
}

function vehicleTypeFromText(text = '') {
  const body = String(text || '').toLowerCase();
  const rules = [
    ['8座/商务车', /8\s*(座|seater|seat)|八座|商务车|minibus|van/],
    ['7座', /7\s*(座|seater|seat)|七座|people mover|mpv/],
    ['5座', /5\s*(座|seater|seat)|五座|sedan|轿车/],
    ['SUV', /suv|越野|四驱/],
    ['豪华车', /luxury|chauffeur|豪华|奔驰|宝马|奥迪/]
  ];
  const found = rules.find(([, rx]) => rx.test(body));
  return found ? found[0] : '';
}

function cityFromText(text = '', inputCity = '') {
  const body = `${inputCity} ${text}`.toLowerCase();
  const cities = [
    ['Melbourne', /墨尔本|melbourne/],
    ['Sydney', /悉尼|sydney/],
    ['Brisbane', /布里斯班|brisbane/],
    ['Perth', /珀斯|perth/],
    ['Adelaide', /阿德莱德|adelaide/],
    ['Canberra', /堪培拉|canberra/],
    ['Auckland', /奥克兰|auckland/],
    ['Toronto', /多伦多|toronto/],
    ['Vancouver', /温哥华|vancouver/],
    ['Los Angeles', /洛杉矶|los angeles|la\b/],
    ['New York', /纽约|new york/]
  ];
  const found = cities.find(([, rx]) => rx.test(body));
  return found ? found[0] : cleanText(inputCity, 80);
}

function parseDemand(body = {}) {
  const rawText = cleanText(body.text || body.raw_text || '', 1400);
  const needType = cleanText(body.need_type || 'local_service', 80);
  const explicitServiceCode = cleanText(body.service_type_code || '', 80);
  const isEmergency = needType === 'emergency_help';
  const isSchedule = needType === 'schedule_event';
  const isAppointmentChange = needType === 'appointment_change';
  const service = explicitServiceCode === 'emergency_help'
    ? { code: 'emergency_help', label: '紧急互助' }
    : explicitServiceCode === 'schedule_event'
      ? { code: 'schedule_event', label: '日程预约' }
    : explicitServiceCode === 'appointment_change'
      ? { code: 'appointment_change', label: '预约变更' }
      : explicitServiceCode
        ? { code: explicitServiceCode, label: cleanText(body.service_type || serviceFromText(rawText).label, 80) }
        : serviceFromText(`${rawText} ${body.service_type || ''}`);
  const city = cityFromText(rawText, body.city || body.location_city || '');
  const locationLat = cleanText(body.location_lat || '', 40);
  const locationLng = cleanText(body.location_lng || '', 40);
  const vehicleType = cleanText(body.vehicle_type || vehicleTypeFromText(`${rawText} ${body.service_type || ''}`), 80);
  const budget = cleanText(body.budget_text || '', 120) || (rawText.match(/(?:\$|aud|澳币|预算|价格|报价)[^，。,.!！?？]{0,30}/i)?.[0] || '');
  const timeText = cleanText(body.time_text || '', 160) || (rawText.match(/(?:今天|明天|周末|下周|上午|下午|晚上|[0-9]{1,2}点)[^，。,.!！?？]{0,30}/)?.[0] || '');
  const wantsDirectContact = /直接|马上|现在|先找|找联系方式|给电话|电话|联系|自己联系|我自己/.test(rawText);
  const preferDirectDriver = /个人车主|车主|自营|私人司机|华人司机|driver owner|owner driver|不要平台|不走平台|不派单|直接对接/i.test(rawText);
  const chatDepth = chatDepthLevel(rawText);
  const isProductLookup = isProductCategoryCode(service.code) || /哪里.*(买|卖|有)|哪.*(买|卖|有)|买到|买|购买|采购|商店|店|供应商/.test(rawText);
  const missing = [];
  if (!city && !body.area && !body.location_address && !isSchedule && !isAppointmentChange) missing.push(isEmergency ? '位置或可到达区域' : '城市或区域');
  if (!isEmergency && !isProductLookup && !timeText && !isAppointmentChange && !wantsDirectContact) missing.push(isSchedule ? '日程时间' : '时间');
  const summaryParts = [
    city ? `城市：${city}` : '',
    `需求：${service.label}`,
    timeText ? `时间：${timeText}` : '',
    budget ? `预算：${budget}` : ''
  ].filter(Boolean);
  return {
    rawText,
    service_type: cleanText(body.service_type || service.label, 80),
    service_type_code: canonicalServiceCode(body.service_type_code || service.code, body.service_type || service.label),
    city,
    location_lat: locationLat,
    location_lng: locationLng,
    country: cleanText(body.country || '', 80),
    area: cleanText(body.area || body.location_address || '', 180),
    time_text: cleanText(timeText, 160),
    budget_text: cleanText(budget, 120),
    vehicle_type: vehicleType,
    prefer_direct_driver: preferDirectDriver,
    chat_depth: chatDepth,
    urgency: cleanText(body.urgency || (/急|马上|现在|asap|urgent|求助|危险|事故/i.test(rawText) ? 'urgent' : 'normal'), 40),
    summary: cleanText(body.summary || (isEmergency ? `紧急互助：${rawText}` : isSchedule ? `日程预约：${rawText}` : isAppointmentChange ? `预约变化：${rawText}` : summaryParts.join(' · ')) || rawText, 300),
    missing_fields: missing
  };
}

const AUSTRALIA_RADAR_CITIES = new Set(['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide', 'Canberra']);

function shortTrace(value = '', max = 10) {
  const text = cleanText(value, 120);
  return text ? text.slice(0, max) : '';
}

function demandSourceTrace(body = {}) {
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  return {
    visitor_id: cleanText(body.visitor_id || metadata.visitor_id || body.client_id || '', 120),
    session_id: cleanText(body.session_id || metadata.session_id || '', 120),
    device_type: cleanText(body.device_type || metadata.device_type || '', 40),
    browser: cleanText(body.browser || metadata.browser || '', 80),
    page_path: cleanText(body.page_path || metadata.page_path || '', 160),
    source_channel: cleanText(body.source_channel || metadata.source_channel || 'ai_chat', 80),
    source_url: cleanText(body.source_url || metadata.source_url || '', 420)
  };
}

function demandRadarNeeded(parsed = {}, matchCount = 0) {
  if (!parsed.rawText || !parsed.service_type_code) return false;
  if (['emergency_help', 'schedule_event', 'appointment_change'].includes(parsed.service_type_code)) return false;
  if (!parsed.city || !AUSTRALIA_RADAR_CITIES.has(parsed.city)) return false;
  return Number(matchCount || 0) < Number(process.env.DEMAND_RADAR_MATCH_THRESHOLD || 4);
}

function demandRadarQueries(parsed = {}) {
  const city = parsed.city || 'Melbourne';
  const service = parsed.service_type || '本地服务';
  const code = parsed.service_type_code || 'local_service';
  const raw = parsed.rawText || '';
  const zh = `${city} 华人 ${service} 电话 联系方式`;
  const en = `${city} ${service} Chinese service phone contact`;
  const direct = cleanText(`${city} ${raw} phone contact`, 260);
  const product = isProductPurchaseIntent(parsed)
    ? `${city} ${service} store shop phone contact`
    : '';
  return Array.from(new Set([zh, en, direct, product].filter(Boolean))).map((query, index) => ({
    task_date: new Date().toISOString().slice(0, 10),
    country: 'Australia',
    state: '',
    city,
    language_lane: /[\u4e00-\u9fff]/.test(query) ? 'zh' : 'en',
    category_code: code,
    category_name: service,
    search_query: cleanText(query, 260),
    source_name: 'demand_supply_gap_radar',
    source_url: '',
    status: 'queued',
    priority: index + 1
  })).slice(0, 4);
}

async function enqueueDemandRadarTasks(demand = {}, parsed = {}, matchCount = 0, sourceTrace = {}) {
  if (!demandRadarNeeded(parsed, matchCount)) {
    return { queued: 0, skipped: true, reason: '供给匹配已足够或不在澳洲雷达范围' };
  }
  const tasks = demandRadarQueries(parsed);
  const existing = await supa([
    'huaban_supply_collection_tasks?',
    `tenant_id=eq.${encodeURIComponent(TENANT_ID)}`,
    `city=eq.${encodeURIComponent(parsed.city)}`,
    `category_code=eq.${encodeURIComponent(parsed.service_type_code)}`,
    'select=id,search_query,language_lane,status,fields',
    'limit=80'
  ].join('&')).catch(() => []);
  const existingKeys = new Set((Array.isArray(existing) ? existing : []).map(row => `${row.language_lane}:${row.search_query}`.toLowerCase()));
  const toCreate = tasks.filter(task => !existingKeys.has(`${task.language_lane}:${task.search_query}`.toLowerCase()));
  if (!toCreate.length) return { queued: 0, skipped: true, reason: '雷达任务已存在' };
  const payload = toCreate.map(task => ({
    tenant_id: TENANT_ID,
    ...task,
    fields: {
      auto_from_demand: true,
      demand_id: demand.id || '',
      demand_summary: parsed.summary || parsed.rawText || '',
      raw_text: parsed.rawText || '',
      supply_match_count: Number(matchCount || 0),
      visitor_id: sourceTrace.visitor_id || '',
      session_id: sourceTrace.session_id || '',
      device_type: sourceTrace.device_type || '',
      browser: sourceTrace.browser || '',
      page_path: sourceTrace.page_path || '',
      automation_rule: 'demand_supply_gap_to_radar'
    }
  }));
  const rows = await supa('huaban_supply_collection_tasks', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return {
    queued: Array.isArray(rows) ? rows.length : payload.length,
    skipped: false,
    task_ids: (Array.isArray(rows) ? rows : []).map(row => row.id).filter(Boolean)
  };
}

async function findSupplyMatches(parsed) {
  if (!parsed.service_type_code) return [];
  const codes = supplyServiceCodeAliases(parsed.service_type_code);
  const codeParam = codes.map(item => encodeURIComponent(item)).join(',');
  const usableStatus = 'status=in.(candidate,active,verified,unknown,pending_review,phone_pending_claim)';
  const rows = await supa([
    'huaban_supply_profiles?',
    `tenant_id=eq.${encodeURIComponent(TENANT_ID)}`,
    `service_type_code=in.(${codeParam})`,
    usableStatus,
    'select=id,name,contact,city,country,service_type,service_type_code,category,service_area,availability,status,completeness_score,normalized_contact,claimed_phone,claimed_by_code,supplier_code,website,public_verification_url,fields',
    'order=completeness_score.desc',
    'limit=60'
  ].join('&')).catch(() => []);
  let fallbackRows = [];
  if ((!Array.isArray(rows) || !rows.length) && ['local_ride', 'airport_pickup'].includes(parsed.service_type_code)) {
    fallbackRows = await supa([
      'huaban_supply_profiles?',
      `tenant_id=eq.${encodeURIComponent(TENANT_ID)}`,
      'or=(service_type.ilike.*airport*,service_type.ilike.*接送机*,category.ilike.*airport*,category.ilike.*接送机*)',
      usableStatus,
      'select=id,name,contact,city,country,service_type,service_type_code,category,service_area,availability,status,completeness_score,normalized_contact,claimed_phone,claimed_by_code,supplier_code,website,public_verification_url,fields',
      'order=completeness_score.desc',
      'limit=60'
    ].join('&')).catch(() => []);
  }
  const keywordOr = supplyKeywordOrParam(supplyKeywordFallback(parsed));
  const keywordRows = keywordOr
    ? await supa([
      'huaban_supply_profiles?',
      `tenant_id=eq.${encodeURIComponent(TENANT_ID)}`,
      keywordOr,
      usableStatus,
      'select=id,name,contact,city,country,service_type,service_type_code,category,service_area,availability,status,completeness_score,normalized_contact,claimed_phone,claimed_by_code,supplier_code,website,public_verification_url,fields',
      'order=completeness_score.desc',
      'limit=60'
    ].join('&')).catch(() => [])
    : [];
  const seenIds = new Set();
  const mergedRows = [...(Array.isArray(rows) ? rows : []), ...(Array.isArray(fallbackRows) ? fallbackRows : []), ...(Array.isArray(keywordRows) ? keywordRows : [])]
    .filter(item => {
      const key = item.id || `${item.name}:${item.contact}:${item.normalized_contact}`;
      if (seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    });
  const list = mergedRows.map(item => {
    const fields = item.fields && typeof item.fields === 'object' ? item.fields : {};
    const phone = cleanPhone(item.normalized_contact || item.claimed_phone || fields.normalized_phone || fields.phone || item.contact || '');
    const email = cleanText(fields.email || item.email || '', 160);
    return {
      ...item,
      phone,
      email,
      display_contact: phone || email || ''
    };
  }).filter(item => (item.phone || item.email) && !rowHasCityConflict(item, parsed) && !rowConflictsWithProductPurchase(item, parsed));
  const sameCityList = parsed.city
    ? list.filter(item => String(item.city || '').toLowerCase().includes(parsed.city.toLowerCase()))
    : list;
  const enriched = sameCityList
    .map(item => enrichDistance(item, parsed))
    .filter(item => item.distance_outlier !== true);
  const ranked = enriched.sort((a, b) => {
    const sa = Number.isFinite(a.match_score) ? a.match_score : supplyMatchScore(a, parsed);
    const sb = Number.isFinite(b.match_score) ? b.match_score : supplyMatchScore(b, parsed);
    if (sa !== sb) return sb - sa;
    const da = Number.isFinite(a.distance_km) ? a.distance_km : 999999;
    const db = Number.isFinite(b.distance_km) ? b.distance_km : 999999;
    return da - db;
  });
  if (!parsed.city) return ranked.slice(0, 6);
  const cityLower = parsed.city.toLowerCase();
  const exact = ranked.filter(item => String(item.city || '').toLowerCase().includes(cityLower));
  return exact.slice(0, 6);
}

async function annotateHuabanSupplyUsers(matches = []) {
  const phoneSet = new Set();
  matches.forEach(item => {
    phoneVariants(item.phone || item.normalized_contact || item.claimed_phone || item.display_contact || item.contact || '')
      .forEach(phone => phoneSet.add(phone));
  });
  const phones = Array.from(phoneSet);
  if (!phones.length) return matches;
  const phoneParam = supaIn(phones);
  const accounts = await supa([
    'huaban_accounts?',
    `tenant_id=eq.${encodeURIComponent(TENANT_ID)}`,
    `normalized_phone=in.(${phoneParam})`,
    'status=eq.active',
    'select=account_uid,friend_code,display_name,normalized_phone,primary_phone'
  ].join('&')).catch(() => []);
  const links = await supa([
    'huaban_identity_links?',
    `tenant_id=eq.${encodeURIComponent(TENANT_ID)}`,
    `normalized_phone=in.(${phoneParam})`,
    'status=eq.active',
    'select=friend_code,display_name,normalized_phone,phone,link_type,fields'
  ].join('&')).catch(() => []);
  const accountByPhone = new Map();
  (Array.isArray(accounts) ? accounts : []).forEach(row => {
    phoneVariants(row.normalized_phone || row.primary_phone).forEach(phone => accountByPhone.set(phone, row));
  });
  const linkByPhone = new Map();
  (Array.isArray(links) ? links : []).forEach(row => {
    const verified = row.link_type === 'verified_account_phone' || row.fields?.phone_verified === true;
    if (!verified && !row.friend_code) return;
    phoneVariants(row.normalized_phone || row.phone).forEach(phone => linkByPhone.set(phone, row));
  });
  return matches.map(item => {
    const variants = phoneVariants(item.phone || item.normalized_contact || item.claimed_phone || item.display_contact || item.contact || '');
    const account = variants.map(phone => accountByPhone.get(phone)).find(Boolean);
    const link = variants.map(phone => linkByPhone.get(phone)).find(Boolean);
    const fields = item.fields && typeof item.fields === 'object' ? item.fields : {};
    const friendCode = item.claimed_by_code || item.supplier_code || account?.friend_code || link?.friend_code || fields.claimed_by_code || fields.supplier_code || '';
    const isHuabanUser = Boolean(account?.account_uid || friendCode);
    return {
      ...item,
      is_huaban_user: isHuabanUser,
      contact_channel: isHuabanUser ? 'huaban_app' : 'public_phone',
      huaban_account_uid: account?.account_uid || '',
      huaban_friend_code: friendCode,
      huaban_display_name: account?.display_name || link?.display_name || ''
    };
  });
}

function buildPublicContactQuery(parsed = {}) {
  const city = parsed.city || 'Melbourne';
  if (['local_ride', 'airport_pickup'].includes(parsed.service_type_code)) {
    return `${city} 华人 机场接送 airport transfer ${parsed.rawText || ''} phone`;
  }
  if (isProductPurchaseIntent(parsed)) {
    const terms = productSearchTermsForCode(parsed.service_type_code) || parsed.service_type || parsed.rawText || 'store';
    return `${city} ${terms} ${parsed.rawText || ''} phone contact`;
  }
  return `${city} ${parsed.service_type || 'local service'} 华人 服务 电话 phone ${parsed.rawText || ''}`;
}

async function braveSearch(query, count = 8) {
  const key = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || '';
  if (!key) return null;
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    country: 'AU',
    search_lang: /[\u4e00-\u9fff]/.test(query) ? 'zh-hans' : 'en'
  });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key }
  });
  if (!res.ok) throw new Error(`Brave Search ${res.status}`);
  const json = await res.json();
  return (json.web?.results || []).map(item => normalizeSearchResult(item, 'brave'));
}

async function serpApiSearch(query, count = 8) {
  const key = process.env.SERPAPI_KEY || process.env.SERP_API_KEY || '';
  if (!key) return null;
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: key,
    num: String(count),
    gl: 'au',
    hl: /[\u4e00-\u9fff]/.test(query) ? 'zh-cn' : 'en'
  });
  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
  const json = await res.json();
  return (json.organic_results || []).map(item => normalizeSearchResult(item, 'serpapi'));
}

async function bingSearch(query, count = 8) {
  const key = process.env.BING_SEARCH_API_KEY || process.env.AZURE_BING_SEARCH_KEY || '';
  if (!key) return null;
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    mkt: /[\u4e00-\u9fff]/.test(query) ? 'zh-CN' : 'en-AU'
  });
  const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params.toString()}`, {
    headers: { 'Ocp-Apim-Subscription-Key': key }
  });
  if (!res.ok) throw new Error(`Bing Search ${res.status}`);
  const json = await res.json();
  return (json.webPages?.value || []).map(item => normalizeSearchResult(item, 'bing'));
}

async function publicContactSearch(parsed = {}) {
  const query = buildPublicContactQuery(parsed);
  const providers = [braveSearch, serpApiSearch, bingSearch];
  const errors = [];
  let results = [];
  let providerName = 'none';
  for (const provider of providers) {
    try {
      const rows = await provider(query, 8);
      if (Array.isArray(rows)) {
        results = rows;
        providerName = rows[0]?.provider || provider.name.replace('Search', '').toLowerCase();
        break;
      }
    } catch (error) {
      errors.push(`${provider.name}: ${error.message}`);
    }
  }
  if (!results.length) {
    if (errors.length) console.warn('public contact search failed', errors.join('；'));
    return [];
  }
  const matches = [];
  for (const row of results) {
    const text = `${row.title} ${row.snippet} ${row.url}`;
    const inferredCity = inferAustraliaCityFromText(text, parsed.city || '');
    if (textMentionsOtherCity(parsed.city, text)) continue;
    if (hasConflictingCity(parsed.city, inferredCity)) continue;
    const phone = extractPhones(text)[0] || '';
    const email = extractEmails(text)[0] || '';
    if (!phone && !email) continue;
    matches.push({
      id: `public-${crypto.createHash('sha1').update(`${row.url}:${phone}:${email}`).digest('hex').slice(0, 12)}`,
      name: row.title || urlHost(row.url) || parsed.service_type || '公开搜索结果',
      contact: phone || email,
      city: inferredCity || parsed.city || '',
      country: parsed.country || 'Australia',
      service_type: parsed.service_type,
      service_type_code: parsed.service_type_code,
      status: 'public_search',
      completeness_score: 30,
      normalized_contact: phone,
      claimed_phone: '',
      website: row.url,
      public_verification_url: row.url,
      fields: {
        provider: row.provider || providerName,
        source: 'public_contact_search',
        snippet: row.snippet,
        search_query: query,
        inferred_city: inferredCity
      },
      phone,
      email,
      display_contact: phone || email
    });
  }
  const seen = new Set();
  return matches.filter(item => {
    const key = item.phone || item.email || item.website;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(item => enrichDistance(item, parsed)).slice(0, 4);
}

async function savePublicMatchesToSupplyProfiles(matches = [], parsed = {}) {
  const saved = [];
  for (const item of matches) {
    const phone = cleanPhone(item.phone || item.normalized_contact || item.display_contact || '');
    const email = cleanText(item.email || '', 160);
    if (!phone && !email) continue;
    const existing = phone
      ? await supa(`huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&or=(normalized_contact.eq.${encodeURIComponent(phone)},contact.eq.${encodeURIComponent(phone)})&limit=1&select=id,fields`).catch(() => [])
      : [];
    if (Array.isArray(existing) && existing.length) {
      const current = existing[0];
      const currentFields = current.fields && typeof current.fields === 'object' ? current.fields : {};
      await supa(`huaban_supply_profiles?id=eq.${encodeURIComponent(current.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'active',
          verification_status: 'public_contact_used',
          fields: {
            ...currentFields,
            used_by_ai_demand: true,
            last_used_at: new Date().toISOString(),
            can_match_immediately: true,
            correction_allowed: true
          }
        })
      }).catch(error => console.warn('upgrade public match failed', error.message));
      item.id = current.id;
      item.status = 'active';
      continue;
    }
    const profile = {
      tenant_id: TENANT_ID,
      source_mode: 'public_search_used',
      source_channel: 'ai_demand_contact_search',
      name: cleanText(item.name || parsed.service_type || '公开搜索服务者', 120),
      contact: phone || email,
      normalized_contact: phone,
      city: cleanText(item.city || parsed.city || '', 80),
      country: cleanText(item.country || parsed.country || 'Australia', 80),
      service_type: cleanText(item.service_type || parsed.service_type || '', 120),
      service_type_code: cleanText(item.service_type_code || parsed.service_type_code || '', 80),
      website: cleanText(item.website || item.public_verification_url || '', 420),
      public_verification_url: cleanText(item.public_verification_url || item.website || '', 420),
      verification_status: 'public_contact_used',
      status: 'active',
      completeness_score: phone ? 58 : 46,
      fields: {
        ...(item.fields || {}),
        email,
        phone,
        normalized_phone: phone,
        used_by_ai_demand: true,
        first_used_at: new Date().toISOString(),
        demand_summary: parsed.summary || parsed.rawText || '',
        can_match_immediately: true,
        correction_allowed: true,
        storage_reason: '用户需求触发后展示为可联系号码，直接进入华伴供给库；后台可后续纠错、合并或下架。'
      }
    };
    const rows = await supa('huaban_supply_profiles', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(profile)
    }).catch(error => {
      console.warn('save public match failed', error.message);
      return null;
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row?.id) {
      item.id = row.id;
      item.status = row.status || item.status;
      saved.push(row);
    }
  }
  return saved;
}

function inviteUrl(demandId, parsed, requesterCode, sourceRef) {
  const params = new URLSearchParams();
  params.set('intent', 'supply_invite');
  params.set('demand', demandId);
  if (requesterCode || sourceRef) params.set('ref', requesterCode || sourceRef);
  if (parsed.service_type_code) params.set('service', parsed.service_type_code);
  if (parsed.city) params.set('city', parsed.city);
  return `${PUBLIC_ORIGIN}/ai.html?${params.toString()}`;
}

async function createCollaborationTask(demand, parsed, requesterCode, sourceRef) {
  const url = inviteUrl(demand.id, parsed, requesterCode, sourceRef);
  const isEmergency = parsed.service_type_code === 'emergency_help' || parsed.urgency === 'urgent';
  const demandLocation = demand?.fields?.location || {};
  const payload = {
    tenant_id: TENANT_ID,
    demand_id: demand.id,
    task_type: isEmergency ? 'emergency_help_request' : 'supply_lead_request',
    title: isEmergency
      ? `紧急互助：${parsed.city || parsed.area || '待定位'}`
      : `寻找${parsed.city ? parsed.city + ' ' : ''}${parsed.service_type || '本地服务'}线索`,
    description: isEmergency
      ? '紧急求助允许多名帮助者响应。后台需按范围、可用时间、可信度和人工确认优先处理。'
      : '当前供给库暂时没有足够匹配。可以邀请真实服务者入驻，或提交可靠线索，审核通过后记录待确认贡献。',
    city: parsed.city,
    country: parsed.country,
    service_type: parsed.service_type,
    service_type_code: parsed.service_type_code,
    requester_code: requesterCode,
    source_ref: sourceRef,
    suggested_reward_points: isEmergency ? 0 : 20,
    invite_url: url,
    status: 'open',
    fields: {
      missing_fields: parsed.missing_fields,
      priority: isEmergency ? 'high' : 'normal',
      app_critical_alert_required: isEmergency,
      alert_channel: isEmergency ? 'native_app_push' : 'normal',
      notification_priority: isEmergency ? 'critical' : 'normal',
      helper_match_mode: isEmergency ? 'multi_helper_within_range' : 'single_or_manual_match',
      app_delivery_required: isEmergency,
      location: isEmergency ? {
        address: demandLocation.address || '',
        city: demandLocation.city || parsed.city || '',
        lat: demandLocation.lat || '',
        lng: demandLocation.lng || '',
        accuracy: demandLocation.accuracy || '',
        map_url: demandLocation.map_url || ''
      } : null
    }
  };
  const rows = await supa('huaban_collaboration_tasks', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function createDemand(req, res) {
  const body = req.body || {};
  const parsed = parseDemand(body);
  const sourceTrace = demandSourceTrace(body);
  if (!parsed.rawText) return res.status(400).json({ error: '请先说出一个真实需求' });
  const {
    rawText,
    vehicle_type: vehicleType,
    location_lat: locationLat,
    location_lng: locationLng,
    prefer_direct_driver: preferDirectDriver,
    chat_depth: chatDepth,
    ...parsedColumns
  } = parsed;
  const requesterCode = cleanCode(body.requester_code || body.friendCode || body.identity_code);
  const sourceRef = cleanCode(body.source_ref || body.ref || '');
  const isOperationalRecord = ['schedule_event', 'appointment_change'].includes(parsed.service_type_code);
  const internalMatches = isOperationalRecord ? [] : await findSupplyMatches(parsed);
  const publicMatches = (!isOperationalRecord && internalMatches.length < 1)
    ? await publicContactSearch(parsed).catch(error => {
      console.warn('public contact fallback error', error.message);
      return [];
    })
    : [];
  if (publicMatches.length) await savePublicMatchesToSupplyProfiles(publicMatches, parsed).catch(error => {
    console.warn('save public matches fallback error', error.message);
  });
  const seenContacts = new Set();
  const rawMatches = [...internalMatches, ...publicMatches].filter(item => {
    const key = item.phone || item.email || item.display_contact || item.website || item.id;
    if (!key || seenContacts.has(key)) return false;
    seenContacts.add(key);
    return true;
  }).slice(0, 6);
  const matches = await annotateHuabanSupplyUsers(rawMatches);
  const payload = {
    tenant_id: TENANT_ID,
    requester_code: requesterCode,
    requester_phone: cleanPhone(body.requester_phone || body.phone),
    source_ref: sourceRef,
    source_channel: cleanText(body.source_channel || 'ai_chat', 80),
    source_campaign: cleanText(body.source_campaign || '', 120),
    source_url: cleanText(body.source_url || '', 420),
    need_type: cleanText(body.need_type || 'local_service', 80),
    ...parsedColumns,
    raw_text: rawText,
    status: parsed.urgency === 'urgent' ? 'human_review' : (isOperationalRecord ? 'human_review' : (parsed.missing_fields.length ? 'need_info' : 'human_review')),
    supply_match_count: matches.length,
    fields: {
      original: body,
      source_trace: sourceTrace,
      vehicle_type: vehicleType,
      matching: {
        chat_depth: chatDepth,
        prefer_direct_driver: Boolean(preferDirectDriver),
        strategy: 'chat_depth_location_first',
        user_controlled_precision: true
      },
      priority: parsed.urgency === 'urgent' ? 'high' : cleanText(body.priority || 'normal', 40),
      app_critical_alert_required: parsed.urgency === 'urgent',
      alert_channel: parsed.urgency === 'urgent' ? 'native_app_push' : 'normal',
      notification_priority: parsed.urgency === 'urgent' ? cleanText(body.notification_priority || 'critical', 40) : 'normal',
      helper_match_mode: parsed.urgency === 'urgent' ? cleanText(body.helper_match_mode || 'multi_helper_within_range', 80) : 'single_or_manual_match',
      app_delivery_required: parsed.urgency === 'urgent' || Boolean(body.app_delivery_required),
      app_notification_contract: parsed.urgency === 'urgent' ? {
        target: 'range_matched_helpers',
        channel: 'native_app_push',
        sound: 'critical',
        vibration: true,
        requires_helper_opt_in: true,
        requires_device_token: true
      } : null,
      location: {
        address: cleanText(body.location_address || '', 260),
        city: cleanText(body.location_city || parsed.city || '', 80),
        lat: cleanText(body.location_lat || locationLat || '', 40),
        lng: cleanText(body.location_lng || locationLng || '', 40),
        accuracy: cleanText(body.location_accuracy || '', 40),
        map_url: cleanText(body.location_url || '', 420),
        source: cleanText(body.location_source || '', 80)
      },
      matched_supply_preview: matches.map(item => ({
        id: item.id,
        name: item.name,
        city: item.city,
        status: item.status,
        contact_channel: item.contact_channel || '',
        is_huaban_user: Boolean(item.is_huaban_user),
        distance_km: item.distance_km ?? null,
        service_radius_km: item.service_radius_km ?? null,
        match_score: Number.isFinite(item.match_score) ? Math.round(item.match_score) : supplyMatchScore(item, parsed),
        match_scores: item.match_scores || {},
        source: item.fields?.source || item.status || ''
      }))
    }
  };
  const rows = await supa('huaban_demand_cards', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const demand = Array.isArray(rows) ? rows[0] : rows;
  const point = requesterCode && !isOperationalRecord
    ? await handleLocalNeedSavedScenario({
        ownerCode: requesterCode,
        demandId: demand?.id || '',
        rawText,
        source: 'demand_cards',
        fields: {
          demand_id: demand?.id || '',
          service_type_code: parsed.service_type_code,
          service_type: parsed.service_type,
          city: parsed.city,
          supply_match_count: matches.length
        }
      })
    : null;
  const task = isOperationalRecord || matches.length ? null : await createCollaborationTask(demand, parsed, requesterCode, sourceRef);
  const radar = !isOperationalRecord
    ? await enqueueDemandRadarTasks(demand, parsed, matches.length, sourceTrace).catch(error => ({
        queued: 0,
        skipped: true,
        reason: error.message || '雷达任务写入失败'
      }))
    : { queued: 0, skipped: true, reason: '系统操作记录不进入供给雷达' };
  if (demand?.id) {
    const fields = demand.fields && typeof demand.fields === 'object' ? demand.fields : {};
    await supa(`huaban_demand_cards?id=eq.${encodeURIComponent(demand.id)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          ...fields,
          automation: {
            ...(fields.automation || {}),
            radar,
            radar_status: radar.queued ? 'queued' : 'skipped',
            updated_at: new Date().toISOString()
          }
        }
      })
    }).catch(error => console.warn('demand automation trace update skipped', error.message));
  }
  return res.status(200).json({
    ok: true,
    demand,
    points: { local_need_structured: point },
    supply_count: matches.length,
    supply_matches: matches,
    collaboration_task: task,
    radar_tasks: radar,
    supply_invite_url: task?.invite_url || '',
    missing_fields: parsed.missing_fields
  });
}

async function submitLead(req, res) {
  const body = req.body || {};
  const taskId = cleanText(body.task_id, 80);
  const demandId = cleanText(body.demand_id, 80);
  const candidateName = cleanText(body.candidate_name, 120);
  const candidateContact = cleanText(body.candidate_contact, 160);
  if (!taskId && !demandId) return res.status(400).json({ error: '缺少协作任务或需求编号' });
  if (!candidateName && !candidateContact) return res.status(400).json({ error: '请至少提供名称或联系方式' });
  const payload = {
    tenant_id: TENANT_ID,
    task_id: taskId || null,
    demand_id: demandId || null,
    submitter_code: cleanCode(body.submitter_code || body.friendCode),
    submitter_phone: cleanPhone(body.submitter_phone || body.phone),
    candidate_name: candidateName,
    candidate_contact: candidateContact,
    candidate_city: cleanText(body.candidate_city || body.city, 80),
    candidate_service_type: cleanText(body.candidate_service_type || body.service_type, 120),
    candidate_source_url: cleanText(body.candidate_source_url || body.source_url, 420),
    note: cleanText(body.note, 800),
    pending_points: 20,
    status: 'submitted',
    fields: { source: body.source || 'ai_collaboration' }
  };
  const rows = await supa('huaban_collaboration_submissions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return res.status(200).json({ ok: true, submission: Array.isArray(rows) ? rows[0] : rows });
}

async function registerEmergencyHelper(req, res) {
  const body = req.body || {};
  const name = cleanText(body.name || '华伴帮助者', 120);
  const contact = cleanText(body.contact || body.submitter_phone || '', 160);
  const city = cleanText(body.city || '', 80);
  const serviceArea = cleanText(body.service_area || body.range || '', 180);
  const specialSkills = cleanText(body.special_skills || body.skills || '', 300);
  const appAlertAuthorized = Boolean(body.app_alert_authorized || body.app_delivery_required);
  const legalAcknowledged = Boolean(body.legal_acknowledged);
  if (!serviceArea && !city) return res.status(400).json({ error: '请填写愿意帮助范围' });
  if (!contact) return res.status(400).json({ error: '请填写可联系的方式' });
  if (!legalAcknowledged) return res.status(400).json({ error: '请先阅读并同意紧急互助提示' });
  const payload = {
    tenant_id: TENANT_ID,
    supplier_code: cleanCode(body.submitter_code || body.friendCode),
    source_mode: 'emergency_helper_registry',
    source_channel: cleanText(body.source || 'emergency_help_offer', 80),
    name,
    contact,
    city,
    country: cleanText(body.country || '', 80),
    service_type: '紧急互助',
    service_type_code: 'emergency_help',
    category: 'mutual_aid',
    service_area: serviceArea,
    availability: cleanText(body.availability || '', 160),
    intro: cleanText(body.note || '', 800),
    verification_status: 'pending_review',
    status: 'candidate',
    completeness_score: 40 + (contact ? 20 : 0) + (serviceArea ? 20 : 0) + (city ? 10 : 0),
    fields: {
      helper_range: serviceArea,
      special_skills: specialSkills,
      app_critical_alert_opt_in: appAlertAuthorized,
      app_critical_alert_required: appAlertAuthorized,
      app_alert_can_disable: body.app_alert_can_disable !== false,
      helper_can_pause_or_exit: true,
      alert_channel: 'native_app_push',
      alert_sound: 'critical',
      legal_acknowledged: legalAcknowledged,
      legal_terms_version: cleanText(body.legal_terms_version || 'emergency_mutual_aid_v1_20260718', 80),
      helper_scope_mode: 'user_defined_range',
      safety_note: 'User voluntarily registered for emergency mutual aid. Native app push and device-level alert require app permission and platform capability.',
      raw: body
    }
  };
  const rows = await supa('huaban_supply_profiles', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return res.status(200).json({ ok: true, helper: Array.isArray(rows) ? rows[0] : rows });
}

async function recordOrderProof(order, eventType, body = {}) {
  if (!order?.order_no) return null;
  const payload = {
    tenant_id: TENANT_ID,
    order_id: order.id || null,
    order_no: order.order_no,
    temporary_chat_id: order.temporary_chat_id || '',
    event_type: eventType,
    actor_role: cleanText(body.actor_role || 'system', 40),
    actor_code: cleanCode(body.actor_code || body.friendCode || ''),
    actor_name: cleanText(body.actor_name || '', 120),
    proof_text: cleanText(body.proof_text || body.note || '', 1200),
    map_url: cleanText(body.map_url || '', 420),
    navigation_url: cleanText(body.navigation_url || '', 420),
    fields: body.fields || {}
  };
  const rows = await supa('huaban_order_proof_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  }).catch(() => null);
  return Array.isArray(rows) ? rows[0] : rows;
}

async function createTransactionContract(req, res) {
  const body = req.body || {};
  const service = cleanText(body.service || body.title || '', 180);
  const terms = cleanText(body.terms || body.completion_standard || '', 1200);
  if (!service && !terms) return res.status(400).json({ error: '请先填写服务或交易内容' });
  const priceSuggestion = body.price_suggestion && typeof body.price_suggestion === 'object' ? body.price_suggestion : {};
  const no = orderNo();
  const temporaryChatId = `TC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const payload = {
    tenant_id: TENANT_ID,
    order_no: no,
    order_type: cleanText(body.order_type || 'local_service', 80),
    source_channel: cleanText(body.source_channel || 'ai_contract_card', 80),
    title: service || '华伴交易确认',
    description: terms,
    buyer_name: cleanText(body.buyer_name || '', 120),
    buyer_contact: cleanText(body.buyer_contact || body.requester_phone || body.phone || '', 160),
    supplier_name: cleanText(body.supplier_name || '', 120),
    supplier_contact: cleanText(body.supplier_contact || '', 160),
    city: cleanText(body.city || body.location_city || '', 80),
    country: cleanText(body.country || '', 80),
    address: cleanText(body.address || body.location_address || body.time_place || '', 220),
    scheduled_at: cleanText(body.scheduled_at || body.time_place || '', 180),
    amount_text: cleanText(priceSuggestion.text || body.amount_text || body.buyer_budget || body.seller_quote || '', 160),
    currency: cleanText(body.currency || '', 20),
    status: 'agreement_draft',
    temporary_chat_id: temporaryChatId,
    temporary_chat_status: 'open',
    agreement_version: 'transaction_terms_v1_20260709',
    work_order: {
      service,
      buyer_budget: cleanText(body.buyer_budget || '', 160),
      seller_quote: cleanText(body.seller_quote || '', 160),
      time_place: cleanText(body.time_place || '', 220),
      terms
    },
    transaction_agreement: {
      price_suggestion: priceSuggestion,
      payment_method: cleanText(body.payment_method || '', 160),
      payment_terms: cleanText(body.payment_terms || '双方自由约定支付方式；华伴记录确认过程。', 300),
      legal_boundary: '华伴只整理双方事实和共识，不替任何一方承诺、担保或作最终决定。'
    },
    performance_proof: {
      buyer_fulfillment_confirmed: false,
      seller_fulfillment_confirmed: false,
      payment_confirmed_by_both: false
    },
    fields: {
      requester_code: cleanCode(body.requester_code || body.friendCode || ''),
      source_ref: cleanCode(body.source_ref || body.ref || ''),
      buyer_agreement_confirmed: false,
      seller_agreement_confirmed: false,
      service_completion_points_after_both_confirmed: { requester: 50, provider: 50, status: 'pending_review' },
      app_flow: {
        buyer_confirm_button: true,
        seller_confirm_button: true,
        fulfillment_both_confirm_required: true
      },
      original: body
    }
  };
  const rows = await supa('huaban_orders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const order = Array.isArray(rows) ? rows[0] : rows;
  await recordOrderProof(order, 'ai_contract_card_created', {
    actor_role: 'agent',
    actor_code: payload.fields.requester_code,
    proof_text: `${service || '交易确认'}；${terms || ''}`,
    fields: { price_suggestion: priceSuggestion, work_order: payload.work_order }
  });
  return res.status(200).json({ ok: true, order });
}

async function confirmTransaction(req, res) {
  const body = req.body || {};
  const id = cleanText(body.id || '', 80);
  const no = cleanText(body.order_no || '', 80);
  const role = cleanText(body.role || '', 40);
  const stage = cleanText(body.stage || 'agreement', 40);
  if (!id && !no) return res.status(400).json({ error: '缺少交易编号' });
  if (!['buyer', 'seller'].includes(role)) return res.status(400).json({ error: '请选择买方或卖方确认' });
  const filter = id ? `id=eq.${encodeURIComponent(id)}` : `order_no=eq.${encodeURIComponent(no)}`;
  const rows = await supa(`huaban_orders?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&${filter}&select=*`);
  const order = Array.isArray(rows) ? rows[0] : null;
  if (!order) return res.status(404).json({ error: '没有找到交易记录' });
  const fields = order.fields && typeof order.fields === 'object' ? order.fields : {};
  const proof = order.performance_proof && typeof order.performance_proof === 'object' ? order.performance_proof : {};
  const patch = { fields: { ...fields }, performance_proof: { ...proof } };
  const now = new Date().toISOString();
  if (stage === 'agreement') {
    if (role === 'buyer') {
      patch.user_confirmed_at = now;
      patch.fields.buyer_agreement_confirmed = true;
    } else {
      patch.supplier_confirmed_at = now;
      patch.fields.seller_agreement_confirmed = true;
    }
    const both = Boolean(patch.fields.buyer_agreement_confirmed && patch.fields.seller_agreement_confirmed);
    patch.status = both ? 'agreement_confirmed' : 'agreement_pending';
  } else if (stage === 'fulfillment') {
    if (role === 'buyer') patch.performance_proof.buyer_fulfillment_confirmed = true;
    if (role === 'seller') patch.performance_proof.seller_fulfillment_confirmed = true;
    const bothDone = Boolean(patch.performance_proof.buyer_fulfillment_confirmed && patch.performance_proof.seller_fulfillment_confirmed);
    patch.status = bothDone ? 'completed' : 'fulfillment_pending';
    if (bothDone) {
      patch.completed_at = now;
      patch.performance_proof.payment_confirmed_by_both = true;
      patch.fields.service_completion_points_pending_review = { requester: 50, provider: 50, reason: 'both_confirmed_service_completion' };
    }
  } else {
    return res.status(400).json({ error: '无效确认阶段' });
  }
  const updatedRows = await supa(`huaban_orders?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
  await recordOrderProof(updated, stage === 'agreement' ? `${role}_agreement_confirmed` : `${role}_fulfillment_confirmed`, {
    actor_role: role,
    actor_code: cleanCode(body.actor_code || body.friendCode || ''),
    actor_name: cleanText(body.actor_name || '', 120),
    proof_text: cleanText(body.note || '', 500),
    fields: { stage, role }
  });
  return res.status(200).json({ ok: true, order: updated });
}

async function listDemand(req, res) {
  const token = String(req.headers['x-admin-token'] || req.query?.token || '');
  if (!verifyAdminToken(token)) return res.status(401).json({ error: '后台登录已过期' });
  const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 100);
  if (String(req.query?.view || '') === 'orders') {
    const orders = await supa(`huaban_orders?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&select=*&order=created_at.desc&limit=${limit}`).catch(() => []);
    return res.status(200).json({ ok: true, orders: Array.isArray(orders) ? orders : [] });
  }
  const demands = await supa(`huaban_demand_cards?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&select=*&order=created_at.desc&limit=${limit}`);
  const demandList = Array.isArray(demands) ? demands : [];
  const ids = demandList.map(item => item.id).filter(Boolean);
  let tasks = [];
  if (ids.length) {
    tasks = await supa(`huaban_collaboration_tasks?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&demand_id=in.(${ids.join(',')})&select=*&order=created_at.desc`).catch(() => []);
  }
  const enriched = demandList.map(row => {
    const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
    const original = fields.original && typeof fields.original === 'object' ? fields.original : {};
    const trace = fields.source_trace && typeof fields.source_trace === 'object' ? fields.source_trace : demandSourceTrace(original);
    const automation = fields.automation && typeof fields.automation === 'object' ? fields.automation : {};
    const radar = automation.radar && typeof automation.radar === 'object' ? automation.radar : null;
    const visitor = trace.visitor_id || original.visitor_id || '';
    const device = [trace.device_type || original.device_type, trace.browser || original.browser].filter(Boolean).join(' / ');
    const source = trace.page_path || row.source_channel || original.page_path || row.source_ref || row.requester_code || '';
    return {
      ...row,
      visitor_id: visitor,
      visitor_label: shortTrace(visitor, 8) || '未知访客',
      device_label: device || '未知设备',
      source_label: source || '未知来源',
      automation_status: radar?.queued ? 'radar_queued' : radar?.skipped ? 'radar_skipped' : 'not_checked',
      automation_label: radar?.queued
        ? `已自动交给雷达 ${radar.queued} 条`
        : radar?.reason || '暂未进入雷达',
      likely_real_user: Boolean(visitor && !/test|localhost|admin/i.test(`${source} ${row.source_channel || ''}`))
    };
  });
  const visitors = new Set(enriched.map(row => row.visitor_id).filter(Boolean));
  const radarQueued = enriched.reduce((sum, row) => sum + (row.automation_status === 'radar_queued' ? 1 : 0), 0);
  const supplyGaps = enriched.filter(row => Number(row.supply_match_count || 0) < 4).length;
  return res.status(200).json({
    ok: true,
    summary: {
      total: enriched.length,
      unique_visitors: visitors.size,
      likely_real_users: enriched.filter(row => row.likely_real_user).length,
      supply_gaps: supplyGaps,
      radar_queued: radarQueued
    },
    demands: enriched,
    tasks: Array.isArray(tasks) ? tasks : []
  });
}

async function updateDemand(req, res) {
  const token = String(req.headers['x-admin-token'] || req.body?.token || '');
  if (!verifyAdminToken(token)) return res.status(401).json({ error: '后台登录已过期' });
  const id = cleanText(req.body?.id, 80);
  const status = cleanText(req.body?.status, 40);
  const allowed = new Set(['draft','human_review','need_info','matching','matched','closed','cancelled']);
  if (!id || !allowed.has(status)) return res.status(400).json({ error: '无效需求状态' });
  const rows = await supa(`huaban_demand_cards?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status })
  });
  return res.status(200).json({ ok: true, demand: Array.isArray(rows) ? rows[0] : rows });
}

async function createProviderContactRequest(req, res) {
  const providerId = cleanText(req.body?.provider_id, 80);
  const mode = cleanText(req.body?.mode || 'message', 40);
  const requesterPhone = cleanPhone(req.body?.requester_phone || req.body?.phone || '');
  if (!providerId) return res.status(400).json({ error: '缺少服务者资料' });
  if (!['message', 'call'].includes(mode)) return res.status(400).json({ error: '联系方式类型无效' });
  if (!requesterPhone) return res.status(401).json({ error: '请先完成手机号登录，再发起华伴临时会话' });
  const rows = await supa([
    'huaban_supply_profiles?',
    `tenant_id=eq.${encodeURIComponent(TENANT_ID)}`,
    `id=eq.${encodeURIComponent(providerId)}`,
    'limit=1',
    'select=id,name,city,service_type,service_type_code,claimed_by_code,supplier_code,fields'
  ].join('&')).catch(() => []);
  const provider = Array.isArray(rows) ? rows[0] : null;
  if (!provider) return res.status(404).json({ error: '服务者资料不存在' });
  const fields = provider.fields && typeof provider.fields === 'object' ? provider.fields : {};
  const targetCode = provider.claimed_by_code || provider.supplier_code || fields.claimed_by_code || fields.supplier_code || '';
  if (!targetCode) return res.status(409).json({ error: '服务者还不是华伴用户，请使用电话或短信联系' });
  const summary = cleanText(req.body?.summary || '有用户找你，回拨或回信。', 300);
  const payload = {
    tenant_id: TENANT_ID,
    requester_code: cleanCode(req.body?.requester_code || ''),
    requester_phone: requesterPhone,
    source_ref: cleanText(req.body?.source_ref || providerId, 160),
    source_channel: 'huaban_app_contact',
    need_type: 'temporary_provider_contact_session',
    service_type: cleanText(provider.service_type || req.body?.service_type || '本地服务', 120),
    service_type_code: cleanText(provider.service_type_code || req.body?.service_type_code || 'local_service', 80),
    city: cleanText(provider.city || req.body?.city || '', 80),
    raw_text: summary,
    summary,
    status: 'matched',
    supply_match_count: 1,
    fields: {
      original: req.body || {},
      session_kind: 'temporary_provider_contact',
      session_policy: 'one_time_unless_deal',
      contact_mode: mode,
      provider_id: provider.id,
      provider_name: provider.name,
      provider_city: provider.city,
      provider_friend_code: targetCode,
      provider_is_huaban_user: Boolean(targetCode),
      provider_notification_text: '有用户找你，回拨或回信。',
      user_visible_text: mode === 'call' ? '已发起临时通话会话。' : '已发起临时信息会话。',
      close_rule: '未形成交易或双方没有继续联系时，本次临时会话不保留为长期会话。',
      participant_rule: '仅双方都是华伴用户时可发起。'
    }
  };
  const saved = await supa('huaban_demand_cards', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const demand = Array.isArray(saved) ? saved[0] : saved;
  let tempConversation = null;
  let tempConversationWarning = '';
  try {
    const conversationRows = await supa('huaban_temp_conversations', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        demand_id: demand?.id || null,
        supply_profile_id: provider.id,
        requester_code: cleanCode(req.body?.requester_code || ''),
        requester_phone: requesterPhone,
        provider_code: targetCode,
        provider_name: provider.name,
        service_type: payload.service_type,
        service_type_code: payload.service_type_code,
        city: payload.city,
        contact_mode: mode,
        last_message_at: new Date().toISOString(),
        fields: {
          original: req.body || {},
          provider_notification_text: '有用户找你，回拨或回信。',
          user_summary: summary
        }
      })
    });
    tempConversation = Array.isArray(conversationRows) ? conversationRows[0] : conversationRows;
    if (tempConversation?.id) {
      await supa('huaban_temp_conversation_messages', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          conversation_id: tempConversation.id,
          sender_role: 'system',
          sender_code: cleanCode(req.body?.requester_code || ''),
          recipient_code: targetCode,
          message_type: mode === 'call' ? 'call_request' : 'contact_request',
          body: '有用户找你，回拨或回信。',
          delivery_status: 'pending',
          fields: { user_summary: summary, contact_mode: mode }
        })
      });
      await supa('huaban_contact_notifications', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          conversation_id: tempConversation.id,
          recipient_code: targetCode,
          recipient_role: 'provider',
          title: '有用户找你',
          body: '回拨或回信。',
          notification_type: mode === 'call' ? 'temporary_provider_call' : 'temporary_provider_message',
          action_text: mode === 'call' ? '回拨' : '回信',
          fields: {
            provider_id: provider.id,
            demand_id: demand?.id || '',
            contact_mode: mode,
            sound_type: mode === 'call' ? 'ring_alert' : 'message_alert',
            app_push: true,
            native_app_push: true,
            vibrate: true
          }
        })
      });
    }
  } catch (error) {
    tempConversationWarning = /Could not find the table|schema cache|PGRST205/i.test(error.message || '')
      ? '临时会话表尚未创建，已先写入需求记录。'
      : `临时会话写入失败：${error.message || '未知错误'}`;
    console.warn('temporary provider conversation fallback', tempConversationWarning);
  }
  return res.status(200).json({
    ok: true,
    contact_mode: mode,
    provider: {
      id: provider.id,
      name: provider.name,
      city: provider.city,
      huaban_friend_code: targetCode
    },
    demand,
    temp_conversation: tempConversation,
    warning: tempConversationWarning,
    provider_message: '有用户找你，回拨或回信。'
  });
}

async function getAuthUser(accessToken = '') {
  const token = cleanText(accessToken, 4096);
  if (!token) throw new Error('请先完成手机号验证');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPA_ANON_KEY || '';
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: {
      apikey: anonKey || SERVICE_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('手机号登录状态已失效，请重新验证');
  return res.json();
}

async function accountCodesForPhone(phone = '') {
  const normalized = cleanPhone(phone);
  const codes = [];
  const accounts = normalized ? await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(normalized)}&status=eq.active&order=created_at.asc&select=friend_code,fields&limit=20`).catch(() => []) : [];
  (Array.isArray(accounts) ? accounts : []).forEach(row => {
    codes.push(row.friend_code);
    codes.push(row.fields?.canonical_friend_code);
  });
  const links = normalized ? await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(normalized)}&status=eq.active&order=created_at.asc&select=friend_code,fields&limit=50`).catch(() => []) : [];
  (Array.isArray(links) ? links : []).forEach(row => {
    codes.push(row.friend_code);
    codes.push(row.fields?.canonical_friend_code);
  });
  return Array.from(new Set(codes.map(cleanCode).filter(Boolean)));
}

async function authCodeContext(req, codeField = 'sender_code') {
  const authUser = await getAuthUser(req.body?.accessToken || '');
  const phone = cleanPhone(authUser.phone || req.body?.phone || '');
  const codes = await accountCodesForPhone(phone);
  const requestedCode = cleanCode(req.body?.[codeField] || req.body?.sender_code || '');
  if (!codes.length && requestedCode) codes.push(requestedCode);
  const cleanCodes = Array.from(new Set(codes.map(cleanCode).filter(Boolean)));
  if (!cleanCodes.length) throw new Error('请先完成手机号验证');
  return { authUser, phone, codes: cleanCodes, requestedCode };
}

function callTableError(error) {
  return /Could not find the table|schema cache|PGRST205|huaban_call_sessions/i.test(error?.message || '')
    ? '通话表尚未创建：huaban_call_sessions'
    : (error?.message || '通话处理失败');
}

async function getCallSessionForUser(callId = '', codes = []) {
  const id = cleanText(callId, 80);
  if (!id) return null;
  const rows = await supa(`huaban_call_sessions?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&id=eq.${encodeURIComponent(id)}&limit=1&select=*`).catch(error => {
    throw new Error(callTableError(error));
  });
  const call = Array.isArray(rows) ? rows[0] : null;
  if (!call) return null;
  const codeSet = new Set(codes.map(cleanCode).filter(Boolean));
  if (!codeSet.has(cleanCode(call.caller_code)) && !codeSet.has(cleanCode(call.callee_code))) {
    throw new Error('你不在这个通话里');
  }
  return call;
}

async function insertCallNotice(call = {}, message = '') {
  const body = message || `${call.call_type === 'video' ? '视频' : '语音'}通话`;
  if (call.conversation_kind === 'temp' && call.conversation_id) {
    return supa('huaban_temp_conversation_messages', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        conversation_id: call.conversation_id,
        sender_role: 'system',
        sender_code: call.caller_code,
        recipient_code: call.callee_code,
        message_type: 'call_request',
        body,
        delivery_status: 'delivered',
        fields: {
          call_id: call.id,
          call_type: call.call_type,
          sound_type: 'ring_alert',
          source: 'huaban_call'
        }
      })
    }).catch(() => null);
  }
  return supa('huaban_friend_messages', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      sender_code: call.caller_code,
      recipient_code: call.callee_code,
      message_type: 'system_notice',
      body,
      delivery_status: 'delivered',
      fields: {
        call_id: call.id,
        call_type: call.call_type,
        sound_type: 'ring_alert',
        source: 'huaban_call'
      }
    })
  }).catch(() => null);
}

async function startCallSession(req, res) {
  const { phone, codes, requestedCode } = await authCodeContext(req);
  const conversationKind = cleanText(req.body?.conversation_kind || 'friend', 20);
  const callType = cleanText(req.body?.call_type || 'voice', 20);
  if (!['friend', 'temp'].includes(conversationKind)) return res.status(400).json({ error: '通话场景暂不支持' });
  if (!['voice', 'video'].includes(callType)) return res.status(400).json({ error: '通话类型暂不支持' });

  let callerCode = codes.find(item => item !== cleanCode(req.body?.peer_code || req.body?.callee_code || '')) || codes[0] || requestedCode;
  let calleeCode = cleanCode(req.body?.peer_code || req.body?.callee_code || '');
  const conversationId = cleanText(req.body?.conversation_id || '', 80);

  if (conversationKind === 'temp') {
    if (!conversationId) return res.status(400).json({ error: '缺少临时会话' });
    const rows = await supa(`huaban_temp_conversations?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&id=eq.${encodeURIComponent(conversationId)}&limit=1&select=*`).catch(() => []);
    const conversation = Array.isArray(rows) ? rows[0] : null;
    if (!conversation) return res.status(404).json({ error: '会话不存在' });
    const requesterCode = cleanCode(conversation.requester_code || '');
    const providerCode = cleanCode(conversation.provider_code || '');
    const codeSet = new Set(codes);
    if (codeSet.has(requesterCode)) {
      callerCode = requesterCode;
      calleeCode = providerCode;
    } else if (codeSet.has(providerCode)) {
      callerCode = providerCode;
      calleeCode = requesterCode;
    } else {
      return res.status(403).json({ error: '你不在这个临时会话里' });
    }
  }

  if (!callerCode || !calleeCode) return res.status(400).json({ error: '缺少通话对象' });
  if (callerCode === calleeCode) return res.status(400).json({ error: '不能呼叫自己' });

  const rows = await supa('huaban_call_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      conversation_kind: conversationKind,
      conversation_id: conversationId,
      call_type: callType,
      caller_code: callerCode,
      callee_code: calleeCode,
      status: 'ringing',
      offer: req.body?.offer || null,
      fields: {
        caller_phone: phone,
        caller_name: cleanText(req.body?.caller_name || '', 120),
        caller_avatar: cleanText(req.body?.caller_avatar || '', 800),
        source: 'huaban_web_call'
      }
    })
  }).catch(error => {
    throw new Error(callTableError(error));
  });
  const call = Array.isArray(rows) ? rows[0] : rows;
  await insertCallNotice(call, `发起${callType === 'video' ? '视频' : '语音'}通话`);
  return res.status(200).json({ ok: true, call });
}

async function pollCallSession(req, res) {
  const { codes } = await authCodeContext(req, 'recipient_code');
  const callId = cleanText(req.body?.call_id || '', 80);
  if (callId) return res.status(200).json({ ok: true, call: await getCallSessionForUser(callId, codes) });

  const statusFilter = 'ringing,accepted';
  const peerCode = cleanCode(req.body?.peer_code || req.body?.friend_code || '');
  const conversationId = cleanText(req.body?.conversation_id || '', 80);
  const byCallee = await supa(`huaban_call_sessions?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&callee_code=in.(${codes.join(',')})&status=in.(${statusFilter})&order=created_at.desc&limit=10&select=*`).catch(error => {
    throw new Error(callTableError(error));
  });
  const byCaller = await supa(`huaban_call_sessions?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&caller_code=in.(${codes.join(',')})&status=in.(${statusFilter})&order=created_at.desc&limit=10&select=*`).catch(error => {
    throw new Error(callTableError(error));
  });
  const rows = [...(Array.isArray(byCallee) ? byCallee : []), ...(Array.isArray(byCaller) ? byCaller : [])]
    .filter(call => !peerCode || cleanCode(call.caller_code) === peerCode || cleanCode(call.callee_code) === peerCode)
    .filter(call => !conversationId || String(call.conversation_id || '') === conversationId)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return res.status(200).json({ ok: true, call: rows[0] || null });
}

async function signalCallSession(req, res) {
  const { codes } = await authCodeContext(req);
  const call = await getCallSessionForUser(req.body?.call_id || '', codes);
  if (!call) return res.status(404).json({ error: '通话不存在' });
  const codeSet = new Set(codes);
  const isCaller = codeSet.has(cleanCode(call.caller_code));
  const isCallee = codeSet.has(cleanCode(call.callee_code));
  const signalType = cleanText(req.body?.signal_type || req.body?.call_action || '', 30);
  const now = new Date().toISOString();
  const patch = { updated_at: now };

  if (signalType === 'answer' || signalType === 'accept') {
    if (!isCallee) return res.status(403).json({ error: '只有被呼叫方可以接听' });
    patch.status = 'accepted';
    patch.accepted_at = call.accepted_at || now;
    if (req.body?.answer) patch.answer = req.body.answer;
  } else if (signalType === 'decline') {
    if (!isCallee) return res.status(403).json({ error: '只有被呼叫方可以拒绝' });
    patch.status = 'declined';
    patch.ended_at = now;
  } else if (signalType === 'end') {
    patch.status = 'ended';
    patch.ended_at = now;
  } else if (signalType === 'ice') {
    const candidate = req.body?.candidate;
    if (!candidate) return res.status(400).json({ error: '缺少通话候选信息' });
    const key = isCaller ? 'caller_ice' : 'callee_ice';
    const existing = Array.isArray(call[key]) ? call[key] : [];
    patch[key] = existing.concat([candidate]).slice(-80);
  } else {
    return res.status(400).json({ error: '通话动作不支持' });
  }

  const rows = await supa(`huaban_call_sessions?id=eq.${encodeURIComponent(call.id)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  }).catch(error => {
    throw new Error(callTableError(error));
  });
  return res.status(200).json({ ok: true, call: Array.isArray(rows) ? rows[0] : rows });
}

async function replyTempConversation(req, res) {
  const conversationId = cleanText(req.body?.conversation_id || '', 80);
  const messageBody = cleanText(req.body?.body || req.body?.message || '', 1000);
  const messageType = cleanText(req.body?.message_type || 'text', 40);
  if (!conversationId) return res.status(400).json({ error: '缺少会话' });
  if (!messageBody) return res.status(400).json({ error: '请填写回复内容' });
  if (!['text', 'voice'].includes(messageType)) return res.status(400).json({ error: '消息类型暂不支持' });
  const authUser = await getAuthUser(req.body?.accessToken || '');
  const phone = cleanPhone(authUser.phone || req.body?.phone || '');
  const myCodes = await accountCodesForPhone(phone);
  const requestedCode = cleanCode(req.body?.sender_code || '');
  if (!myCodes.length && requestedCode) myCodes.push(requestedCode);
  const codeSet = new Set(myCodes.map(cleanCode).filter(Boolean));
  if (!codeSet.size) return res.status(401).json({ error: '请先完成手机号验证' });

  const rows = await supa(`huaban_temp_conversations?tenant_id=eq.${TENANT_ID}&id=eq.${encodeURIComponent(conversationId)}&limit=1&select=*`).catch(() => []);
  const conversation = Array.isArray(rows) ? rows[0] : null;
  if (!conversation) return res.status(404).json({ error: '会话不存在' });
  const requesterCode = cleanCode(conversation.requester_code || '');
  const providerCode = cleanCode(conversation.provider_code || '');
  const isProvider = codeSet.has(providerCode);
  const isRequester = codeSet.has(requesterCode);
  if (!isProvider && !isRequester) return res.status(403).json({ error: '你不在这个临时会话里' });
  const senderRole = isProvider ? 'provider' : 'requester';
  const senderCode = isProvider ? providerCode : requesterCode;
  const recipientCode = isProvider ? requesterCode : providerCode;
  const nextStatus = isProvider ? 'provider_replied' : 'requester_replied';
  const now = new Date().toISOString();

  const messageRows = await supa('huaban_temp_conversation_messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      conversation_id: conversationId,
      sender_role: senderRole,
      sender_code: senderCode,
      recipient_code: recipientCode,
      message_type: messageType,
      body: messageBody,
      delivery_status: 'delivered',
      fields: {
        source: 'profile_temp_conversation_reply',
        sound_type: 'message_alert',
        voice_duration_seconds: Math.max(0, Number(req.body?.voice_duration_seconds || 0) || 0),
        voice_url: cleanText(req.body?.voice_url || '', 300000)
      }
    })
  });

  await supa(`huaban_temp_conversations?id=eq.${encodeURIComponent(conversationId)}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: nextStatus, last_message_at: now })
  }).catch(() => null);

  await supa('huaban_contact_notifications', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      conversation_id: conversationId,
      recipient_code: recipientCode,
      recipient_role: isProvider ? 'requester' : 'provider',
      title: isProvider ? '服务者回复了你' : '用户回复了你',
      body: messageBody.slice(0, 160),
      notification_type: 'temporary_provider_reply',
      action_text: '查看',
      fields: {
        sound_type: 'message_alert',
        app_push: true,
        native_app_push: true,
        vibrate: true
      }
    })
  }).catch(() => null);

  await supa(`huaban_contact_notifications?tenant_id=eq.${TENANT_ID}&conversation_id=eq.${encodeURIComponent(conversationId)}&recipient_code=eq.${encodeURIComponent(senderCode)}&status=eq.unread`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'read', read_at: now })
  }).catch(() => null);

  return res.status(200).json({
    ok: true,
    conversation_id: conversationId,
    message: Array.isArray(messageRows) ? messageRows[0] : messageRows,
    status: nextStatus
  });
}

async function markTempConversationRead(req, res) {
  const conversationId = cleanText(req.body?.conversation_id || '', 80);
  if (!conversationId) return res.status(400).json({ error: '缺少会话' });
  const authUser = await getAuthUser(req.body?.accessToken || '');
  const phone = cleanPhone(authUser.phone || req.body?.phone || '');
  const myCodes = await accountCodesForPhone(phone);
  const requestedCode = cleanCode(req.body?.recipient_code || req.body?.sender_code || '');
  if (!myCodes.length && requestedCode) myCodes.push(requestedCode);
  const cleanCodes = Array.from(new Set(myCodes.map(cleanCode).filter(Boolean)));
  if (!cleanCodes.length) return res.status(401).json({ error: '请先完成手机号验证' });
  const now = new Date().toISOString();
  await supa(`huaban_contact_notifications?tenant_id=eq.${TENANT_ID}&conversation_id=eq.${encodeURIComponent(conversationId)}&recipient_code=in.(${cleanCodes.join(',')})&status=eq.unread`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'read', read_at: now })
  }).catch(() => null);
  return res.status(200).json({ ok: true });
}

async function sendFriendMessage(req, res) {
  const recipientCode = cleanCode(req.body?.recipient_code || req.body?.friend_code || req.body?.friend || '');
  const messageBody = cleanText(req.body?.body || req.body?.message || '', 1000);
  const messageType = cleanText(req.body?.message_type || 'text', 40);
  if (!recipientCode) return res.status(400).json({ error: '缺少好友' });
  if (!messageBody && messageType !== 'voice') return res.status(400).json({ error: '请填写留言' });
  if (!['text', 'voice'].includes(messageType)) return res.status(400).json({ error: '消息类型暂不支持' });
  const authUser = await getAuthUser(req.body?.accessToken || '');
  const phone = cleanPhone(authUser.phone || req.body?.phone || '');
  const myCodes = await accountCodesForPhone(phone);
  const requestedCode = cleanCode(req.body?.sender_code || '');
  const codeSet = new Set(myCodes.map(cleanCode).filter(Boolean));
  const senderCode = Array.from(codeSet).find(item => item !== recipientCode) || requestedCode;
  if (!senderCode) return res.status(401).json({ error: '请先完成手机号验证' });
  if (senderCode === recipientCode) return res.status(400).json({ error: '不能发给自己' });
  const payload = {
    tenant_id: TENANT_ID,
    sender_code: senderCode,
    recipient_code: recipientCode,
    message_type: messageType,
    body: messageType === 'voice' ? (messageBody || '语音留言') : messageBody,
    voice_url: cleanText(req.body?.voice_url || '', 300000),
    voice_duration_seconds: Math.max(0, Number(req.body?.voice_duration_seconds || 0) || 0),
    delivery_status: 'delivered',
    local_time_text: cleanText(req.body?.local_time_text || '', 80),
    local_timezone: cleanText(req.body?.local_timezone || '', 120),
    fields: {
      source: 'friend_chat',
      sound_type: messageType === 'voice' ? 'voice_message_alert' : 'message_alert',
      sender_phone: phone,
      sender_name: cleanText(req.body?.sender_name || '', 120),
      sender_avatar: cleanText(req.body?.sender_avatar || '', 800)
    }
  };
  const rows = await supa('huaban_friend_messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  }).catch(error => {
    throw new Error(/Could not find the table|schema cache|PGRST205/i.test(error.message || '') ? '好友留言表尚未创建：huaban_friend_messages' : error.message);
  });
  return res.status(200).json({ ok: true, message: Array.isArray(rows) ? rows[0] : rows });
}

async function pollFriendMessages(req, res) {
  const friendCode = cleanCode(req.body?.friend_code || req.body?.peer_code || req.body?.recipient_code || req.body?.friend || '');
  if (!friendCode) return res.status(400).json({ error: '缺少好友' });
  const authUser = await getAuthUser(req.body?.accessToken || '');
  const phone = cleanPhone(authUser.phone || req.body?.phone || '');
  const myCodes = await accountCodesForPhone(phone);
  const requestedCode = cleanCode(req.body?.sender_code || req.body?.recipient_code || '');
  if (!myCodes.length && requestedCode) myCodes.push(requestedCode);
  const cleanCodes = Array.from(new Set(myCodes.map(cleanCode).filter(Boolean)));
  if (!cleanCodes.length) return res.status(401).json({ error: '请先完成手机号验证' });
  const codeList = cleanCodes.join(',');
  const limit = Math.min(120, Math.max(20, Number(req.body?.limit || 80) || 80));
  const select = 'id,sender_code,recipient_code,message_type,body,voice_url,voice_duration_seconds,delivery_status,read_at,local_time_text,local_timezone,fields,created_at';
  const sent = await supa(`huaban_friend_messages?tenant_id=eq.${TENANT_ID}&sender_code=in.(${codeList})&recipient_code=eq.${encodeURIComponent(friendCode)}&order=created_at.desc&limit=${limit}&select=${select}`).catch(error => {
    throw new Error(/Could not find the table|schema cache|PGRST205/i.test(error.message || '') ? '好友留言表尚未创建：huaban_friend_messages' : error.message);
  });
  const received = await supa(`huaban_friend_messages?tenant_id=eq.${TENANT_ID}&sender_code=eq.${encodeURIComponent(friendCode)}&recipient_code=in.(${codeList})&order=created_at.desc&limit=${limit}&select=${select}`).catch(error => {
    throw new Error(/Could not find the table|schema cache|PGRST205/i.test(error.message || '') ? '好友留言表尚未创建：huaban_friend_messages' : error.message);
  });
  const seen = new Set();
  const messages = [...(Array.isArray(sent) ? sent : []), ...(Array.isArray(received) ? received : [])]
    .filter(row => {
      const key = String(row.id || `${row.sender_code}-${row.recipient_code}-${row.created_at}-${row.body || row.voice_url || ''}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .slice(-limit);
  return res.status(200).json({ ok: true, messages, identity_codes: cleanCodes });
}

async function markFriendMessagesRead(req, res) {
  const friendCode = cleanCode(req.body?.friend_code || req.body?.sender_code || req.body?.friend || '');
  const authUser = await getAuthUser(req.body?.accessToken || '');
  const phone = cleanPhone(authUser.phone || req.body?.phone || '');
  const myCodes = await accountCodesForPhone(phone);
  const requestedCode = cleanCode(req.body?.recipient_code || '');
  if (!myCodes.length && requestedCode) myCodes.push(requestedCode);
  const cleanCodes = Array.from(new Set(myCodes.map(cleanCode).filter(Boolean)));
  if (!cleanCodes.length) return res.status(401).json({ error: '请先完成手机号验证' });
  const now = new Date().toISOString();
  const path = friendCode
    ? `huaban_friend_messages?tenant_id=eq.${TENANT_ID}&sender_code=eq.${encodeURIComponent(friendCode)}&recipient_code=in.(${cleanCodes.join(',')})&delivery_status=eq.delivered`
    : `huaban_friend_messages?tenant_id=eq.${TENANT_ID}&recipient_code=in.(${cleanCodes.join(',')})&delivery_status=eq.delivered`;
  await supa(path, {
    method: 'PATCH',
    body: JSON.stringify({ delivery_status: 'read', read_at: now })
  }).catch(() => null);
  return res.status(200).json({ ok: true });
}

function confirmsCompletionText(value = '') {
  const text = cleanText(value, 120).toLowerCase();
  return /(完成了|已完成|做完了|结束了|确认完成|服务完成|成交了|done|completed|finish|finished)/i.test(text);
}

async function samePairCompletionAlreadyCountedToday(requesterCode = '', providerCode = '') {
  const requester = cleanCode(requesterCode);
  const provider = cleanCode(providerCode);
  if (!requester || !provider) return false;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const rows = await supa(
    `huaban_point_events?tenant_id=eq.${TENANT_ID}&action=eq.service_completion_confirmed&created_at=gte.${encodeURIComponent(dayStart)}&owner_code=in.(${requester},${provider})&limit=50&select=id,owner_code,status,fields,created_at`
  ).catch(() => []);
  return (Array.isArray(rows) ? rows : []).some(row => {
    if (String(row?.status || '') === 'rejected') return false;
    const fields = row?.fields && typeof row.fields === 'object' ? row.fields : {};
    return cleanCode(fields.requester_code || '') === requester && cleanCode(fields.provider_code || '') === provider;
  });
}

async function confirmTempServiceCompletion(req, res) {
  const conversationId = cleanText(req.body?.conversation_id || '', 80);
  if (!conversationId) return res.status(400).json({ error: '缺少会话' });
  const note = cleanText(req.body?.note || req.body?.body || '确认已完成', 500);
  if (note && !confirmsCompletionText(note) && req.body?.force !== true) {
    return res.status(400).json({ error: '请明确回复已完成或确认完成' });
  }
  const authUser = await getAuthUser(req.body?.accessToken || '');
  const phone = cleanPhone(authUser.phone || req.body?.phone || '');
  const myCodes = await accountCodesForPhone(phone);
  const requestedCode = cleanCode(req.body?.sender_code || req.body?.actor_code || '');
  if (!myCodes.length && requestedCode) myCodes.push(requestedCode);
  const codeSet = new Set(myCodes.map(cleanCode).filter(Boolean));
  if (!codeSet.size) return res.status(401).json({ error: '请先完成手机号验证' });

  const rows = await supa(`huaban_temp_conversations?tenant_id=eq.${TENANT_ID}&id=eq.${encodeURIComponent(conversationId)}&limit=1&select=*`).catch(() => []);
  const conversation = Array.isArray(rows) ? rows[0] : null;
  if (!conversation) return res.status(404).json({ error: '会话不存在' });
  const requesterCode = cleanCode(conversation.requester_code || '');
  const providerCode = cleanCode(conversation.provider_code || '');
  const isProvider = codeSet.has(providerCode);
  const isRequester = codeSet.has(requesterCode);
  if (!isProvider && !isRequester) return res.status(403).json({ error: '你不在这个临时会话里' });

  const role = isProvider ? 'provider' : 'requester';
  const now = new Date().toISOString();
  const fields = conversation.fields && typeof conversation.fields === 'object' ? conversation.fields : {};
  const completion = fields.completion && typeof fields.completion === 'object' ? fields.completion : {};
  const nextCompletion = {
    ...completion,
    requester_confirmed_at: role === 'requester' ? now : completion.requester_confirmed_at || '',
    provider_confirmed_at: role === 'provider' ? now : completion.provider_confirmed_at || '',
    requester_note: role === 'requester' ? note : completion.requester_note || '',
    provider_note: role === 'provider' ? note : completion.provider_note || '',
    status: 'waiting_other_side',
    point_action_key: 'service_completion_confirmed',
    point_status: 'pending_review'
  };
  const bothConfirmed = Boolean(nextCompletion.requester_confirmed_at && nextCompletion.provider_confirmed_at);
  if (bothConfirmed) {
    nextCompletion.status = 'both_confirmed_pending_review';
    nextCompletion.both_confirmed_at = nextCompletion.both_confirmed_at || now;
  }

  const patch = {
    status: bothConfirmed ? 'deal_converted' : conversation.status || 'open',
    last_message_at: now,
    closed_at: bothConfirmed ? now : conversation.closed_at || null,
    close_reason: bothConfirmed ? 'both_sides_confirmed_service_completion' : conversation.close_reason || '',
    fields: {
      ...fields,
      completion: nextCompletion
    }
  };
  const updatedRows = await supa(`huaban_temp_conversations?id=eq.${encodeURIComponent(conversationId)}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;

  await supa('huaban_temp_conversation_messages', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      conversation_id: conversationId,
      sender_role: role,
      sender_code: role === 'provider' ? providerCode : requesterCode,
      recipient_code: role === 'provider' ? requesterCode : providerCode,
      message_type: 'text',
      body: note || '确认已完成',
      delivery_status: 'delivered',
      fields: {
        source: 'service_completion_confirmation',
        completion_status: nextCompletion.status
      }
    })
  }).catch(() => null);

  let points = null;
  if (bothConfirmed) {
    const pairAlreadyCounted = await samePairCompletionAlreadyCountedToday(requesterCode, providerCode);
    points = pairAlreadyCounted
      ? { skipped: true, reason: 'same_pair_daily_limit', message: '同一双方当天已记录过一次完成确认。' }
      : await handleServiceCompletionConfirmedScenario({
          requesterCode,
          providerCode,
          conversationId,
          demandId: conversation.demand_id || '',
          serviceType: conversation.service_type || '',
          city: conversation.city || '',
          source: 'temp_conversation_both_confirmed',
          fields: {
            contact_mode: conversation.contact_mode || '',
            supply_profile_id: conversation.supply_profile_id || '',
            requester_confirmed_at: nextCompletion.requester_confirmed_at,
            provider_confirmed_at: nextCompletion.provider_confirmed_at
          }
        }).catch(error => ({ error: error.message || '积分写入失败' }));
  }

  return res.status(200).json({
    ok: true,
    conversation: updated,
    completion: nextCompletion,
    points
  });
}

function cityFeedTableError(error) {
  return /Could not find the table|schema cache|PGRST205|huaban_social_circle_posts/i.test(error?.message || '')
    ? '同城动态表尚未创建：huaban_social_circle_posts'
    : (error?.message || '同城动态处理失败');
}

function publicContentViolation(text = '') {
  return /(色情|裸聊|成人视频|成人内容|成人网站|黄图|约炮|性服务|卖淫|嫖娼|毒品|枪支|洗钱|假证|网赌|博彩|盘口|暴力威胁|血腥|砍人|杀人|打死|持刀伤人)/i.test(String(text || ''));
}

async function createCityFeedPost(req, res) {
  const { phone, codes, requestedCode } = await authCodeContext(req);
  const authorCode = codes[0] || requestedCode;
  const body = cleanText(req.body?.body || req.body?.text || '', 1200);
  const city = cleanText(req.body?.city || '', 80);
  const area = cleanText(req.body?.area || '', 120);
  const visibility = ['nearby', 'city', 'public'].includes(cleanText(req.body?.visibility || '', 20))
    ? cleanText(req.body?.visibility || '', 20)
    : 'city';
  const media = cleanCityFeedMedia(req.body?.media || []);
  if (!body && !media.length) return res.status(400).json({ error: '请写一句动态，或上传图片/视频' });
  const classification = classifyCityFeed([body, city, area].filter(Boolean).join(' '));
  const title = cleanText(req.body?.title || body.split(/[。！？!?\n]/)[0] || classification.category_label, 80);
  const unsafe = publicContentViolation([title, body, city, area].filter(Boolean).join(' '));
  if (unsafe) return res.status(400).json({ error: '公共区域禁止发布色情、暴力或违法内容' });
  const rows = await supa('huaban_social_circle_posts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      author_code: authorCode,
      post_type: classification.post_type,
      title,
      body,
      city,
      area,
      location_lat: Number(req.body?.lat || req.body?.location_lat || 0) || null,
      location_lng: Number(req.body?.lng || req.body?.location_lng || 0) || null,
      visibility,
      status: unsafe ? 'submitted' : 'published',
      moderation_status: unsafe ? 'needs_review' : 'approved',
      fields: {
        source: 'nearby_city_feed',
        author_phone: phone,
        author_name: cleanText(req.body?.author_name || '', 120),
        author_avatar: cleanText(req.body?.author_avatar || '', 800),
        ai_category: classification.category_label,
        ai_category_code: classification.category_code,
        ai_tags: classification.tags,
        media,
        media_count: media.length,
        unsafe_hint: unsafe ? 'needs_manual_review' : '',
        match_hint: '同城优先，按位置、标签、需求和服务范围逐步匹配'
      }
    })
  }).catch(error => {
    throw new Error(cityFeedTableError(error));
  });
  const post = Array.isArray(rows) ? rows[0] : rows;
  return res.status(200).json({ ok: true, post, classification });
}

async function listCityFeedPosts(req, res) {
  const city = cleanText(req.body?.city || req.query?.city || '', 80);
  const type = cleanText(req.body?.post_type || req.query?.post_type || '', 40);
  const keyword = cleanText(req.body?.keyword || req.query?.keyword || '', 80).toLowerCase();
  const category = cleanText(req.body?.category || req.query?.category || '', 40);
  const sort = cleanText(req.body?.sort || req.query?.sort || 'latest', 20);
  const status = 'published';
  if (!city) {
    return res.status(200).json({
      ok: true,
      posts: [],
      scope_required: true,
      scope: { level: 'city', city: '' },
      message: '请先选择城市'
    });
  }
  const order = sort === 'oldest' ? 'created_at.asc' : 'created_at.desc';
  let path = `huaban_social_circle_posts?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&status=eq.${status}&moderation_status=eq.approved&visibility=in.(city,nearby,public)&order=${order}&limit=80&select=*`;
  path += `&city=eq.${encodeURIComponent(city)}`;
  if (type && ['note', 'activity', 'nearby_help', 'resource', 'service_intro'].includes(type)) {
    path += `&post_type=eq.${encodeURIComponent(type)}`;
  }
  const rows = await supa(path).catch(error => {
    throw new Error(cityFeedTableError(error));
  });
  let posts = Array.isArray(rows) ? rows : [];
  const categoryKeywords = {
    travel: ['出行', '接送', '机场', '拼车', '包车', '旅游', '行程'],
    school: ['学校', '兴趣', '中文', '补习', '课程', '孩子', '家教'],
    merchant: ['商家', '店', '餐厅', '超市', '亚超', '生意', '服务'],
    all: []
  };
  const needles = [
    keyword,
    ...(categoryKeywords[category] || [])
  ].filter(Boolean);
  if (needles.length) {
    posts = posts.filter(row => {
      const fields = row.fields || {};
      const haystack = [
        row.title,
        row.body,
        row.city,
        row.area,
        row.post_type,
        fields.ai_category,
        fields.ai_category_code,
        ...(Array.isArray(fields.ai_tags) ? fields.ai_tags : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return needles.some(word => haystack.includes(String(word).toLowerCase()));
    });
  }
  posts = posts.slice(0, 30);
  return res.status(200).json({
    ok: true,
    posts,
    scope: { level: 'city', city }
  });
}

async function updateCityFeedPost(req, res) {
  const { codes, requestedCode } = await authCodeContext(req, 'sender_code');
  const actorCode = cleanCode(codes[0] || requestedCode);
  const postId = cleanText(req.body?.post_id || req.body?.id || '', 80);
  if (!postId) return res.status(400).json({ error: '缺少动态' });
  const rows = await supa(`huaban_social_circle_posts?id=eq.${encodeURIComponent(postId)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}&limit=1&select=*`).catch(error => {
    throw new Error(cityFeedTableError(error));
  });
  const post = Array.isArray(rows) ? rows[0] : null;
  if (!post) return res.status(404).json({ error: '动态不存在' });
  if (cleanCode(post.author_code || '') !== actorCode) return res.status(403).json({ error: '只能编辑自己的动态' });

  const body = cleanText(req.body?.body || req.body?.text || post.body || '', 1200);
  const city = cleanText(req.body?.city || post.city || '', 80);
  const area = cleanText(req.body?.area || post.area || '', 120);
  const media = cleanCityFeedMedia(req.body?.media || []);
  if (!body && !media.length) return res.status(400).json({ error: '请保留配文，或上传图片/视频' });
  const classification = classifyCityFeed([body, city, area].filter(Boolean).join(' '));
  const title = cleanText(req.body?.title || body.split(/[。！？!?\n]/)[0] || classification.category_label, 80);
  if (publicContentViolation([title, body, city, area].filter(Boolean).join(' '))) {
    return res.status(400).json({ error: '公共区域禁止发布色情、暴力或违法内容' });
  }
  const fields = post.fields && typeof post.fields === 'object' ? post.fields : {};
  const updated = await supa(`huaban_social_circle_posts?id=eq.${encodeURIComponent(postId)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      post_type: classification.post_type,
      title,
      body,
      city,
      area,
      status: 'published',
      moderation_status: 'approved',
      fields: {
        ...fields,
        ai_category: classification.category_label,
        ai_category_code: classification.category_code,
        ai_tags: classification.tags,
        media,
        media_count: media.length,
        edited_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    })
  }).catch(error => {
    throw new Error(cityFeedTableError(error));
  });
  return res.status(200).json({ ok: true, post: Array.isArray(updated) ? updated[0] : updated, classification });
}

async function deleteCityFeedPost(req, res) {
  const { codes, requestedCode } = await authCodeContext(req, 'sender_code');
  const actorCode = cleanCode(codes[0] || requestedCode);
  const postId = cleanText(req.body?.post_id || req.body?.id || '', 80);
  if (!postId) return res.status(400).json({ error: '缺少动态' });
  const rows = await supa(`huaban_social_circle_posts?id=eq.${encodeURIComponent(postId)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}&limit=1&select=id,author_code,fields`).catch(error => {
    throw new Error(cityFeedTableError(error));
  });
  const post = Array.isArray(rows) ? rows[0] : null;
  if (!post) return res.status(404).json({ error: '动态不存在' });
  if (cleanCode(post.author_code || '') !== actorCode) return res.status(403).json({ error: '只能删除自己的动态' });
  const fields = post.fields && typeof post.fields === 'object' ? post.fields : {};
  await supa(`huaban_social_circle_posts?id=eq.${encodeURIComponent(postId)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'deleted',
      fields: {
        ...fields,
        deleted_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    })
  }).catch(error => {
    throw new Error(cityFeedTableError(error));
  });
  return res.status(200).json({ ok: true });
}

async function searchNearbyPeople(req, res) {
  const { phone, codes } = await authCodeContext(req, 'sender_code');
  const city = cleanText(req.body?.city || req.query?.city || '', 80);
  const keyword = cleanText(req.body?.keyword || req.body?.q || req.query?.keyword || '', 80);
  const gender = cleanText(req.body?.gender || req.query?.gender || '', 30);
  const radiusRaw = cleanText(req.body?.radius_km || req.body?.distance || req.query?.radius_km || '10', 20);
  const radiusKm = radiusRaw === 'city' ? null : Math.max(1, Math.min(100, Number(radiusRaw) || 10));
  const viewer = {
    lat: toNumber(req.body?.lat || req.query?.lat),
    lng: toNumber(req.body?.lng || req.query?.lng)
  };
  if (!city && (viewer.lat === null || viewer.lng === null)) {
    return res.status(200).json({
      ok: true,
      people: [],
      scope_required: true,
      message: '请先定位或选择城市'
    });
  }
  let path = `huaban_accounts?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&status=eq.active&order=created_at.desc&limit=300&select=friend_code,display_name,fields,created_at`;
  const rows = await supa(path).catch(error => {
    throw new Error(/Could not find the table|schema cache|PGRST205/i.test(error?.message || '') ? '附近的人需要身份表：huaban_accounts' : error.message);
  });
  const mine = new Set(codes.map(cleanCode));
  const people = (Array.isArray(rows) ? rows : [])
    .filter(row => {
      const fields = row?.fields && typeof row.fields === 'object' ? row.fields : {};
      return fields.nearby_visible === true && toNumber(fields.location_lat) !== null && toNumber(fields.location_lng) !== null;
    })
    .map(row => nearbyPersonFromAccount(row, viewer))
    .filter(person => person.code && !mine.has(person.code))
    .filter(person => {
      if (city && person.city && person.city !== city) return false;
      if (city && !person.city && person.distance_km === null) return false;
      if (gender) {
        const raw = rows.find(row => cleanCode(row.friend_code) === person.code);
        const fields = raw?.fields && typeof raw.fields === 'object' ? raw.fields : {};
        if (cleanText(fields.gender || '', 30) !== gender) return false;
      }
      if (radiusKm !== null && person.distance_km !== null && person.distance_km > radiusKm) return false;
      if (!nearbyMatchesKeyword(person, keyword)) return false;
      return true;
    })
    .sort((a, b) => {
      const da = a.distance_km === null ? Number.POSITIVE_INFINITY : a.distance_km;
      const db = b.distance_km === null ? Number.POSITIVE_INFINITY : b.distance_km;
      if (da !== db) return da - db;
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    })
    .slice(0, 30);
  return res.status(200).json({
    ok: true,
    people,
    scope: {
      city,
      radius_km: radiusKm,
      sorted_by: 'distance_asc',
      viewer_has_location: viewer.lat !== null && viewer.lng !== null,
      phone
    }
  });
}

async function reportCityFeedPost(req, res) {
  const { codes, requestedCode } = await authCodeContext(req, 'actor_code');
  const postId = cleanText(req.body?.post_id || '', 80);
  if (!postId) return res.status(400).json({ error: '缺少动态' });
  await supa('huaban_social_circle_reports', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      post_id: postId,
      reporter_code: codes[0] || requestedCode,
      reason: cleanText(req.body?.reason || '用户举报', 200),
      status: 'open',
      fields: {
        source: 'nearby_city_feed',
        detail: cleanText(req.body?.detail || '', 1000)
      }
    })
  }).catch(error => {
    throw new Error(cityFeedTableError(error));
  });
  return res.status(200).json({ ok: true });
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    if (req.method === 'GET') return listDemand(req, res);
    if (req.method === 'PATCH') return updateDemand(req, res);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (String(req.body?.action || '') === 'submit_lead') return submitLead(req, res);
    if (String(req.body?.action || '') === 'register_emergency_helper') return registerEmergencyHelper(req, res);
    if (String(req.body?.action || '') === 'provider_contact_request') return createProviderContactRequest(req, res);
    if (String(req.body?.action || '') === 'call_start') return startCallSession(req, res);
    if (String(req.body?.action || '') === 'call_poll') return pollCallSession(req, res);
    if (String(req.body?.action || '') === 'call_signal') return signalCallSession(req, res);
    if (String(req.body?.action || '') === 'friend_message_send') return sendFriendMessage(req, res);
    if (String(req.body?.action || '') === 'friend_message_poll') return pollFriendMessages(req, res);
    if (String(req.body?.action || '') === 'friend_message_read') return markFriendMessagesRead(req, res);
    if (String(req.body?.action || '') === 'temp_conversation_reply') return replyTempConversation(req, res);
    if (String(req.body?.action || '') === 'temp_conversation_read') return markTempConversationRead(req, res);
    if (String(req.body?.action || '') === 'temp_service_completion_confirm') return confirmTempServiceCompletion(req, res);
    if (String(req.body?.action || '') === 'city_feed_create') return createCityFeedPost(req, res);
    if (String(req.body?.action || '') === 'city_feed_list') return listCityFeedPosts(req, res);
    if (String(req.body?.action || '') === 'city_feed_update') return updateCityFeedPost(req, res);
    if (String(req.body?.action || '') === 'city_feed_delete') return deleteCityFeedPost(req, res);
    if (String(req.body?.action || '') === 'city_feed_report') return reportCityFeedPost(req, res);
    if (String(req.body?.action || '') === 'nearby_people_search') return searchNearbyPeople(req, res);
    if (String(req.body?.action || '') === 'create_transaction_contract') return createTransactionContract(req, res);
    if (String(req.body?.action || '') === 'confirm_transaction') return confirmTransaction(req, res);
    return createDemand(req, res);
  } catch (error) {
    console.error('demand-cards error', error);
    return res.status(500).json({ error: error.message || '需求记录处理失败' });
  }
};
