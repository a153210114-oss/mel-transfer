const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';

const FALLBACK_RULES = {
  phone_signup_verified: { points: 30, audit_mode: 'system_verified', daily_limit: 1, monthly_limit: 1, action_name: '完成手机号注册' },
  profile_completed: { points: 20, audit_mode: 'system_verified', daily_limit: 1, monthly_limit: 1, action_name: '完善个人资料' },
  profile_card_created: { points: 30, audit_mode: 'system_verified', daily_limit: 1, monthly_limit: 1, action_name: '创建个人名片' },
  card_first_shared: { points: 10, audit_mode: 'system_verified', daily_limit: 1, monthly_limit: 20, action_name: '首次分享名片' },
  local_need_structured: { points: 10, audit_mode: 'system_verified', daily_limit: 10, monthly_limit: 120, action_name: '整理本地服务需求' },
  service_card_completed: { points: 80, audit_mode: 'review_required', daily_limit: 1, monthly_limit: 5, action_name: '完善服务名片' },
  service_completion_confirmed: { points: 50, audit_mode: 'review_required', daily_limit: 3, monthly_limit: 30, action_name: '双方确认完成一次真实服务' },
  direct_referral_verified: { points: 20, audit_mode: 'system_verified', daily_limit: 20, monthly_limit: 300, action_name: '一级推荐用户真实加入' },
  second_level_referral_verified: { points: 6, audit_mode: 'system_verified', daily_limit: 50, monthly_limit: 800, action_name: '二级推荐用户真实加入' }
};

function cleanCode(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
}

function cleanRelated(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_.:-]/g, '').trim().toUpperCase().slice(0, 120);
}

function cleanText(value = '', max = 240) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function statusFromAuditMode(mode = '') {
  return String(mode || '').toLowerCase() === 'system_verified' ? 'confirmed' : 'pending_review';
}

function eventKey({ ownerCode = '', actionKey = '', relatedCode = '' } = {}) {
  const owner = cleanCode(ownerCode);
  const related = cleanRelated(relatedCode || owner);
  const action = cleanText(actionKey, 80);
  return owner && action ? `huaban:${TENANT_ID}:${owner}:${action}:${related || owner}` : '';
}

async function supa(path, options = {}) {
  if (!SERVICE_KEY) throw new Error('Supabase service role key 未配置，无法写入积分账本');
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

async function getUsagePointRule(actionKey = '', options = {}) {
  const key = cleanText(actionKey, 80);
  const requireRemote = options.requireRemote === true;
  if (!key) return null;
  const rows = await supa(`huaban_usage_action_point_reward_rules?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&action_key=eq.${encodeURIComponent(key)}&status=eq.active&limit=1&select=action_key,action_name,points,audit_mode,daily_limit,monthly_limit,metadata`).catch(error => {
    if (requireRemote) throw error;
    return [];
  });
  const remote = Array.isArray(rows) ? rows[0] : null;
  const fallback = FALLBACK_RULES[key];
  if (requireRemote && !remote) return null;
  if (!remote && !fallback) return null;
  return { action_key: key, ...(fallback || {}), ...(remote || {}) };
}

async function getScenarioContract(scenarioKey = '', actionKey = '') {
  const scenario = cleanText(scenarioKey, 80);
  const action = cleanText(actionKey, 80);
  if (!scenario || !action) return null;
  const rows = await supa(`huaban_promotion_scenario_rules?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&scenario_key=eq.${encodeURIComponent(scenario)}&reward_action_key=eq.${encodeURIComponent(action)}&status=eq.active&limit=1&select=id,scenario_key,scenario_name,reward_action_key,ledger_owner_rule,idempotency_rule,status`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function existingPointByKey(key = '') {
  if (!key) return null;
  const rows = await supa(`huaban_point_events?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&event_key=eq.${encodeURIComponent(key)}&limit=1&select=id,points,status,event_key,action`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function limitReached({ ownerCode = '', actionKey = '', dailyLimit = null, monthlyLimit = null } = {}) {
  const owner = cleanCode(ownerCode);
  const action = cleanText(actionKey, 80);
  if (!owner || !action) return false;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (Number(dailyLimit) > 0) {
    const rows = await supa(`huaban_point_events?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&owner_code=eq.${encodeURIComponent(owner)}&action=eq.${encodeURIComponent(action)}&created_at=gte.${encodeURIComponent(dayStart)}&limit=${Number(dailyLimit)}&select=id`);
    if (Array.isArray(rows) && rows.length >= Number(dailyLimit)) return 'daily_limit';
  }
  if (Number(monthlyLimit) > 0) {
    const rows = await supa(`huaban_point_events?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&owner_code=eq.${encodeURIComponent(owner)}&action=eq.${encodeURIComponent(action)}&created_at=gte.${encodeURIComponent(monthStart)}&limit=${Number(monthlyLimit)}&select=id`);
    if (Array.isArray(rows) && rows.length >= Number(monthlyLimit)) return 'monthly_limit';
  }
  return false;
}

async function awardUsagePoint({ ownerCode = '', actionKey = '', relatedCode = '', reason = '', fields = {}, source = 'server' } = {}) {
  const owner = cleanCode(ownerCode);
  const action = cleanText(actionKey, 80);
  const related = cleanRelated(relatedCode || owner);
  if (!owner || !action) return { skipped: true, reason: 'missing_owner_or_action' };
  const scenarioKey = cleanText(fields.scenario_key || '', 80);
  if (!scenarioKey) return { skipped: true, reason: 'missing_scenario_key', action };
  const contract = await getScenarioContract(scenarioKey, action).catch(error => {
    if (/Could not find the table|schema cache|huaban_promotion_scenario_rules/i.test(error.message)) throw error;
    return null;
  });
  if (!contract) return { skipped: true, reason: 'missing_active_scenario_contract', action, scenario_key: scenarioKey };
  const rule = await getUsagePointRule(action, { requireRemote: true });
  if (!rule) return { skipped: true, reason: 'missing_active_point_rule', action };
  const rulePoints = Number(rule.points);
  if (!Number.isFinite(rulePoints)) return { skipped: true, reason: 'invalid_point_rule_points', action, scenario_key: scenarioKey };
  const key = eventKey({ ownerCode: owner, actionKey: action, relatedCode: related });
  const existing = await existingPointByKey(key).catch(error => {
    if (/Could not find the table|schema cache|huaban_point_events/i.test(error.message)) throw error;
    return null;
  });
  if (existing) return { ...existing, duplicate: true, rule };
  const limited = await limitReached({
    ownerCode: owner,
    actionKey: action,
    dailyLimit: rule.daily_limit,
    monthlyLimit: rule.monthly_limit
  });
  if (limited) return { skipped: true, reason: limited, rule };
  const payload = {
    tenant_id: TENANT_ID,
    owner_code: owner,
    action,
    points: rulePoints,
    related_code: related,
    reason: cleanText(reason || rule.action_name || action, 240),
    status: statusFromAuditMode(rule.audit_mode),
    event_key: key,
    fields: {
      source,
      user_visible: true,
      audit_mode: rule.audit_mode,
      action_name: rule.action_name || action,
      scenario_contract_id: contract.id || '',
      scenario_name: contract.scenario_name || '',
      related_code: related,
      ...fields
    }
  };
  const rows = await supa('huaban_point_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  }).catch(error => {
    if (/duplicate|unique|23505/i.test(error.message)) return [{ duplicate: true, event_key: key, rule }];
    throw error;
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { ...(row || {}), rule, scenario_contract: contract };
}

module.exports = {
  awardUsagePoint,
  getUsagePointRule,
  getScenarioContract,
  FALLBACK_RULES
};
