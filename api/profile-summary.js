const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SUPA_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2N2cG1nZmp2bW1ra2Jzd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc4NzAsImV4cCI6MjA5NTgyMzg3MH0.ExUNuOP8YyHQmItY6cdl1Euj7nOXqQq-rQT5-7aNerE';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const RELEASE_STAGE = Math.max(1, Math.min(8, Number(process.env.HUABAN_RELEASE_STAGE || 1) || 1));

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function normalizePhone(phone = '') {
  let raw = String(phone || '').replace(/[\s().-]/g, '').trim();
  if (!raw) return '';
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  if (raw.startsWith('+')) return `+${raw.slice(1).replace(/\D/g, '')}`;
  const digits = raw.replace(/\D/g, '');
  if (/^04\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^4\d{8}$/.test(digits)) return `+61${digits}`;
  if (/^61\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}

function code(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
}

function uniqueCodes(list = []) {
  const seen = new Set();
  return list.map(code).filter(item => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function inList(values = []) {
  return uniqueCodes(values).join(',');
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
    const body = await res.text().catch(() => '');
    throw new Error(body || `Supabase ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function getAuthUser(accessToken = '') {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('手机号登录状态已失效，请重新验证');
  return res.json();
}

function safeFriend(row = {}) {
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
  const friend = fields.friend && typeof fields.friend === 'object' ? fields.friend : {};
  return {
    code: code(row.friend_code || friend.code || ''),
    name: String(row.friend_name || friend.name || '').slice(0, 80),
    phone: String(row.friend_phone || '').slice(0, 40),
    industry: String(row.friend_industry || '').slice(0, 80),
    avatar: String(row.friend_avatar || '👤').slice(0, 800),
    city: String(friend.city || fields.city || '').slice(0, 80),
    country: String(friend.country || fields.country || fields.country_code || '').slice(0, 80),
    address: String(friend.address || fields.location_address || '').slice(0, 220),
    source: String(row.source || 'friendship_sync').slice(0, 60),
    addedAt: row.created_at || ''
  };
}

function safeFriendRequest(row = {}) {
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
  const requester = fields.requester && typeof fields.requester === 'object' ? fields.requester : {};
  return {
    code: code(row.friend_code || requester.code || ''),
    name: String(row.friend_name || requester.name || '').slice(0, 80),
    phone: String(row.friend_phone || requester.phone || '').slice(0, 40),
    industry: String(row.friend_industry || requester.industry || '').slice(0, 80),
    avatar: String(row.friend_avatar || requester.avatar || '👤').slice(0, 800),
    city: String(requester.city || fields.city || '').slice(0, 80),
    country: String(requester.country || fields.country || fields.country_code || '').slice(0, 80),
    source: String(row.source || 'friend_request').slice(0, 60),
    created_at: row.created_at || '',
    fields
  };
}

function isGenericFriendName(value = '') {
  const clean = String(value || '').trim();
  return !clean || /^华伴用户$/i.test(clean) || /^华伴好友\s+[A-Z0-9_-]+$/i.test(clean);
}

function preferName(next = '', old = '') {
  const n = String(next || '').trim();
  const o = String(old || '').trim();
  if (n && !isGenericFriendName(n)) return n;
  if (o && !isGenericFriendName(o)) return o;
  return n || o;
}

function mergeFriendAccount(friend = {}, account = {}) {
  const fields = account.fields && typeof account.fields === 'object' ? account.fields : {};
  const name = String(account.display_name || fields.display_name || '').trim();
  const phone = String(account.primary_phone || account.normalized_phone || fields.phone || '').trim();
  const industry = String(fields.industry || account.industry || '').trim();
  const avatar = String(fields.avatar || account.avatar || '').trim();
  const city = String(fields.city || '').trim();
  const country = String(fields.country || fields.country_code || '').trim();
  const address = String(fields.location_address || '').trim();
  return {
    ...friend,
    name: preferName(name, friend.name),
    phone: friend.phone || phone,
    industry: friend.industry || industry,
    avatar: friend.avatar && friend.avatar !== '👤' ? friend.avatar : (avatar || friend.avatar || '👤'),
    city: friend.city || city,
    country: friend.country || country,
    address: friend.address || address
  };
}

function mergeFriendIdentity(friend = {}, identity = {}) {
  const fields = identity.fields && typeof identity.fields === 'object' ? identity.fields : {};
  const name = String(identity.display_name || fields.display_name || '').trim();
  const phone = String(identity.phone || identity.normalized_phone || fields.phone || '').trim();
  const industry = String(identity.industry || fields.industry || '').trim();
  const avatar = String(identity.avatar || fields.avatar || '').trim();
  const city = String(fields.city || '').trim();
  const country = String(fields.country || fields.country_code || '').trim();
  const address = String(fields.location_address || fields.address || '').trim();
  return {
    ...friend,
    name: preferName(name, friend.name),
    phone: friend.phone || phone,
    industry: friend.industry || industry,
    avatar: friend.avatar && friend.avatar !== '👤' ? friend.avatar : (avatar || friend.avatar || '👤'),
    city: friend.city || city,
    country: friend.country || country,
    address: friend.address || address
  };
}

function safeOrder(row = {}) {
  return {
    id: row.id || '',
    title: row.title || row.service_title || row.need_type || '交易订单',
    status: row.status || '',
    price_text: row.price_text || row.budget || '',
    created_at: row.created_at || ''
  };
}

function safeTempMessage(row = {}) {
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
  return {
    id: row.id || '',
    conversation_id: row.conversation_id || '',
    sender_role: row.sender_role || '',
    sender_code: code(row.sender_code || ''),
    recipient_code: code(row.recipient_code || ''),
    message_type: row.message_type || 'text',
    body: String(row.body || '').slice(0, 1000),
    voice_url: String(fields.voice_url || row.voice_url || ''),
    voice_duration_seconds: Number(fields.voice_duration_seconds || row.voice_duration_seconds || 0) || 0,
    delivery_status: row.delivery_status || '',
    created_at: row.created_at || '',
    fields
  };
}

function safeFriendMessage(row = {}, identityCodes = []) {
  const senderCode = code(row.sender_code || '');
  const recipientCode = code(row.recipient_code || '');
  const mine = new Set(identityCodes);
  return {
    id: row.id || '',
    sender_code: senderCode,
    recipient_code: recipientCode,
    mine: mine.has(senderCode),
    message_type: row.message_type || 'text',
    body: String(row.body || '').slice(0, 1000),
    voice_url: String(row.voice_url || ''),
    voice_duration_seconds: Number(row.voice_duration_seconds || 0) || 0,
    delivery_status: row.delivery_status || '',
    read_at: row.read_at || '',
    created_at: row.created_at || '',
    local_time_text: row.local_time_text || '',
    local_timezone: row.local_timezone || '',
    fields: row.fields || {}
  };
}

function safeTempConversation(row = {}, messagesByConversation = new Map(), notificationsByConversation = new Map(), identityCodes = []) {
  const requesterCode = code(row.requester_code || '');
  const providerCode = code(row.provider_code || '');
  const mine = new Set(identityCodes);
  const myRole = mine.has(providerCode) ? 'provider' : mine.has(requesterCode) ? 'requester' : '';
  const otherCode = myRole === 'provider' ? requesterCode : providerCode;
  const notification = notificationsByConversation.get(row.id) || null;
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
  const completion = fields.completion && typeof fields.completion === 'object' ? fields.completion : {};
  const requesterConfirmed = Boolean(completion.requester_confirmed_at);
  const providerConfirmed = Boolean(completion.provider_confirmed_at);
  const myConfirmed = myRole === 'requester' ? requesterConfirmed : myRole === 'provider' ? providerConfirmed : false;
  const otherConfirmed = myRole === 'requester' ? providerConfirmed : myRole === 'provider' ? requesterConfirmed : false;
  return {
    id: row.id || '',
    demand_id: row.demand_id || '',
    supply_profile_id: row.supply_profile_id || '',
    requester_code: requesterCode,
    provider_code: providerCode,
    my_role: myRole,
    other_code: otherCode,
    provider_name: String(row.provider_name || '').slice(0, 120),
    service_type: String(row.service_type || '本地服务').slice(0, 120),
    city: String(row.city || '').slice(0, 80),
    contact_mode: row.contact_mode || 'message',
    status: row.status || 'open',
    completion: {
      status: completion.status || '',
      requester_confirmed: requesterConfirmed,
      provider_confirmed: providerConfirmed,
      my_confirmed: myConfirmed,
      other_confirmed: otherConfirmed,
      both_confirmed: requesterConfirmed && providerConfirmed,
      point_action_key: completion.point_action_key || '',
      point_status: completion.point_status || ''
    },
    opened_at: row.opened_at || row.created_at || '',
    last_message_at: row.last_message_at || row.created_at || '',
    expires_at: row.expires_at || '',
    notification: notification ? {
      id: notification.id || '',
      title: notification.title || '',
      body: notification.body || '',
      status: notification.status || '',
      action_text: notification.action_text || '',
      created_at: notification.created_at || '',
      sound_type: notification.fields?.sound_type || '',
      native_app_push: notification.fields?.native_app_push === true,
      vibrate: notification.fields?.vibrate === true
    } : null,
    messages: messagesByConversation.get(row.id) || []
  };
}

function cleanText(value = '', max = 1000) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
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
  const matched = CITY_FEED_RULES.find(rule => rule.tags.some(tag => body.includes(String(tag).toLowerCase()))) || CITY_FEED_RULES[CITY_FEED_RULES.length - 1];
  const tags = new Set([matched.label]);
  if (/找|哪里|有没有|求|需要/.test(body)) tags.add('需求');
  if (/提供|可做|接单|出售|有货|店|服务/.test(body)) tags.add('供给');
  if (/墨尔本|melbourne/i.test(body)) tags.add('墨尔本');
  if (/悉尼|sydney/i.test(body)) tags.add('悉尼');
  return {
    post_type: matched.type,
    category_label: matched.label,
    category_code: matched.type,
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

function cityFeedTableError(error) {
  return /Could not find the table|schema cache|PGRST205|huaban_social_circle_posts/i.test(error?.message || '')
    ? '同城动态表尚未创建：huaban_social_circle_posts'
    : (error?.message || '同城动态处理失败');
}

function publicContentViolation(text = '') {
  return /(色情|裸聊|成人视频|成人内容|成人网站|黄图|约炮|性服务|卖淫|嫖娼|毒品|枪支|洗钱|假证|网赌|博彩|盘口|暴力威胁|血腥|砍人|杀人|打死|持刀伤人)/i.test(String(text || ''));
}

async function handleCityFeedAction(action = '', body = {}, context = {}) {
  const authorCode = code(context.canonicalCode || context.identityCodes?.[0] || body.sender_code || '');
  if (!authorCode) throw new Error('请先完成手机号验证');
  if (action === 'city_feed_create') {
    const postBody = cleanText(body.body || body.text || '', 1200);
    const city = cleanText(body.city || '', 80);
    const area = cleanText(body.area || '', 120);
    const visibility = ['nearby', 'city', 'public'].includes(cleanText(body.visibility || '', 20)) ? cleanText(body.visibility || '', 20) : 'city';
    const media = cleanCityFeedMedia(body.media || []);
    if (!postBody && !media.length) throw new Error('请写一句动态，或上传图片/视频');
    const classification = classifyCityFeed([postBody, city, area].filter(Boolean).join(' '));
    const title = cleanText(body.title || postBody.split(/[。！？!?\n]/)[0] || classification.category_label, 80);
    if (publicContentViolation([title, postBody, city, area].filter(Boolean).join(' '))) throw new Error('公共区域禁止发布色情、暴力或违法内容');
    const rows = await supa('huaban_social_circle_posts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        author_code: authorCode,
        post_type: classification.post_type,
        title,
        body: postBody,
        city,
        area,
        location_lat: Number(body.lat || body.location_lat || 0) || null,
        location_lng: Number(body.lng || body.location_lng || 0) || null,
        visibility,
        status: 'published',
        moderation_status: 'approved',
        fields: {
          source: 'nearby_city_feed',
          author_phone: context.phone || '',
          author_name: cleanText(body.author_name || '', 120),
          author_avatar: cleanText(body.author_avatar || '', 800),
          ai_category: classification.category_label,
          ai_category_code: classification.category_code,
          ai_tags: classification.tags,
          media,
          media_count: media.length
        }
      })
    }).catch(error => { throw new Error(cityFeedTableError(error)); });
    return { ok: true, post: Array.isArray(rows) ? rows[0] : rows, classification };
  }
  if (action === 'city_feed_list') {
    const city = cleanText(body.city || '', 80);
    const keyword = cleanText(body.keyword || '', 80).toLowerCase();
    const category = cleanText(body.category || '', 40);
    const sort = cleanText(body.sort || 'latest', 20);
    if (!city) return { ok: true, posts: [], scope_required: true, scope: { level: 'city', city: '' }, message: '请先选择城市' };
    const order = sort === 'oldest' ? 'created_at.asc' : 'created_at.desc';
    let path = `huaban_social_circle_posts?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&status=eq.published&moderation_status=eq.approved&visibility=in.(city,nearby,public)&city=eq.${encodeURIComponent(city)}&order=${order}&limit=80&select=*`;
    const rows = await supa(path).catch(error => { throw new Error(cityFeedTableError(error)); });
    let posts = Array.isArray(rows) ? rows : [];
    const categoryKeywords = {
      travel: ['出行', '接送', '机场', '拼车', '包车', '旅游', '行程'],
      school: ['学校', '兴趣', '中文', '补习', '课程', '孩子', '家教'],
      merchant: ['商家', '店', '餐厅', '超市', '亚超', '生意', '服务'],
      all: []
    };
    const needles = [keyword, ...(categoryKeywords[category] || [])].filter(Boolean);
    if (needles.length) {
      posts = posts.filter(row => {
        const fields = row.fields || {};
        const haystack = [row.title, row.body, row.city, row.area, row.post_type, fields.ai_category, fields.ai_category_code, ...(Array.isArray(fields.ai_tags) ? fields.ai_tags : [])].filter(Boolean).join(' ').toLowerCase();
        return needles.some(word => haystack.includes(String(word).toLowerCase()));
      });
    }
    return { ok: true, posts: posts.slice(0, 30), scope: { level: 'city', city } };
  }
  if (action === 'city_feed_update') {
    const postId = cleanText(body.post_id || body.id || '', 80);
    if (!postId) throw new Error('缺少动态');
    const rows = await supa(`huaban_social_circle_posts?id=eq.${encodeURIComponent(postId)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}&limit=1&select=*`).catch(error => { throw new Error(cityFeedTableError(error)); });
    const post = Array.isArray(rows) ? rows[0] : null;
    if (!post) throw new Error('动态不存在');
    if (code(post.author_code || '') !== authorCode) throw new Error('只能编辑自己的动态');
    const postBody = cleanText(body.body || body.text || post.body || '', 1200);
    const city = cleanText(body.city || post.city || '', 80);
    const area = cleanText(body.area || post.area || '', 120);
    const media = cleanCityFeedMedia(body.media || []);
    if (!postBody && !media.length) throw new Error('请保留配文，或上传图片/视频');
    const classification = classifyCityFeed([postBody, city, area].filter(Boolean).join(' '));
    const title = cleanText(body.title || postBody.split(/[。！？!?\n]/)[0] || classification.category_label, 80);
    if (publicContentViolation([title, postBody, city, area].filter(Boolean).join(' '))) throw new Error('公共区域禁止发布色情、暴力或违法内容');
    const fields = post.fields && typeof post.fields === 'object' ? post.fields : {};
    const updated = await supa(`huaban_social_circle_posts?id=eq.${encodeURIComponent(postId)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        post_type: classification.post_type,
        title,
        body: postBody,
        city,
        area,
        status: 'published',
        moderation_status: 'approved',
        fields: { ...fields, ai_category: classification.category_label, ai_category_code: classification.category_code, ai_tags: classification.tags, media, media_count: media.length, edited_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
    }).catch(error => { throw new Error(cityFeedTableError(error)); });
    return { ok: true, post: Array.isArray(updated) ? updated[0] : updated, classification };
  }
  if (action === 'city_feed_delete') {
    const postId = cleanText(body.post_id || body.id || '', 80);
    if (!postId) throw new Error('缺少动态');
    const rows = await supa(`huaban_social_circle_posts?id=eq.${encodeURIComponent(postId)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}&limit=1&select=id,author_code,fields`).catch(error => { throw new Error(cityFeedTableError(error)); });
    const post = Array.isArray(rows) ? rows[0] : null;
    if (!post) throw new Error('动态不存在');
    if (code(post.author_code || '') !== authorCode) throw new Error('只能删除自己的动态');
    const fields = post.fields && typeof post.fields === 'object' ? post.fields : {};
    await supa(`huaban_social_circle_posts?id=eq.${encodeURIComponent(postId)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'deleted', fields: { ...fields, deleted_at: new Date().toISOString() }, updated_at: new Date().toISOString() })
    }).catch(error => { throw new Error(cityFeedTableError(error)); });
    return { ok: true };
  }
  if (action === 'city_feed_report') {
    const postId = cleanText(body.post_id || '', 80);
    if (!postId) throw new Error('缺少动态');
    await supa('huaban_social_circle_reports', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: TENANT_ID, post_id: postId, reporter_code: authorCode, reason: cleanText(body.reason || '用户举报', 200), status: 'open', fields: { source: 'nearby_city_feed', detail: cleanText(body.detail || '', 1000) } })
    }).catch(error => { throw new Error(cityFeedTableError(error)); });
    return { ok: true };
  }
  return null;
}

async function handleFriendMessageAction(action = '', body = {}, context = {}) {
  const owner = code(context.canonicalCode || context.identityCodes?.[0] || body.sender_code || body.recipient_code || '');
  const friend = code(body.friend_code || body.recipient_code || '');
  if (!owner) throw new Error('缺少当前用户身份');
  if (!friend) throw new Error('缺少好友身份');
  if (action === 'friend_message_send') {
    const messageType = cleanText(body.message_type || 'text', 30) || 'text';
    const inserted = await supa('huaban_friend_messages?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        sender_code: owner,
        recipient_code: friend,
        message_type: messageType,
        body: cleanText(body.body || '', 4000),
        voice_url: cleanText(body.voice_url || '', 300000),
        voice_duration_seconds: Number(body.voice_duration_seconds || 0) || 0,
        delivery_status: 'unread',
        local_time_text: cleanText(body.local_time_text || '', 80) || null,
        local_timezone: cleanText(body.local_timezone || '', 80) || null,
        fields: {
          sender_name: cleanText(body.sender_name || '', 80),
          sender_avatar: cleanText(body.sender_avatar || '', 1200),
          source: 'profile_summary_friend_message'
        }
      })
    });
    return { ok: true, message: Array.isArray(inserted) ? inserted[0] : inserted };
  }
  if (action === 'friend_message_poll') {
    const rows = await supa(`huaban_friend_messages?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&or=(sender_code.eq.${encodeURIComponent(owner)},recipient_code.eq.${encodeURIComponent(owner)})&order=created_at.desc&limit=${Math.min(200, Math.max(20, Number(body.limit || 100) || 100))}&select=id,sender_code,recipient_code,message_type,body,voice_url,voice_duration_seconds,delivery_status,read_at,local_time_text,local_timezone,fields,created_at`);
    const messages = (Array.isArray(rows) ? rows : [])
      .filter(row => code(row.sender_code) === friend || code(row.recipient_code) === friend)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    return { ok: true, messages };
  }
  if (action === 'friend_message_read') {
    await supa(`huaban_friend_messages?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&sender_code=eq.${encodeURIComponent(friend)}&recipient_code=eq.${encodeURIComponent(owner)}&delivery_status=neq.read`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ delivery_status: 'read', read_at: new Date().toISOString() })
    }).catch(() => null);
    return { ok: true };
  }
  return null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    const body = req.body || {};
    const accessToken = String(body.accessToken || '').trim();
    if (!accessToken) return res.status(401).json({ error: '请先完成手机号验证' });
    const authUser = await getAuthUser(accessToken);
    const phone = normalizePhone(authUser.phone || body.phone || '');
    if (!authUser.id || !phone) return res.status(401).json({ error: '手机号登录状态无效' });

    const localCodes = [body.friendCode, ...(Array.isArray(body.identityCodes) ? body.identityCodes : [])];
    const verifiedCodes = [];
    const legacyPhoneCodes = [];
    const accounts = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&status=eq.active&order=created_at.asc&limit=20&select=id,account_uid,friend_code,display_name,primary_phone,phone_verified_at,fields`).catch(error => {
      throw new Error(/schema cache|Could not find the table|PGRST205/i.test(error.message) ? '数据库身份表未创建：huaban_accounts' : error.message);
    });
    (Array.isArray(accounts) ? accounts : []).forEach(row => {
      verifiedCodes.push(row.friend_code);
      verifiedCodes.push(row.fields?.canonical_friend_code);
    });

    const links = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&status=eq.active&order=created_at.asc&limit=120&select=friend_code,fields`).catch(error => {
      throw new Error(/schema cache|Could not find the table|PGRST205/i.test(error.message) ? '数据库身份表未创建：huaban_identity_links' : error.message);
    });
    (Array.isArray(links) ? links : []).forEach(row => {
      verifiedCodes.push(row.friend_code);
      verifiedCodes.push(row.fields?.canonical_friend_code);
    });

    const friendPhoneRows = await supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&friend_phone=eq.${encodeURIComponent(phone)}&status=eq.active&order=created_at.desc&limit=500&select=friend_code,fields`).catch(() => []);
    (Array.isArray(friendPhoneRows) ? friendPhoneRows : []).forEach(row => {
      legacyPhoneCodes.push(row.friend_code);
      legacyPhoneCodes.push(row.fields?.friend?.code);
    });

    const inviterPhoneRows = await supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&inviter_phone=eq.${encodeURIComponent(phone)}&status=eq.confirmed&order=created_at.desc&limit=500&select=inviter_code,direct_referrer_code,fields`).catch(() => []);
    (Array.isArray(inviterPhoneRows) ? inviterPhoneRows : []).forEach(row => {
      legacyPhoneCodes.push(row.inviter_code);
      legacyPhoneCodes.push(row.direct_referrer_code);
      legacyPhoneCodes.push(row.fields?.direct_referrer_code);
    });

    const refereePhoneRows = await supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&referee_phone=eq.${encodeURIComponent(phone)}&status=eq.confirmed&order=created_at.desc&limit=500&select=referee_code,fields`).catch(() => []);
    (Array.isArray(refereePhoneRows) ? refereePhoneRows : []).forEach(row => {
      legacyPhoneCodes.push(row.referee_code);
      legacyPhoneCodes.push(row.fields?.referee?.code);
    });

    const identityCodes = uniqueCodes(verifiedCodes.length ? verifiedCodes : [...localCodes, ...legacyPhoneCodes]);
    const primaryAccount = Array.isArray(accounts) ? accounts[0] : null;
    const canonicalCode = code(primaryAccount?.friend_code || uniqueCodes(verifiedCodes)[0] || identityCodes[0] || '');
    const release = {
      stage: RELEASE_STAGE,
      rights_multiplier: Math.pow(2, RELEASE_STAGE - 1)
    };

    let base = 0, direct = 0, second = 0, pending = 0;
    let pointsError = '';

    const ownerCodeList = inList(identityCodes);
    const pointOwnerCodeList = inList(canonicalCode ? [canonicalCode] : identityCodes);
    const action = String(body.action || '').toLowerCase();
    if (['city_feed_create', 'city_feed_list', 'city_feed_update', 'city_feed_delete', 'city_feed_report'].includes(action)) {
      const result = await handleCityFeedAction(action, body, { canonicalCode, identityCodes, phone });
      return res.status(200).json(result);
    }
    if (['friend_message_send', 'friend_message_poll', 'friend_message_read'].includes(action)) {
      const result = await handleFriendMessageAction(action, body, { canonicalCode, identityCodes });
      return res.status(200).json(result);
    }
    const seenEvents = new Set();
    let eventRows = [];
    if (pointOwnerCodeList) {
      try {
        eventRows = await supa(`huaban_point_events?tenant_id=eq.${TENANT_ID}&owner_code=in.(${pointOwnerCodeList})&order=created_at.desc&limit=1000&select=id,event_key,points,action,status,fields,related_code,created_at`);
      } catch (error) {
        pointsError = error.message || '积分账本读取失败';
        console.error('profile-summary point events error', error);
      }
    }
    (Array.isArray(eventRows) ? eventRows : []).forEach(row => {
      const eventId = String(row.event_key || row.id || '');
      if (eventId && seenEvents.has(eventId)) return;
      if (eventId) seenEvents.add(eventId);
      const pts = Number(row.points) || 0;
      const status = String(row.status || '').toLowerCase();
      const action = String(row.action || '');
      const refLevel = Number(row.fields?.ref_level || 0);
      const related = code(row.related_code || row.fields?.related_code || '');
      if (status === 'confirmed') {
        if (action === 'second_level_referral_verified' || refLevel === 2) second += pts;
        else if (action === 'direct_referral_verified' || refLevel === 1) direct += pts;
        else base += pts;
      } else pending += pts;
    });
    const pointEvents = (Array.isArray(eventRows) ? eventRows : []).slice(0, 50).map(row => ({
      id: row.id || '',
      event_key: row.event_key || '',
      action: row.action || '',
      status: row.status || '',
      points: Number(row.points) || 0,
      related_code: row.related_code || row.fields?.related_code || '',
      created_at: row.created_at || '',
      fields: row.fields || {}
    }));

    const pendingRemote = [];
    const friends = [];
    const seenFriends = new Set();
    let friendRequests = [];
    const pendingRows = ownerCodeList ? await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&inviter_code=in.(${ownerCodeList})&link_type=eq.pending_referral_invite&status=eq.active&order=created_at.desc&limit=1000&select=normalized_phone,phone,display_name`).catch(() => []) : [];
    if (Array.isArray(pendingRows)) pendingRemote.push(...pendingRows);
    const friendRows = ownerCodeList ? await supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&owner_code=in.(${ownerCodeList})&status=eq.active&order=created_at.desc&limit=1000&select=friend_code,friend_name,friend_phone,friend_industry,friend_avatar,source,created_at,fields`).catch(() => []) : [];
    (Array.isArray(friendRows) ? friendRows : []).map(safeFriend).forEach(friend => {
      if (!friend.code || seenFriends.has(friend.code)) return;
      seenFriends.add(friend.code);
      friends.push(friend);
    });
    const requestRows = ownerCodeList ? await supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&owner_code=in.(${ownerCodeList})&status=eq.pending&source=eq.manual_phone_friend_request&order=created_at.desc&limit=100&select=friend_code,friend_name,friend_phone,friend_industry,friend_avatar,source,created_at,fields`).catch(() => []) : [];
    friendRequests = (Array.isArray(requestRows) ? requestRows : []).map(safeFriendRequest).filter(item => item.code);
    const friendCodeList = inList(friends.map(friend => friend.code));
    if (friendCodeList) {
      const friendAccounts = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&friend_code=in.(${friendCodeList})&status=eq.active&select=friend_code,display_name,primary_phone,normalized_phone,fields`).catch(() => []);
      const accountsByCode = new Map();
      (Array.isArray(friendAccounts) ? friendAccounts : []).forEach(row => {
        const friendCode = code(row.friend_code || '');
        if (friendCode) accountsByCode.set(friendCode, row);
      });
      const friendIdentities = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&friend_code=in.(${friendCodeList})&status=eq.active&order=created_at.desc&limit=1000&select=friend_code,display_name,phone,normalized_phone,industry,avatar,fields,created_at`).catch(() => []);
      const identitiesByCode = new Map();
      (Array.isArray(friendIdentities) ? friendIdentities : []).forEach(row => {
        const friendCode = code(row.friend_code || '');
        if (!friendCode) return;
        const current = identitiesByCode.get(friendCode);
        if (!current || (!isGenericFriendName(row.display_name) && isGenericFriendName(current.display_name))) {
          identitiesByCode.set(friendCode, row);
        }
      });
      for (let i = 0; i < friends.length; i += 1) {
        const friendCode = code(friends[i].code || '');
        const account = accountsByCode.get(friendCode);
        const identity = identitiesByCode.get(friendCode);
        if (identity) friends[i] = mergeFriendIdentity(friends[i], identity);
        if (account) friends[i] = mergeFriendAccount(friends[i], account);
      }
      const friendMessageRows = ownerCodeList ? await supa(`huaban_friend_messages?tenant_id=eq.${TENANT_ID}&or=(sender_code.in.(${ownerCodeList}),recipient_code.in.(${ownerCodeList}))&order=created_at.desc&limit=300&select=id,sender_code,recipient_code,message_type,body,voice_url,voice_duration_seconds,delivery_status,read_at,local_time_text,local_timezone,fields,created_at`).catch(() => []) : [];
      const messagesByFriend = new Map();
      const unreadByFriend = new Map();
      const myCodes = new Set(identityCodes);
      const knownFriends = new Set(friends.map(item => code(item.code || '')).filter(Boolean));
      (Array.isArray(friendMessageRows) ? friendMessageRows : []).map(row => safeFriendMessage(row, identityCodes)).forEach(message => {
        const otherCode = myCodes.has(message.sender_code) ? message.recipient_code : message.sender_code;
        if (!knownFriends.has(otherCode)) return;
        const list = messagesByFriend.get(otherCode) || [];
        list.unshift(message);
        messagesByFriend.set(otherCode, list.slice(-30));
        if (!message.mine && message.delivery_status !== 'read') {
          unreadByFriend.set(otherCode, (unreadByFriend.get(otherCode) || 0) + 1);
        }
      });
      for (let i = 0; i < friends.length; i += 1) {
        const friendCode = code(friends[i].code || '');
        const messages = (messagesByFriend.get(friendCode) || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        friends[i] = {
          ...friends[i],
          unread_count: unreadByFriend.get(friendCode) || 0,
          latest_message: messages[messages.length - 1] || null,
          messages
        };
      }
    }

    const orderRows = await supa(`huaban_orders?tenant_id=eq.${TENANT_ID}&buyer_contact=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=8&select=id,title,service_title,need_type,status,price_text,budget,created_at`).catch(() => []);
    let tempConversations = [];
    if (ownerCodeList) {
      const convoRows = await supa(`huaban_temp_conversations?tenant_id=eq.${TENANT_ID}&or=(provider_code.in.(${ownerCodeList}),requester_code.in.(${ownerCodeList}))&status=in.(open,provider_replied,requester_replied)&order=last_message_at.desc.nullslast,created_at.desc&limit=20&select=id,demand_id,supply_profile_id,requester_code,requester_phone,provider_code,provider_name,service_type,service_type_code,city,contact_mode,status,opened_at,last_message_at,expires_at,fields,created_at`).catch(() => []);
      const conversationIds = (Array.isArray(convoRows) ? convoRows : []).map(row => row.id).filter(Boolean);
      const messagesByConversation = new Map();
      const notificationsByConversation = new Map();
      if (conversationIds.length) {
        const idParam = conversationIds.join(',');
        const messageRows = await supa(`huaban_temp_conversation_messages?tenant_id=eq.${TENANT_ID}&conversation_id=in.(${idParam})&order=created_at.asc&limit=200&select=id,conversation_id,sender_role,sender_code,recipient_code,message_type,body,delivery_status,fields,created_at`).catch(() => []);
        (Array.isArray(messageRows) ? messageRows : []).map(safeTempMessage).forEach(message => {
          const list = messagesByConversation.get(message.conversation_id) || [];
          list.push(message);
          messagesByConversation.set(message.conversation_id, list.slice(-20));
        });
        const notificationRows = await supa(`huaban_contact_notifications?tenant_id=eq.${TENANT_ID}&conversation_id=in.(${idParam})&recipient_code=in.(${ownerCodeList})&status=in.(unread,read)&order=created_at.desc&limit=100&select=id,conversation_id,title,body,status,action_text,fields,created_at`).catch(() => []);
        (Array.isArray(notificationRows) ? notificationRows : []).forEach(row => {
          if (!notificationsByConversation.has(row.conversation_id)) notificationsByConversation.set(row.conversation_id, row);
        });
      }
      tempConversations = (Array.isArray(convoRows) ? convoRows : []).map(row => safeTempConversation(row, messagesByConversation, notificationsByConversation, identityCodes));
    }

    return res.status(200).json({
      ok: true,
      phone,
      account: {
        id: primaryAccount?.id || '',
        account_uid: primaryAccount?.account_uid || authUser.id,
        friend_code: canonicalCode,
        display_name: primaryAccount?.display_name || '',
        primary_phone: primaryAccount?.primary_phone || phone,
        phone_verified_at: primaryAccount?.phone_verified_at || authUser.phone_confirmed_at || '',
        fields: primaryAccount?.fields || {},
        alias_count: Math.max(0, identityCodes.length - (canonicalCode ? 1 : 0))
      },
      canonicalCode,
      identityCodes,
      release,
      points: { total: base + direct + second + pending, base, direct, second, pending, pending_bind: pendingRemote.length, release_stage: release.stage, owner_code: canonicalCode, merged_alias_points: false, error: pointsError, events: pointEvents },
      friends,
      friend_requests: friendRequests,
      orders: (Array.isArray(orderRows) ? orderRows : []).map(safeOrder),
      temp_conversations: tempConversations,
      unread_temp_notifications: tempConversations.filter(item => item.notification?.status === 'unread').length,
      unread_friend_messages: friends.reduce((sum, item) => sum + (Number(item.unread_count || 0) || 0), 0)
    });
  } catch (error) {
    console.error('profile-summary error', error);
    return res.status(500).json({ error: error.message || '个人中心资料读取失败' });
  }
};
