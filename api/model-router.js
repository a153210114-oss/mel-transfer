// api/model-router.js - hidden Huaban model dispatch center
const Anthropic = require('@anthropic-ai/sdk');

let anthropicClient = null;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function lastUserText(messages = []) {
  const last = [...messages].reverse().find(m => m && m.role === 'user');
  const content = last?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => part?.text || '').join('\n');
  }
  return '';
}

function detectTaskType(messages = [], fallback = 'chat') {
  const text = lastUserText(messages);
  if (!text) return { taskType: fallback, reason: 'empty_text' };

  if (/图片|照片|截图|海报|菜单|收据|票|订单|识别|看图|发图|拍照/i.test(text)) {
    return { taskType: 'vision_understanding', reason: 'image_or_screenshot_intent' };
  }
  if (/计划|规划|方案|行程|攻略|怎么安排|推荐.*(路线|玩法)|预算|对比|性价比|合伙人|分配|商业模式|规则|合同|协议/i.test(text)) {
    return { taskType: 'complex_planning', reason: 'planning_or_reasoning' };
  }
  if (/找|有没有|推荐|靠谱|核验|资质|律师|会计|电工|水管|司机|餐馆|外卖|当地|附近|搜索|查一下/i.test(text)) {
    return { taskType: 'search_verify', reason: 'needs_sources_or_matching' };
  }
  if (/我是|我会|我能|我有|我提供|我卖|我开店|我可以帮|接单|入驻|商家|司机|外卖员|合伙人/i.test(text)) {
    return { taskType: 'supply_intel', reason: 'supply_side_signal' };
  }
  if (/接机|送机|包车|下单|预约|预订|订|支付|确认|提醒|闹钟|日程/i.test(text)) {
    return { taskType: 'booking_action', reason: 'action_or_booking' };
  }
  if (/你好|早|晚安|哈哈|累|烦|想你|陪我|聊聊|树洞|心情/i.test(text)) {
    return { taskType: 'casual_chat', reason: 'companion_chat' };
  }
  return { taskType: fallback, reason: 'default' };
}

const ROUTE_PRESETS = {
  director: {
    provider: process.env.HUABAN_MODEL_DIRECTOR_PROVIDER || process.env.HUABAN_MODEL_REASONING_PROVIDER || 'openai',
    model: process.env.HUABAN_MODEL_DIRECTOR || process.env.HUABAN_MODEL_REASONING || process.env.OPENAI_DIRECTOR_MODEL || process.env.OPENAI_REASONING_MODEL || 'gpt-5.5',
    costTier: 'medium',
  },
  casual_chat: {
    provider: process.env.HUABAN_MODEL_FAST_PROVIDER || 'openai',
    model: process.env.HUABAN_MODEL_FAST || process.env.OPENAI_FAST_MODEL || 'gpt-5.4-mini',
    costTier: 'low',
  },
  chat: {
    provider: process.env.HUABAN_MODEL_DEFAULT_PROVIDER || 'openai',
    model: process.env.HUABAN_MODEL_DEFAULT || process.env.OPENAI_CHAT_MODEL || 'gpt-5.4-mini',
    costTier: 'low',
  },
  supply_intel: {
    provider: process.env.HUABAN_MODEL_INTENT_PROVIDER || 'openai',
    model: process.env.HUABAN_MODEL_INTENT || process.env.OPENAI_INTENT_MODEL || 'gpt-5.4-mini',
    costTier: 'low',
  },
  booking_action: {
    provider: process.env.HUABAN_MODEL_ACTION_PROVIDER || 'openai',
    model: process.env.HUABAN_MODEL_ACTION || process.env.OPENAI_ACTION_MODEL || 'gpt-5.4-mini',
    costTier: 'low',
  },
  search_verify: {
    provider: process.env.HUABAN_MODEL_SEARCH_PROVIDER || 'openai',
    model: process.env.HUABAN_MODEL_SEARCH || process.env.OPENAI_SEARCH_MODEL || 'gpt-5.5',
    costTier: 'medium',
  },
  complex_planning: {
    provider: process.env.HUABAN_MODEL_REASONING_PROVIDER || 'openai',
    model: process.env.HUABAN_MODEL_REASONING || process.env.OPENAI_REASONING_MODEL || 'gpt-5.5',
    costTier: 'medium',
  },
  vision_understanding: {
    provider: process.env.HUABAN_MODEL_VISION_PROVIDER || 'anthropic',
    model: process.env.HUABAN_MODEL_VISION || process.env.ANTHROPIC_VISION_MODEL || 'claude-haiku-4-5-20251001',
    costTier: 'medium',
  },
};

const TASK_EXPERTISE = {
  casual_chat: '陪伴、情绪接住、轻松闲聊、语气自然',
  chat: '通用中文对话、快速理解和简短回答',
  complex_planning: '多步骤推理、旅行/商业/学习计划、规则设计、方案对比',
  search_verify: '搜索线索、公开信息核验、候选清单、风险提醒',
  supply_intel: '从聊天中识别用户能提供的商品、服务、资源和商业机会',
  booking_action: '预约、下单、提醒、确认、形成可执行事项',
  vision_understanding: '图片、截图、票据、菜单、海报、群消息理解',
};

const ALLOWED_TASK_TYPES = new Set([
  'casual_chat',
  'chat',
  'complex_planning',
  'search_verify',
  'supply_intel',
  'booking_action',
  'vision_understanding',
]);

const PROVIDER_ALLOW_ENV = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  siliconflow: 'SILICONFLOW_API_KEY',
};

function selectRoute(taskType = 'chat') {
  const preset = ROUTE_PRESETS[taskType] || ROUTE_PRESETS.chat;
  const requestedProvider = preset.provider;
  const providerKey = PROVIDER_ALLOW_ENV[requestedProvider];
  const providerReady = !providerKey || Boolean(process.env[providerKey] || (requestedProvider === 'gemini' && process.env.GOOGLE_API_KEY));
  let provider = requestedProvider;
  let model = preset.model;
  if (!providerReady) {
    if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
      model = taskType === 'vision_understanding'
        ? (process.env.OPENAI_VISION_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini')
        : (process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini');
    } else {
      provider = 'anthropic';
      model = process.env.ANTHROPIC_CHAT_MODEL || 'claude-haiku-4-5-20251001';
    }
  }
  return {
    taskType,
    provider,
    model,
    costTier: preset.costTier,
    expertise: TASK_EXPERTISE[taskType] || TASK_EXPERTISE.chat,
    providerReady,
    requestedProvider,
  };
}

function safeJson(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch(e) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch(e) { return null; }
  return null;
}

function usagePayload(response, route, endpoint) {
  const usage = response?.usage || {};
  const input = Number(usage.input_tokens || usage.prompt_tokens) || 0;
  const output = Number(usage.output_tokens || usage.completion_tokens) || 0;
  const total = Number(usage.total_tokens) || (input + output);
  return {
    provider: route.provider,
    model: route.model,
    endpoint,
    request_id: response?.id || '',
    input_tokens: input,
    output_tokens: output,
    total_tokens: total,
    route: route.taskType,
    task_type: route.taskType,
    cost_tier: route.costTier,
    route_reason: route.reason || '',
    route_assignment: route.assignment || '',
    audit_focus: route.audit_focus || '',
  };
}

async function createAnthropicText({ route, system, messages, maxTokens }) {
  const client = getAnthropicClient();
  if (!client) throw new Error('Anthropic API key missing');
  return client.messages.create({
    model: route.model,
    max_tokens: maxTokens,
    system,
    messages,
  });
}

async function createSiliconFlowText({ route, system, messages, maxTokens }) {
  if (!process.env.SILICONFLOW_API_KEY) throw new Error('SiliconFlow API key missing');
  const sfMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || ''),
    })),
  ];
  const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: route.model,
      messages: sfMessages,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`SiliconFlow text failed: ${response.status} ${message.slice(0, 240)}`);
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return {
    id: data.id || '',
    content: [{ type: 'text', text }],
    usage: data.usage || {},
    raw_provider_response: data,
  };
}

function normalizeOpenAIContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content || '');
  return content.map(part => {
    if (!part) return '';
    if (typeof part === 'string') return part;
    return part.text || part.input_text || '';
  }).filter(Boolean).join('\n');
}

function parseOpenAIText(data) {
  if (data.output_text) return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (part.type === 'output_text' && part.text) chunks.push(part.text);
      if (part.type === 'text' && part.text) chunks.push(part.text);
    }
  }
  return chunks.join('\n');
}

async function createOpenAIText({ route, system, messages, maxTokens }) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key missing');
  const input = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: normalizeOpenAIContent(m.content),
  }));
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: route.model,
      instructions: system || undefined,
      input,
      max_output_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI text failed: ${response.status} ${message.slice(0, 240)}`);
  }
  const data = await response.json();
  return {
    id: data.id || '',
    content: [{ type: 'text', text: parseOpenAIText(data) }],
    usage: data.usage || {},
    raw_provider_response: data,
  };
}

async function createOpenAIVision({ route, content, maxTokens }) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key missing');
  const blocks = [];
  for (const part of content || []) {
    if (part?.type === 'text') {
      blocks.push({ type: 'input_text', text: part.text || '' });
    }
    if (part?.type === 'image' && part.source?.type === 'base64') {
      blocks.push({
        type: 'input_image',
        image_url: `data:${part.source.media_type};base64,${part.source.data}`,
      });
    }
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: route.model,
      input: [{ role: 'user', content: blocks }],
      max_output_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI vision failed: ${response.status} ${message.slice(0, 240)}`);
  }
  const data = await response.json();
  return {
    id: data.id || '',
    content: [{ type: 'text', text: parseOpenAIText(data) }],
    usage: data.usage || {},
    raw_provider_response: data,
  };
}

function parseGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map(part => part.text || '').filter(Boolean).join('\n');
}

async function createGeminiText({ route, system, messages, maxTokens }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Gemini API key missing');
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: normalizeOpenAIContent(m.content) }],
  }));
  const model = encodeURIComponent(route.model);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini text failed: ${response.status} ${message.slice(0, 240)}`);
  }
  const data = await response.json();
  const usage = data.usageMetadata || {};
  return {
    id: '',
    content: [{ type: 'text', text: parseGeminiText(data) }],
    usage: {
      input_tokens: usage.promptTokenCount || 0,
      output_tokens: usage.candidatesTokenCount || 0,
      total_tokens: usage.totalTokenCount || 0,
    },
    raw_provider_response: data,
  };
}

async function createProviderText({ route, system, messages, maxTokens }) {
  if (route.provider === 'siliconflow') {
    return createSiliconFlowText({ route, system, messages, maxTokens });
  }
  if (route.provider === 'openai') {
    return createOpenAIText({ route, system, messages, maxTokens });
  }
  if (route.provider === 'gemini') {
    return createGeminiText({ route, system, messages, maxTokens });
  }
  return createAnthropicText({ route, system, messages, maxTokens });
}

async function getDirectorDecision({ system = '', messages = [], detected }) {
  const directorRoute = { ...selectRoute('director'), taskType: 'director', reason: 'director_judge' };
  const userText = lastUserText(messages).slice(0, 1800);
  if (!userText) return null;
  const prompt = `你是华伴 AI 的模型调度导演，只做内部判断，不给用户展示。

请根据用户最后一句话判断：
1. 应该交给哪类任务模型。
2. 为什么。
3. 哪个“专家能力”最适合完成。
4. 做完后质检重点是什么。

只能返回 JSON，不要解释。

可选 task_type：
- casual_chat：${TASK_EXPERTISE.casual_chat}
- chat：${TASK_EXPERTISE.chat}
- complex_planning：${TASK_EXPERTISE.complex_planning}
- search_verify：${TASK_EXPERTISE.search_verify}
- supply_intel：${TASK_EXPERTISE.supply_intel}
- booking_action：${TASK_EXPERTISE.booking_action}
- vision_understanding：${TASK_EXPERTISE.vision_understanding}

当前规则初判：${detected?.taskType || 'chat'}，原因：${detected?.reason || 'default'}。

返回格式：
{
  "task_type": "chat",
  "confidence": 0.0,
  "reason": "一句话原因",
  "assignment": "交给哪个能力处理",
  "audit_focus": "完成后检查什么"
}

用户最后一句：
${userText}`;

  const response = await createProviderText({
    route: directorRoute,
    system: '你只输出 JSON。',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 260,
  });
  const text = response.content?.map(part => part.text || '').join('\n') || '';
  const decision = safeJson(text);
  if (!decision || !ALLOWED_TASK_TYPES.has(decision.task_type)) return null;
  return {
    taskType: decision.task_type,
    confidence: Math.max(0, Math.min(1, Number(decision.confidence) || 0)),
    reason: String(decision.reason || 'director').slice(0, 160),
    assignment: String(decision.assignment || '').slice(0, 200),
    auditFocus: String(decision.audit_focus || '').slice(0, 220),
    provider: directorRoute.provider,
    model: directorRoute.model,
  };
}

async function auditTextResult({ messages = [], assistantText = '', route, director }) {
  if (!assistantText || process.env.HUABAN_MODEL_AUDIT_ENABLED === 'false') return null;
  const auditRoute = { ...selectRoute('director'), taskType: 'director', reason: 'director_audit' };
  const prompt = `你是华伴 AI 的内部质检员。请检查回复是否满足用户需求，只返回 JSON。

用户需求：
${lastUserText(messages).slice(0, 1600)}

模型任务：${route.taskType}
质检重点：${director?.auditFocus || '是否直接、有用、不暴露后台流程'}

AI回复：
${assistantText.slice(0, 2200)}

返回格式：
{
  "pass": true,
  "score": 0.0,
  "issue": "如果有问题，用一句话说明",
  "suggestion": "如果需要改进，用一句话说明"
}`;

  const response = await createProviderText({
    route: auditRoute,
    system: '你只输出 JSON。',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 220,
  });
  const text = response.content?.map(part => part.text || '').join('\n') || '';
  const audit = safeJson(text);
  if (!audit) return null;
  return {
    pass: audit.pass !== false,
    score: Math.max(0, Math.min(1, Number(audit.score) || 0)),
    issue: String(audit.issue || '').slice(0, 180),
    suggestion: String(audit.suggestion || '').slice(0, 220),
    provider: auditRoute.provider,
    model: auditRoute.model,
  };
}

function evaluateRouteChange({ detected, director, route }) {
  if (!director) {
    return {
      changed: false,
      approved: true,
      policy: 'heuristic_only',
      reason: detected?.reason || 'no_director',
    };
  }
  const changed = director.taskType !== detected.taskType;
  const minConfidence = Number(process.env.HUABAN_MODEL_DIRECTOR_MIN_CONFIDENCE || 0.62);
  const approved = !changed || director.confidence >= minConfidence;
  if (!approved) {
    return {
      changed,
      approved: false,
      policy: 'confidence_gate',
      reason: `director_confidence_${director.confidence}_below_${minConfidence}`,
      fallbackTaskType: detected.taskType,
    };
  }
  return {
    changed,
    approved: true,
    policy: 'confidence_gate',
    reason: director.reason || detected.reason,
    selectedExpertise: route.expertise,
  };
}

function evaluateAudit(audit) {
  if (!audit) {
    return { approved: true, policy: 'audit_unavailable', reason: 'no_audit' };
  }
  const minScore = Number(process.env.HUABAN_MODEL_AUDIT_MIN_SCORE || 0.55);
  return {
    approved: audit.pass !== false && audit.score >= minScore,
    policy: 'audit_score_gate',
    minScore,
    score: audit.score,
    reason: audit.issue || audit.suggestion || '',
  };
}

async function createTextMessage({ system = '', messages = [], maxTokens = 600, taskType }) {
  const detected = taskType ? { taskType, reason: 'explicit' } : detectTaskType(messages, 'chat');
  let director = null;
  if (!taskType && process.env.HUABAN_MODEL_DIRECTOR_ENABLED !== 'false') {
    try {
      director = await getDirectorDecision({ system, messages, detected });
    } catch(e) {
      console.warn('Huaban director skipped:', e?.message || e);
    }
  }
  const finalTaskType = director?.taskType || detected.taskType;
  const initialRoute = selectRoute(finalTaskType);
  const routeEval = evaluateRouteChange({ detected, director, route: initialRoute });
  const effectiveTaskType = routeEval.approved ? finalTaskType : detected.taskType;
  const route = {
    ...selectRoute(effectiveTaskType),
    reason: director?.reason || detected.reason,
    assignment: director?.assignment || '',
    audit_focus: director?.auditFocus || '',
  };
  const response = await createProviderText({ route, system, messages, maxTokens });
  const assistantText = response.content?.map(part => part.text || '').join('\n') || '';
  let audit = null;
  try {
    audit = await auditTextResult({ messages, assistantText, route, director });
  } catch(e) {
    console.warn('Huaban audit skipped:', e?.message || e);
  }
  const auditEval = evaluateAudit(audit);
  return {
    response,
    route,
    director,
    audit,
    usage: {
      ...usagePayload(response, route, 'chat'),
      director_provider: director?.provider || '',
      director_model: director?.model || '',
      director_confidence: director?.confidence || 0,
      audit_provider: audit?.provider || '',
      audit_model: audit?.model || '',
      audit_pass: audit ? audit.pass : null,
      audit_score: audit ? audit.score : 0,
      audit_issue: audit?.issue || '',
      audit_suggestion: audit?.suggestion || '',
      route_changed: routeEval.changed,
      route_approved: routeEval.approved,
      route_policy: routeEval.policy,
      route_eval_reason: routeEval.reason,
      audit_approved: auditEval.approved,
      audit_policy: auditEval.policy,
      audit_eval_reason: auditEval.reason,
    },
  };
}

async function createVisionMessage({ content, maxTokens = 700, taskType = 'vision_understanding' }) {
  const route = { ...selectRoute(taskType), reason: 'vision_payload' };
  if (route.provider === 'openai') {
    const response = await createOpenAIVision({ route, content, maxTokens });
    return {
      response,
      route,
      usage: usagePayload(response, route, 'image-wish'),
    };
  }
  try {
    const client = getAnthropicClient();
    if (!client) throw new Error('Anthropic API key missing');
    const response = await client.messages.create({
      model: route.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    });
    return {
      response,
      route,
      usage: usagePayload(response, route, 'image-wish'),
    };
  } catch (primaryError) {
    if (!process.env.OPENAI_API_KEY) throw primaryError;
    const fallbackRoute = {
      ...route,
      provider: 'openai',
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      requestedProvider: route.provider,
      providerReady: true,
      reason: `${route.reason || 'vision_payload'}_fallback_openai`,
    };
    const response = await createOpenAIVision({ route: fallbackRoute, content, maxTokens });
    return {
      response,
      route: fallbackRoute,
      usage: {
        ...usagePayload(response, fallbackRoute, 'image-wish'),
        fallback_from: route.provider,
        fallback_reason: String(primaryError?.message || primaryError).slice(0, 180),
      },
    };
  }
}

module.exports = {
  detectTaskType,
  selectRoute,
  createTextMessage,
  createVisionMessage,
  usagePayload,
};
