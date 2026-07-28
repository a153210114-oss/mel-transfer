import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { runOpsInspection } from './ops-inspection.mjs';

const root = resolve('.');
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}
const host = '127.0.0.1';
const port = Number(process.env.PORT || 5177);
const dataDir = join(root, 'data');
const statePath = join(dataDir, 'dev-state.json');
const TEST_SOURCE = 'test_local';
const legacyTenantId = process.env.LEGACY_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const legacySupabaseUrl = process.env.LEGACY_SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const legacySupabaseServiceKey = process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY || '';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.sql': 'text/plain; charset=utf-8',
};

const defaultState = {
  posts: [
    {
      id: 'post_lin_cafe',
      authorId: 'lin',
      authorName: '林安 · 咖啡探店',
      authorAvatar: '林',
      city: 'Melbourne CBD',
      dynamicType: 'note',
      mediaType: 'image',
      tag: '生活',
      content: '今天路过 Little Bourke，找到一家适合安静办公的店。想认识也在城里的朋友，周五下午可以一起喝咖啡。',
      publishedLabel: '12 分钟前',
      mediaCount: 3,
      dataSource: 'seed',
      actions: { liked: false, saved: false, followed: false }
    },
    {
      id: 'post_zhou_new',
      authorId: 'zhou',
      authorName: '周宁 · 新到墨尔本',
      authorAvatar: '周',
      city: 'Carlton',
      dynamicType: 'note',
      mediaType: 'text',
      tag: '提问',
      content: '刚搬来 Carlton，想找附近能练英语、也能中文聊天的活动。有人推荐吗？',
      publishedLabel: '35 分钟前',
      mediaCount: 0,
      dataSource: 'seed',
      actions: { liked: false, saved: false, followed: false }
    }
  ],
  profiles: {
    me: {
      id: 'me',
      avatar: '华',
      avatarImage: '/assets/brand/huaban-logo-v1.png',
      name: '我的二维码名片',
      meta: 'HB110001 · Melbourne · 城市可见',
      bio: '本地生活、活动、朋友关系都从这张名片沉淀。'
    },
    lin: {
      id: 'lin',
      avatar: '林',
      geoGroup: 'local',
      name: '林安 · 咖啡探店',
      meta: 'HB110238 · Melbourne CBD · 生活动态',
      bio: '喜欢安静咖啡店、City Walk 和认识同城新朋友。'
    },
    zhou: {
      id: 'zhou',
      avatar: '周',
      geoGroup: 'local',
      name: '周宁 · 新到墨尔本',
      meta: 'HB110517 · Carlton · 提问',
      bio: '刚搬到 Carlton，想找练英语和中文聊天的活动。'
    },
    chen: {
      id: 'chen',
      avatar: '陈',
      geoGroup: 'remote_domestic',
      name: '陈予 · 活动组织',
      meta: 'HB110322 · Melbourne · City Walk',
      bio: '每周组织小范围城市散步和新朋友见面。'
    },
    mia: {
      id: 'mia',
      avatar: 'M',
      geoGroup: 'overseas',
      name: 'Mia Zhang',
      meta: 'HB110486 · Melbourne · 咖啡 / 留学',
      bio: '熟悉留学、本地生活和周末咖啡路线。'
    }
  },
  aiCompanion: {
    name: '小伴',
    avatarUrl: '/assets/brand/huaban-logo-v1.png',
    imageStyle: 'huaban_default',
    liveliness: 'lively',
    tone: 'warm_action',
    holidaySkin: {
      enabled: false,
      skinKey: '',
      startsAt: null,
      endsAt: null
    },
    reviewStatus: 'approved'
  },
  friendships: [],
  messages: {
    mia: [
      { id: 'msg_1', from: 'mia', body: '我看到你收藏了 Carlton 那条动态，这周末要不要一起去？', dataSource: 'seed' },
      { id: 'msg_2', from: 'me', body: '可以，我让 AI 帮我们找附近路线。', dataSource: 'seed' }
    ]
  },
  growth: {
    pointsBalance: 1280,
    releaseLevel: 'L8',
    releaseRatio: '1/128',
    levelWeight: 128,
    poolTotal: 42000000,
    currentRoundPoints: 328125,
    contributionFormula: '有效积分 × 释放等级权重 × 早期席位奖励',
    distributionRule: '华伴净利润 80% 进入分配池；每满 42 万美元按贡献值分配一次；单人累计 100 万美元封顶。',
    waitlistRule: '4200 万积分释放完后，新贡献进入候补记账；有回流积分再按时间顺序转为有效积分。',
    tasks: [
      { id: 'task_prompt_d1', title: '完成 3 次简单 AI 提示词操作', pointsReward: 6 },
      { id: 'task_prompt_d3', title: '完成 1 次多步骤 AI 指令', pointsReward: 6 },
      { id: 'task_invite_3', title: '邀请 3 位华人朋友完成名片', pointsReward: 120 },
      { id: 'task_city_notes', title: '整理 5 条 Melbourne 本地生活动态', pointsReward: 80 },
      { id: 'task_feedback', title: '提交 1 条有效产品反馈', pointsReward: 50 }
    ],
    events: []
  },
  founderGrowth: {
    founderPoints: 10000,
    releaseLevel: 'L8',
    userReleasedPoints: 20000,
    userPointsRatio: 2,
    accrualRule: '用户侧有效释放 2 分，创始人与系统建设账户自动获得 1 分',
    roundingRule: '不足 2 分的尾差继续累计，凑满 2 分后再入账 1 分',
    today: {
      founderPointsDelta: 420,
      userPointsCreditedDelta: 840,
      activeGrowthEvents: 36
    },
    channels: [
      { name: '邀请入账', founderPoints: 3600, userPointsCredited: 7200 },
      { name: '动态互动', founderPoints: 2800, userPointsCredited: 5600 },
      { name: '城市反馈', founderPoints: 1900, userPointsCredited: 3800 },
      { name: '活动共建', founderPoints: 1700, userPointsCredited: 3400 }
    ]
  },
  adminPrompts: [
    {
      id: 'prompt_ai_command',
      name: 'AI 综合指令入口',
      scene: '语音召唤 / 搜索 / 匹配 / 页面控制',
      status: 'active',
      updatedAt: '2026-07-27T08:00:00.000Z',
      body: '根据用户意图打开功能、搜索动态、匹配名片，并在涉及积分权益时使用合规口径。'
    },
    {
      id: 'prompt_growth_explain',
      name: '积分权益解释',
      scene: '积分 / 等级 / 释放 / 分配池',
      status: 'active',
      updatedAt: '2026-07-27T08:00:00.000Z',
      body: '强调不用投资、不用交钱，用户贡献来自参与、建议、反馈、内容、邀请和城市共建。'
    },
    {
      id: 'prompt_voice_control_training',
      name: 'AI 语音操控训练系统',
      scene: '简单提示词 / 多提示词 / 语义任务 / 图文视频生成 / 表单制作 / 自动化配置',
      status: 'active',
      updatedAt: '2026-07-28T08:00:00.000Z',
      body: '将用户语音或文字拆解为意图、槽位和动作计划；单一功能可直接执行，多步骤和高风险任务必须请求确认、审核或授权。提示词训练按 D1-D5 难度指数奖励积分，并记录真实表达样本用于优化 AI 理解。'
    }
  ],
  cityContentQueue: [
    { id: 'review_1', type: '动态', city: 'Melbourne', title: 'Carlton 咖啡活动推荐', status: 'pending', risk: 'low' },
    { id: 'review_2', type: '服务名片', city: 'Melbourne', title: '机场接送服务资料补全', status: 'pending', risk: 'medium' }
  ],
  supplyProfiles: [
    {
      id: 'supply_airport_1',
      name: '李师傅机场接送',
      contact: '+61400 888 168',
      city: 'Melbourne',
      serviceType: '接送机 / 包车',
      serviceTypeCode: 'airport_transfer',
      languageLane: 'zh',
      serviceArea: 'Tullamarine / CBD / Box Hill',
      intro: '7 座车，可接送机、短途包车，需提前确认时间和行李。',
      verificationStatus: 'pending_review',
      status: 'candidate',
      completenessScore: 76,
      sourceChannel: 'legacy_supply_profiles',
      dataSource: 'legacy_seed'
    },
    {
      id: 'supply_plumber_1',
      name: '华人水管维修 Peter',
      contact: '+61411 235 699',
      city: 'Melbourne',
      serviceType: '水管维修',
      serviceTypeCode: 'plumbing',
      languageLane: 'zh',
      serviceArea: 'Eastern suburbs',
      intro: '漏水、堵塞、热水器基础检查，资质待后台核验。',
      verificationStatus: 'pending_review',
      status: 'candidate',
      completenessScore: 68,
      sourceChannel: 'manual_legacy_seed',
      dataSource: 'legacy_seed'
    }
  ],
  supplyCollectionTasks: [
    { id: 'task_supply_1', city: 'Melbourne', languageLane: 'zh', categoryName: '接送机', searchQuery: 'Melbourne 华人 接送机 服务 电话', status: 'queued', priority: 1, storedCount: 0 },
    { id: 'task_supply_2', city: 'Melbourne', languageLane: 'zh', categoryName: '水管维修', searchQuery: '墨尔本 华人 水管维修 电话', status: 'queued', priority: 2, storedCount: 0 },
    { id: 'task_supply_3', city: 'Sydney', languageLane: 'zh', categoryName: '会计税务', searchQuery: '悉尼 华人 会计 税务 电话', status: 'queued', priority: 3, storedCount: 0 }
  ],
  supplyProcessing: [
    { id: 'processing_1', source: '图片识别', title: '名片含电话和汽车服务关键词', city: 'Melbourne', status: 'reviewing' },
    { id: 'processing_2', source: '用户推荐', title: '朋友提供中文学校资料', city: 'Melbourne', status: 'reviewing' }
  ],
  supplyRadar: {
    enabled: true,
    decision: 'idle',
    lastRunAt: null,
    lastSkippedReason: '等待手动试扫或随机 tick',
    cooldownMinutes: 240,
    runChance: 0.35,
    maxTasks: 3,
    perTask: 2
  },
  demandCards: [
    {
      id: 'demand_1',
      requesterCode: 'HB110517',
      needType: 'local_service',
      serviceType: '接送机',
      city: 'Melbourne',
      area: 'Carlton',
      timeText: '周六上午',
      budgetText: '希望先报价',
      rawText: '周六早上想找华人司机去机场，2 个行李箱。',
      status: 'matching',
      supplyMatchCount: 1
    },
    {
      id: 'demand_2',
      requesterCode: 'HB110238',
      needType: 'local_service',
      serviceType: '水管维修',
      city: 'Melbourne',
      area: 'Box Hill',
      timeText: '今天或明天',
      budgetText: '看现场',
      rawText: '厨房水槽漏水，想找附近能中文沟通的人看一下。',
      status: 'human_review',
      supplyMatchCount: 1
    }
  ],
  siteContent: {
    official_home: {
      pageKey: 'official_home',
      status: 'published',
      version: 1,
      updatedAt: '2026-07-27T08:00:00.000Z',
      content: {
        heroTitle: '华伴 AI',
        heroSubtitle: '一款内置 AI 的本地生活 App，帮助用户从海量信息中挣脱，重新专注自己的本地生活。与本地相连，与世界相通。',
        primaryCta: '进入华伴',
        secondaryCta: '了解机制',
        aboutTitle: '把真实的人、真实需求和真实供给沉淀起来',
        aboutBody: '华伴不是重交易平台。AI 先帮助用户表达需求、整理信息、搜索匹配、联系合适的人，并把贡献记录到积分权益体系。',
        footer: 'Huaban V1.1 · huabanapp.com'
      }
    },
    privacy: {
      pageKey: 'privacy',
      status: 'draft',
      version: 1,
      updatedAt: '2026-07-27T08:00:00.000Z',
      content: { heroTitle: '隐私政策', aboutBody: '数据用于理解需求、供需匹配、关系管理、积分记录和体验改进。' }
    }
  },
  automationJobs: [],
  n8nWorkflows: [
    {
      id: 'wf_shop_api_sync',
      workflowId: 'n8n_shop_api_sync',
      workflowName: '小店 API 同步',
      triggerType: 'Webhook / 后台审核',
      ownerUserId: 'me',
      authorizationScope: '服务卡、库存、预约状态',
      status: 'draft',
      lastRunAt: null,
      lastResult: '等待商家授权和后台审核',
      retryCount: 0,
      rollbackNote: '未启用，无需回滚'
    },
    {
      id: 'wf_city_content_review',
      workflowId: 'n8n_city_content_review',
      workflowName: '城市内容审核助手',
      triggerType: '用户发布动态',
      ownerUserId: 'admin',
      authorizationScope: '动态内容、城市、标签、风险提示',
      status: 'pending_review',
      lastRunAt: null,
      lastResult: '等待人工确认审核策略',
      retryCount: 0,
      rollbackNote: '审核结果可人工撤销'
    },
    {
      id: 'wf_friend_note_extract',
      workflowId: 'n8n_friend_note_extract',
      workflowName: '好友备注标签提取',
      triggerType: '聊天摘要 / 名片更新',
      ownerUserId: 'me',
      authorizationScope: '用户授权聊天摘要、名片字段、标签建议',
      status: 'draft',
      lastRunAt: null,
      lastResult: '只生成建议，不自动写入联系人资料',
      retryCount: 0,
      rollbackNote: '建议未确认前不生效'
    }
  ],
  opsInspection: null
};

function loadState() {
  if (!existsSync(statePath)) {
    return structuredClone(defaultState);
  }

  try {
    const persisted = JSON.parse(readFileSync(statePath, 'utf8'));
    return {
      ...structuredClone(defaultState),
      ...persisted,
      profiles: {
        ...defaultState.profiles,
        ...(persisted.profiles || {})
      },
      aiCompanion: {
        ...defaultState.aiCompanion,
        ...(persisted.aiCompanion || {}),
        holidaySkin: {
          ...defaultState.aiCompanion.holidaySkin,
          ...(persisted.aiCompanion?.holidaySkin || {})
        }
      },
      growth: {
        ...defaultState.growth,
        ...(persisted.growth || {}),
        tasks: persisted.growth?.tasks || defaultState.growth.tasks,
        events: persisted.growth?.events || []
      },
      messages: {
        ...defaultState.messages,
        ...(persisted.messages || {})
      }
    };
  } catch (error) {
    console.warn(`Failed to read ${statePath}: ${error.message}`);
    return structuredClone(defaultState);
  }
}

const state = loadState();

function saveState() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

if (!existsSync(statePath)) {
  saveState();
}

function isTestItem(item) {
  if (!item) return false;
  if (item.dataSource === TEST_SOURCE) return true;

  const id = String(item.id || '');
  const source = String(item.source || item.sourceChannel || '');
  const text = `${item.content || ''} ${item.body || ''} ${item.name || ''} ${item.intro || ''}`;

  return (
    /^post_\d/.test(id) ||
    /^friend_\d/.test(id) ||
    /^supply_\d/.test(id) ||
    id.startsWith('supply_radar_') ||
    id.startsWith('job_') ||
    id.startsWith('msg_') && item.from === 'me' && !['msg_1', 'msg_2'].includes(id) ||
    source.includes('e2e') ||
    source.includes('scenario') ||
    text.includes('端到端真测') ||
    text.includes('全场景流程链') ||
    text.includes('真测')
  );
}

function flattenMessages(messages) {
  return Object.values(messages).flat();
}

function itemTimestamp(item) {
  const explicit = Date.parse(item.createdAt || item.updatedAt || '');
  if (!Number.isNaN(explicit)) return explicit;
  const match = String(item.id || '').match(/_(\d{13})/);
  return match ? Number(match[1]) : null;
}

function sourceCounts() {
  const dynamicsTest = state.posts.filter(isTestItem).length;
  const friendshipsTest = state.friendships.filter(isTestItem).length;
  const messagesTest = flattenMessages(state.messages).filter(isTestItem).length;
  const supplyTest = state.supplyProfiles.filter(isTestItem).length;
  const automationTest = state.automationJobs.filter(isTestItem).length;
  const basePoints = defaultState.growth.pointsBalance;

  return {
    test: {
      dynamics: dynamicsTest,
      friendships: friendshipsTest,
      messages: messagesTest,
      supplyProfiles: supplyTest,
      automationJobs: automationTest,
      pointsDelta: Math.max(0, state.growth.pointsBalance - basePoints)
    },
    baseline: {
      dynamics: state.posts.length - dynamicsTest,
      friendships: state.friendships.length - friendshipsTest,
      messages: flattenMessages(state.messages).length - messagesTest,
      supplyProfiles: state.supplyProfiles.length - supplyTest,
      automationJobs: state.automationJobs.length - automationTest,
      pointsBalance: basePoints
    }
  };
}

function testDataAudit(hours = 48) {
  const since = Date.now() - hours * 60 * 60 * 1000;
  const inWindow = (item) => {
    const timestamp = itemTimestamp(item);
    return !timestamp || timestamp >= since;
  };
  const testPosts = state.posts.filter((item) => isTestItem(item) && inWindow(item));
  const testFriendships = state.friendships.filter((item) => isTestItem(item) && inWindow(item));
  const testMessages = Object.entries(state.messages).flatMap(([threadId, messages]) =>
    messages.filter((item) => isTestItem(item) && inWindow(item)).map((message) => ({ ...message, threadId }))
  );
  const testSupply = state.supplyProfiles.filter((item) => isTestItem(item) && inWindow(item));
  const testJobs = state.automationJobs.filter((item) => isTestItem(item) && inWindow(item));

  const relations = [
    ...testPosts.map((post) => ({
      type: 'dynamic',
      id: post.id,
      title: post.content,
      userId: post.authorId,
      targetId: post.id,
      linkedToUser: Boolean(state.profiles[post.authorId]),
      linkedToBackend: state.posts.some((item) => item.id === post.id),
      status: state.profiles[post.authorId] ? 'solid' : 'weak'
    })),
    ...testFriendships.map((friendship) => ({
      type: 'friendship',
      id: friendship.id,
      title: `${friendship.source} -> ${friendship.addresseeId}`,
      userId: 'me',
      targetId: friendship.addresseeId,
      linkedToUser: Boolean(state.profiles.me && state.profiles[friendship.addresseeId]),
      linkedToBackend: state.friendships.some((item) => item.id === friendship.id),
      status: state.profiles.me && state.profiles[friendship.addresseeId] ? 'solid' : 'weak'
    })),
    ...testMessages.map((message) => ({
      type: 'message',
      id: message.id,
      title: message.body,
      userId: message.from,
      targetId: message.threadId,
      linkedToUser: Boolean(state.profiles[message.threadId]) && (message.from === 'me' ? Boolean(state.profiles.me) : Boolean(state.profiles[message.from])),
      linkedToBackend: Boolean(state.messages[message.threadId]?.some((item) => item.id === message.id)),
      status: Boolean(state.profiles[message.threadId]) ? 'solid' : 'weak'
    })),
    ...testSupply.map((profile) => {
      const relatedJob = testJobs.find((job) => JSON.stringify(job.payload || {}).includes(profile.id));
      return {
        type: 'supply',
        id: profile.id,
        title: profile.name,
        userId: 'admin',
        targetId: relatedJob?.id || '',
        linkedToUser: true,
        linkedToBackend: Boolean(relatedJob),
        status: relatedJob ? 'solid' : 'weak'
      };
    })
  ];

  return {
    generatedAt: new Date().toISOString(),
    hours,
    statePath,
    modifiedAt: existsSync(statePath) ? statSync(statePath).mtime.toISOString() : null,
    counts: {
      dynamics: testPosts.length,
      friendships: testFriendships.length,
      messages: testMessages.length,
      supplyProfiles: testSupply.length,
      automationJobs: testJobs.length,
      pointsDelta: Math.max(0, state.growth.pointsBalance - defaultState.growth.pointsBalance)
    },
    relationSummary: {
      checked: relations.length,
      solid: relations.filter((item) => item.status === 'solid').length,
      weak: relations.filter((item) => item.status !== 'solid').length
    },
    relations,
    records: {
      dynamics: testPosts,
      friendships: testFriendships,
      messages: testMessages,
      supplyProfiles: testSupply,
      automationJobs: testJobs
    }
  };
}

function resetLocalTestData() {
  const clean = structuredClone(defaultState);
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, clean);
  saveState();
  return sourceCounts();
}

async function supabaseRest(path, options = {}) {
  if (!legacySupabaseServiceKey) {
    throw new Error('LEGACY_SUPABASE_SERVICE_ROLE_KEY 未配置');
  }

  const response = await fetch(`${legacySupabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: legacySupabaseServiceKey,
      Authorization: `Bearer ${legacySupabaseServiceKey}`,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase ${response.status}`);
  }
  return text ? JSON.parse(text) : null;
}

function liveHasContact(row = {}) {
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
  return Boolean(
    row.contact ||
    row.normalized_contact ||
    row.claimed_phone ||
    fields.phone ||
    fields.normalized_phone ||
    fields.contact_phone ||
    fields.wechat ||
    fields.email ||
    row.website ||
    fields.website
  );
}

function cleanLegacyCode(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
}

function cleanLegacyPhone(value = '') {
  return String(value || '').replace(/[\s()-]/g, '').trim();
}

function legacyFields(row = {}) {
  return row.fields && typeof row.fields === 'object' ? row.fields : {};
}

function legacyDisplayName(row = {}) {
  const fields = legacyFields(row);
  return row.display_name || fields.display_name || fields.name || row.primary_phone || row.normalized_phone || '未命名用户';
}

function legacyIdentityCodesForAccount(account = {}, identityRows = []) {
  const phoneSet = new Set([
    cleanLegacyPhone(account.normalized_phone),
    cleanLegacyPhone(account.primary_phone)
  ].filter(Boolean));
  const accountCode = cleanLegacyCode(account.friend_code || legacyFields(account).canonical_friend_code);
  const codes = new Set(accountCode ? [accountCode] : []);

  identityRows.forEach((row) => {
    const rowPhone = cleanLegacyPhone(row.normalized_phone || row.phone);
    const rowCode = cleanLegacyCode(row.friend_code || legacyFields(row).canonical_friend_code);
    if (rowCode && phoneSet.has(rowPhone)) codes.add(rowCode);
  });

  return Array.from(codes);
}

function legacyInvolvedCodes(row = {}) {
  const fields = legacyFields(row);
  return [
    row.owner_code,
    row.friend_code,
    row.inviter_code,
    row.referee_code,
    row.direct_referrer_code,
    row.second_level_referrer_code,
    row.related_code,
    fields.owner_code,
    fields.friend_code,
    fields.inviter_code,
    fields.referee_code,
    fields.direct_referrer_code,
    fields.second_level_referrer_code,
    fields.related_code,
    fields.referee?.code,
    fields.inviter?.code,
    fields.friend?.code
  ].map(cleanLegacyCode).filter(Boolean);
}

function pointStatusCounts(rows = []) {
  return rows.reduce((acc, row) => {
    const status = String(row.status || 'unknown').toLowerCase();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function pointActionSummary(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const action = String(row.action || 'unknown');
    const current = map.get(action) || { action, events: 0, points: 0, confirmed: 0, pending: 0 };
    const points = Number(row.points) || 0;
    const status = String(row.status || '').toLowerCase();
    current.events += 1;
    current.points += points;
    if (status === 'confirmed') current.confirmed += points;
    if (status && status !== 'confirmed') current.pending += points;
    map.set(action, current);
  });
  return Array.from(map.values()).sort((a, b) => b.points - a.points || b.events - a.events);
}

function legacyRecentRows(rows = [], hours = 48) {
  const since = Date.now() - hours * 60 * 60 * 1000;
  return rows.filter((row) => {
    const ts = Date.parse(row.created_at || row.updated_at || '');
    return !Number.isNaN(ts) && ts >= since;
  });
}

async function liveSupabaseAudit() {
  const connected = Boolean(legacySupabaseServiceKey);
  const base = {
    generatedAt: new Date().toISOString(),
    source: 'legacy_supabase_rest_readonly',
    tenantId: legacyTenantId,
    connected,
    verdict: connected ? 'checking' : 'unverified',
    writeAccess: false,
    warning: connected ? '' : '新项目未配置 LEGACY_SUPABASE_SERVICE_ROLE_KEY，不能确认原库用户、身份码、推荐关系、积分和供给侧数据。'
  };

  if (!connected) return base;

  const selectLimit = 1000;
  const [
    accounts,
    identityLinks,
    friendships,
    referrals,
    pointEvents,
    supplyProfiles
  ] = await Promise.all([
    supabaseRest(`huaban_accounts?tenant_id=eq.${encodeURIComponent(legacyTenantId)}&order=created_at.desc&limit=${selectLimit}&select=id,account_uid,friend_code,display_name,primary_phone,normalized_phone,status,created_at,fields`).catch((error) => ({ error: error.message })),
    supabaseRest(`huaban_identity_links?tenant_id=eq.${encodeURIComponent(legacyTenantId)}&status=eq.active&order=created_at.desc&limit=${selectLimit}&select=id,friend_code,inviter_code,normalized_phone,phone,display_name,link_type,status,created_at,fields`).catch((error) => ({ error: error.message })),
    supabaseRest(`huaban_friendships?tenant_id=eq.${encodeURIComponent(legacyTenantId)}&order=created_at.desc&limit=${selectLimit}&select=id,owner_code,friend_code,friend_phone,source,status,created_at,fields`).catch((error) => ({ error: error.message })),
    supabaseRest(`huaban_referral_events?tenant_id=eq.${encodeURIComponent(legacyTenantId)}&order=created_at.desc&limit=${selectLimit}&select=id,inviter_code,referee_code,direct_referrer_code,second_level_referrer_code,inviter_phone,referee_phone,status,points_awarded,created_at,fields`).catch((error) => ({ error: error.message })),
    supabaseRest(`huaban_point_events?tenant_id=eq.${encodeURIComponent(legacyTenantId)}&order=created_at.desc&limit=${selectLimit}&select=id,owner_code,event_key,points,action,status,related_code,created_at,fields`).catch((error) => ({ error: error.message })),
    supabaseRest(`huaban_supply_profiles?tenant_id=eq.${encodeURIComponent(legacyTenantId)}&order=updated_at.desc&limit=${selectLimit}&select=id,name,contact,normalized_contact,claimed_phone,city,country,service_type,service_type_code,status,verification_status,source_mode,source_channel,created_at,updated_at,fields,website`).catch((error) => ({ error: error.message }))
  ]);

  const errors = [
    accounts?.error && `accounts: ${accounts.error}`,
    identityLinks?.error && `identity_links: ${identityLinks.error}`,
    friendships?.error && `friendships: ${friendships.error}`,
    referrals?.error && `referral_events: ${referrals.error}`,
    pointEvents?.error && `point_events: ${pointEvents.error}`,
    supplyProfiles?.error && `supply_profiles: ${supplyProfiles.error}`
  ].filter(Boolean);

  const accountRows = Array.isArray(accounts) ? accounts : [];
  const identityRows = Array.isArray(identityLinks) ? identityLinks : [];
  const friendshipRows = Array.isArray(friendships) ? friendships : [];
  const referralRows = Array.isArray(referrals) ? referrals : [];
  const pointRows = Array.isArray(pointEvents) ? pointEvents : [];
  const supplyRows = Array.isArray(supplyProfiles) ? supplyProfiles : [];

  const activeAccounts = accountRows.filter((row) => row.status === 'active' || !row.status);
  const codeSet = new Set([
    ...accountRows.map((row) => cleanLegacyCode(row.friend_code)).filter(Boolean),
    ...identityRows.map((row) => cleanLegacyCode(row.friend_code)).filter(Boolean)
  ]);
  const validPointRows = pointRows.filter((row) => !['rejected', 'reversed', 'cancelled'].includes(String(row.status || '').toLowerCase()));
  const confirmedPointRows = pointRows.filter((row) => String(row.status || '').toLowerCase() === 'confirmed');
  const pointTotal = validPointRows.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
  const confirmedPointTotal = confirmedPointRows.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
  const pointOwners = new Set(pointRows.map((row) => cleanLegacyCode(row.owner_code)).filter(Boolean));
  const supplyWithContact = supplyRows.filter(liveHasContact);
  const recent = {
    hours: 48,
    accounts: legacyRecentRows(accountRows).length,
    identityLinks: legacyRecentRows(identityRows).length,
    friendships: legacyRecentRows(friendshipRows).length,
    referralEvents: legacyRecentRows(referralRows).length,
    pointEvents: legacyRecentRows(pointRows).length,
    supplyProfiles: legacyRecentRows(supplyRows).length
  };

  const userRows = activeAccounts.map((account) => {
    const codes = legacyIdentityCodesForAccount(account, identityRows);
    const codeSetForUser = new Set(codes);
    const userPoints = pointRows.filter((row) => codeSetForUser.has(cleanLegacyCode(row.owner_code)));
    const userFriendships = friendshipRows.filter((row) => legacyInvolvedCodes(row).some((code) => codeSetForUser.has(code)));
    const userReferrals = referralRows.filter((row) => legacyInvolvedCodes(row).some((code) => codeSetForUser.has(code)));
    const totalPoints = userPoints
      .filter((row) => !['rejected', 'reversed', 'cancelled'].includes(String(row.status || '').toLowerCase()))
      .reduce((sum, row) => sum + (Number(row.points) || 0), 0);
    const confirmedPoints = userPoints
      .filter((row) => String(row.status || '').toLowerCase() === 'confirmed')
      .reduce((sum, row) => sum + (Number(row.points) || 0), 0);

    return {
      id: account.id,
      name: legacyDisplayName(account),
      phone: account.normalized_phone || account.primary_phone || '',
      friendCode: cleanLegacyCode(account.friend_code || legacyFields(account).canonical_friend_code),
      identityCodes: codes,
      identityCodeCount: codes.length,
      pointEvents: userPoints.length,
      totalPoints,
      confirmedPoints,
      friendships: userFriendships.length,
      referrals: userReferrals.length,
      status: account.status || 'active',
      createdAt: account.created_at || ''
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints || b.identityCodeCount - a.identityCodeCount);

  const orphanPointRows = pointRows.filter((row) => {
    const owner = cleanLegacyCode(row.owner_code);
    return owner && !codeSet.has(owner);
  });
  const referralCompleteness = referralRows.filter((row) => cleanLegacyCode(row.inviter_code) && cleanLegacyCode(row.referee_code)).length;
  const friendshipCompleteness = friendshipRows.filter((row) => cleanLegacyCode(row.owner_code) && cleanLegacyCode(row.friend_code)).length;

  const relationChecks = [
    { id: 'six_test_users', label: '参与测试用户', ok: activeAccounts.length >= 6, detail: `${activeAccounts.length} 个 active/可用账号` },
    { id: 'identity_codes', label: '身份码', ok: codeSet.size >= activeAccounts.length && codeSet.size >= 6, detail: `${codeSet.size} 个身份码/身份链接` },
    { id: 'referrals', label: '推荐关系', ok: referralRows.length > 0 || friendshipRows.some((row) => String(row.source || '').includes('referral')), detail: `${referralRows.length} 条推荐事件，其中 ${referralCompleteness} 条双方编码完整；${friendshipRows.length} 条好友关系，其中 ${friendshipCompleteness} 条双方编码完整` },
    { id: 'points', label: '积分账本', ok: pointRows.length > 0 && pointTotal > 0, detail: `${pointTotal} 总有效分，${confirmedPointTotal} confirmed 分，${pointRows.length} 条流水，${pointOwners.size} 个积分用户` },
    { id: 'points_owner_link', label: '积分归属', ok: orphanPointRows.length === 0, detail: `${orphanPointRows.length} 条积分流水 owner_code 未在账号/身份码中找到` },
    { id: 'supply_contact', label: '供给侧联系方式', ok: supplyRows.length >= 300 && supplyWithContact.length >= 190, detail: `${supplyRows.length} 条供给，${supplyWithContact.length} 条有联系方式` }
  ];

  return {
    ...base,
    verdict: errors.length ? 'warning' : (relationChecks.every((item) => item.ok) ? 'solid' : 'needs_review'),
    errors,
    summary: {
      users: activeAccounts.length,
      identityCodes: codeSet.size,
      friendships: friendshipRows.length,
      referralEvents: referralRows.length,
      pointEvents: pointRows.length,
      pointOwners: pointOwners.size,
      totalPoints: pointTotal,
      confirmedPoints: confirmedPointTotal,
      orphanPointEvents: orphanPointRows.length,
      supplyProfiles: supplyRows.length,
      supplyWithContact: supplyWithContact.length,
      recent48h: recent
    },
    relationChecks,
    userRows,
    pointStatusCounts: pointStatusCounts(pointRows),
    pointActionSummary: pointActionSummary(pointRows),
    samples: {
      accounts: activeAccounts.slice(0, 10),
      identityLinks: identityRows.slice(0, 10),
      referrals: referralRows.slice(0, 10),
      friendships: friendshipRows.slice(0, 10),
      pointEvents: pointRows.slice(0, 12),
      orphanPointEvents: orphanPointRows.slice(0, 12),
      supplyProfiles: supplyRows.slice(0, 12),
      supplyWithContact: supplyWithContact.slice(0, 12)
    }
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function resolveAiCommand(text = '') {
  const query = String(text).trim();
  const normalized = query.toLowerCase();

  if (!query) {
    return {
      action: 'focus_ai',
      message: '可以说：找附近咖啡、帮我匹配当地朋友、我要发动态、打开消息。'
    };
  }

  if (query.includes('发动态') || query.includes('发布') || normalized.includes('post')) {
    return {
      action: 'open_publish',
      message: '已打开发布入口，可以从相册、拍摄或写文字开始。'
    };
  }

  if (query.includes('匹配') || query.includes('推荐朋友') || query.includes('附近的人') || normalized.includes('match')) {
    return {
      action: 'match_cards',
      message: '已根据城市、兴趣和好友分组匹配名片。',
      cards: Object.values(state.profiles).filter((profile) => profile.id !== 'me').slice(0, 3)
    };
  }

  if (query.includes('聊天') || query.includes('消息') || normalized.includes('chat')) {
    return {
      action: 'open_messages',
      message: '已打开消息页面。'
    };
  }

  if (query.includes('通讯录') || query.includes('联系人') || query.includes('好友') || normalized.includes('contact')) {
    return {
      action: 'open_contacts',
      message: '已打开通讯录。'
    };
  }

  if (query.includes('市集') || query.includes('买') || query.includes('卖') || normalized.includes('market')) {
    return {
      action: 'open_market',
      message: '已打开市集，并保留你的搜索词。'
    };
  }

  if (query.includes('菜单') || query.includes('加好友') || query.includes('扫一扫') || query.includes('收付款')) {
    return {
      action: 'open_menu',
      message: '已打开左上角功能菜单。'
    };
  }

  if (query.includes('地图') || query.includes('导航') || query.includes('位置') || query.includes('定位') || query.includes('发送地址') || normalized.includes('map') || normalized.includes('navigation') || normalized.includes('location')) {
    return {
      action: 'open_location',
      message: '已打开地图位置，可以搜索地点、使用当前位置或发送地址。'
    };
  }

  if (query.includes('积分') || query.includes('等级') || query.includes('释放') || query.includes('权重') || query.includes('分配') || query.includes('贡献') || query.includes('任务')) {
    return {
      action: 'open_growth',
      message: '积分权益是合规贡献计划，不用投资、不用交钱；积分来自真实参与、提意见、给建议和城市共建。已接入动作包括注册 30、完善资料 20、创建名片 30、首次分享 10、一级推荐 20、二级推荐 6、整理真实需求 10、完善服务名片 80、真实服务确认 50。总池 4200 万，首轮 L8 释放 1/128；净利润 80% 入分配池，满 42 万美元按贡献值分配一次。',
      growth: state.growth
    };
  }

  return {
    action: 'search_local',
    query,
    message: '已按语音/文字指令搜索动态、名片和本地服务。',
    results: state.posts.filter((post) => post.content.includes(query) || post.city.includes(query)).slice(0, 5)
  };
}

function recordAutomationJob(jobName, status, payload = {}) {
  const now = new Date().toISOString();
  const job = {
    id: `job_${Date.now()}`,
    jobName,
    status,
    payload,
    dataSource: TEST_SOURCE,
    createdAt: now,
    startedAt: now,
    finishedAt: now
  };
  state.automationJobs.unshift(job);
  state.automationJobs = state.automationJobs.slice(0, 50);
  return job;
}

function runAndStoreOpsInspection() {
  const report = runOpsInspection();
  state.opsInspection = report;
  recordAutomationJob('HB11_06_Admin_Operation_Center', report.status === 'blocked' ? 'needs_attention' : 'done', {
    status: report.status,
    summary: report.summary,
    generatedAt: report.generatedAt
  });
  return report;
}

function adminUsers() {
  return Object.values(state.profiles).map((profile, index) => ({
    id: profile.id,
    name: profile.name,
    city: profile.meta?.includes('Melbourne') ? 'Melbourne' : '未知',
    geoGroup: profile.geoGroup || 'local',
    status: 'active',
    pointsBalance: profile.id === 'me' ? state.growth.pointsBalance : 300 + index * 80,
    lastSeenLabel: index === 0 ? '刚刚' : `${index + 1} 小时前`
  }));
}

function adminOverview() {
  const users = adminUsers();
  const pendingReviews = state.cityContentQueue.filter((item) => item.status === 'pending').length;
  const latestInspection = state.opsInspection || runAndStoreOpsInspection();
  const counts = sourceCounts();
  return {
    generatedAt: new Date().toISOString(),
    dataMode: {
      mode: 'local_persistent_test',
      writable: true,
      statePath,
      note: '本地真测模式：页面动作会写入 data/dev-state.json；接入线上数据库前不会写入生产库。'
    },
    stats: {
      users: users.length,
      dynamics: state.posts.length,
      friendships: state.friendships.length,
      pendingReviews,
      supplyProfiles: state.supplyProfiles.length,
      demandCards: state.demandCards.length,
      radarDecision: state.supplyRadar.decision,
      sitePages: Object.keys(state.siteContent).length,
      automationJobs: state.automationJobs.length,
      n8nWorkflows: state.n8nWorkflows.length,
      aiPrompts: state.adminPrompts.length,
      pointsBalance: state.growth.pointsBalance,
      inspectionStatus: latestInspection.status
    },
    testCounts: counts.test,
    baselineCounts: counts.baseline,
    modules: [
      { id: 'users', title: '用户管理', summary: `${users.length} 个用户，含资料和积分摘要` },
      { id: 'dynamics', title: '动态管理', summary: `${state.posts.length} 条动态，朋友圈/视频号统一接口` },
      { id: 'relations', title: '名片关系', summary: '好友分组：当地、异地、异国' },
      { id: 'city', title: '城市内容', summary: `${pendingReviews} 条待处理内容` },
      { id: 'supply', title: '供给侧', summary: `${state.supplyProfiles.length} 条供给资料，含旧数据迁回` },
      { id: 'radar', title: '雷达', summary: `${state.supplyCollectionTasks.length} 条采集任务，${state.supplyRadar.decision}` },
      { id: 'demand', title: '需求匹配', summary: `${state.demandCards.length} 张需求卡，供需匹配入口` },
      { id: 'website', title: '官网管理', summary: `${Object.keys(state.siteContent).length} 个官网页面版本` },
      { id: 'ai', title: 'AI Prompt', summary: `${state.adminPrompts.length} 条启用中` },
      { id: 'n8n', title: 'n8n 工作流', summary: `${state.n8nWorkflows.length} 条工作流，授权后执行` },
      { id: 'automation', title: '自动化任务', summary: `${state.automationJobs.length} 条任务记录` },
      { id: 'growth', title: '积分等级', summary: `${state.growth.releaseLevel} / ${state.growth.releaseRatio}` },
      { id: 'stats', title: '数据统计', summary: '用户、动态、AI、积分、巡检总览' }
    ]
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && (path === '/api/v1/dynamics' || path === '/api/v1/city-posts')) {
      sendJson(res, 200, { dynamics: state.posts, posts: state.posts });
      return true;
    }

    if (req.method === 'POST' && (path === '/api/v1/dynamics' || path === '/api/v1/city-posts')) {
      const body = await readJson(req);
      const media = Array.isArray(body.media) ? body.media : [];
      const mediaType = body.mediaType || (media.length > 0 ? media[0].mediaType : 'text');
      const mediaCount = mediaType === 'video' ? Math.min(media.length, 1) : Math.min(media.length, 6);
      const durationSeconds = mediaType === 'video'
        ? Math.min(Number(body.durationSeconds || media[0]?.durationSeconds || 15), 15)
        : 0;
      const post = {
        id: `post_${Date.now()}`,
        authorId: 'me',
        authorName: '我 · 新发布',
        authorAvatar: '华',
        city: body.city || 'Melbourne',
        dynamicType: body.dynamicType || body.postKind || 'note',
        mediaType,
        tag: '生活',
        content: String(body.content || '').trim(),
        publishedLabel: '刚刚',
        mediaCount,
        durationSeconds,
        dataSource: body.dataSource || TEST_SOURCE,
        actions: { liked: false, saved: false, followed: false }
      };
      if (!post.content) {
        sendJson(res, 400, { ok: false, error: 'content_required' });
        return true;
      }
      state.posts.unshift(post);
      saveState();
      sendJson(res, 201, { ok: true, post });
      return true;
    }

    const cardMatch = path.match(/^\/api\/v1\/cards\/([^/]+)$/);
    if (req.method === 'GET' && cardMatch) {
      const profile = state.profiles[cardMatch[1]];
      sendJson(res, profile ? 200 : 404, profile ? { profile } : { ok: false, error: 'card_not_found' });
      return true;
    }

    const actionMatch = path.match(/^\/api\/v1\/(?:dynamics|city-posts)\/([^/]+)\/actions$/);
    if (req.method === 'POST' && actionMatch) {
      const body = await readJson(req);
      const post = state.posts.find((item) => item.id === actionMatch[1]);
      if (!post) {
        sendJson(res, 404, { ok: false, error: 'post_not_found' });
        return true;
      }
      const actionType = body.actionType;
      if (actionType === 'save') post.actions.saved = true;
      if (actionType === 'like') post.actions.liked = true;
      if (actionType === 'follow_author') post.actions.followed = true;
      saveState();
      sendJson(res, 200, { ok: true, post });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/friendships') {
      const body = await readJson(req);
      const friendship = {
        id: `friend_${Date.now()}`,
        addresseeId: body.addresseeId,
        source: body.source || 'card',
        dataSource: body.dataSource || TEST_SOURCE,
        status: 'accepted'
      };
      state.friendships.push(friendship);
      saveState();
      sendJson(res, 201, { ok: true, friendship });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/me/growth') {
      sendJson(res, 200, state.growth);
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/me/ai-companion') {
      sendJson(res, 200, state.aiCompanion);
      return true;
    }

    if (req.method === 'PATCH' && path === '/api/v1/me/ai-companion') {
      const body = await readJson(req);
      const allowedLiveliness = new Set(['quiet', 'natural', 'lively', 'very_lively']);
      const avatarChanged = Boolean(body.avatarUrl) && body.avatarUrl !== state.aiCompanion.avatarUrl;
      state.aiCompanion = {
        ...state.aiCompanion,
        name: String(body.name || state.aiCompanion.name).trim().slice(0, 16) || state.aiCompanion.name,
        avatarUrl: String(body.avatarUrl || state.aiCompanion.avatarUrl || '').trim(),
        imageStyle: String(body.imageStyle || state.aiCompanion.imageStyle || 'huaban_default').trim(),
        liveliness: allowedLiveliness.has(body.liveliness) ? body.liveliness : state.aiCompanion.liveliness,
        tone: String(body.tone || state.aiCompanion.tone || 'warm_action').trim(),
        holidaySkin: {
          ...state.aiCompanion.holidaySkin,
          ...(body.holidaySkin || {})
        },
        reviewStatus: avatarChanged ? 'pending_review' : state.aiCompanion.reviewStatus
      };
      recordAutomationJob('HB11_User_AI_Companion_Profile_Update', 'done', {
        name: state.aiCompanion.name,
        liveliness: state.aiCompanion.liveliness,
        reviewStatus: state.aiCompanion.reviewStatus
      });
      saveState();
      sendJson(res, 200, { ok: true, companion: state.aiCompanion });
      return true;
    }

    if (req.method === 'GET' && (path === '/api/v1/founder/system-accrual' || path === '/api/v1/internal/founder/growth')) {
      sendJson(res, 200, state.founderGrowth);
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/co-creation/tasks') {
      sendJson(res, 200, { tasks: state.growth.tasks });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/overview') {
      sendJson(res, 200, adminOverview());
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/test-status') {
      const counts = sourceCounts();
      sendJson(res, 200, {
        mode: 'local_persistent_test',
        writable: true,
        statePath,
        persisted: existsSync(statePath),
        warning: '当前后台总数包含本地测试数据，不代表真实业务数据。',
        testCounts: counts.test,
        baselineCounts: counts.baseline,
        capabilities: [
          '后台新增供给资料持久化',
          '雷达试扫结果持久化',
          '官网草稿和发布版本持久化',
          '动态发布和互动持久化',
          '城市内容审核持久化',
          'AI Prompt 修改持久化',
          '积分事件持久化',
          '自动化任务记录持久化'
        ],
        notYetProduction: [
          '尚未连接线上 Supabase/Postgres',
          '尚未接真实搜索 API',
          '尚未接真实 OpenAI 调用',
          '尚未接 n8n 定时任务'
        ]
      });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/test-data/audit') {
      sendJson(res, 200, testDataAudit(Number(url.searchParams.get('hours') || 48)));
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/live-audit') {
      sendJson(res, 200, await liveSupabaseAudit());
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/admin/test-data/reset') {
      const counts = resetLocalTestData();
      sendJson(res, 200, {
        ok: true,
        message: '已清理本地真测写入，恢复到种子/迁回基线数据。',
        testCounts: counts.test,
        baselineCounts: counts.baseline,
        overview: adminOverview()
      });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/users') {
      sendJson(res, 200, { users: adminUsers() });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/dynamics') {
      sendJson(res, 200, { dynamics: state.posts });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/friendships') {
      sendJson(res, 200, {
        groups: [
          { id: 'local', name: '当地', count: adminUsers().filter((user) => user.geoGroup === 'local').length },
          { id: 'remote_domestic', name: '异地', count: adminUsers().filter((user) => user.geoGroup === 'remote_domestic').length },
          { id: 'overseas', name: '异国', count: adminUsers().filter((user) => user.geoGroup === 'overseas').length }
        ],
        friendships: state.friendships
      });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/city-content') {
      sendJson(res, 200, { queue: state.cityContentQueue });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/supply/profiles') {
      sendJson(res, 200, { profiles: state.supplyProfiles });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/admin/supply/profiles') {
      const body = await readJson(req);
      const profile = {
        id: `supply_${Date.now()}`,
        name: String(body.name || '').trim(),
        contact: String(body.contact || '').trim(),
        city: String(body.city || 'Melbourne').trim(),
        serviceType: String(body.serviceType || body.service_type || '').trim(),
        serviceTypeCode: String(body.serviceTypeCode || body.service_type_code || 'generic_service').trim(),
        languageLane: body.languageLane || 'zh',
        serviceArea: String(body.serviceArea || '').trim(),
        intro: String(body.intro || '').trim(),
        verificationStatus: 'pending_review',
        status: 'candidate',
        completenessScore: body.contact ? 72 : 42,
        sourceChannel: 'admin_manual',
        dataSource: body.dataSource || TEST_SOURCE
      };
      if (!profile.name || !profile.contact || !profile.serviceType) {
        sendJson(res, 400, { ok: false, error: 'name_contact_service_required' });
        return true;
      }
      state.supplyProfiles.unshift(profile);
      recordAutomationJob('HB11_Admin_Supply_Profile_Create', 'done', { id: profile.id, city: profile.city, serviceType: profile.serviceType });
      saveState();
      sendJson(res, 201, { ok: true, profile });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/supply/tasks') {
      sendJson(res, 200, { tasks: state.supplyCollectionTasks });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/supply/processing') {
      sendJson(res, 200, { items: state.supplyProcessing });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/supply/radar') {
      sendJson(res, 200, state.supplyRadar);
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/admin/supply/radar/tick') {
      const body = await readJson(req);
      const task = state.supplyCollectionTasks.find((item) => ['queued', 'failed', 'skipped'].includes(item.status));
      const now = new Date().toISOString();
      if (!state.supplyRadar.enabled && !body.force) {
        state.supplyRadar.decision = 'skipped';
        state.supplyRadar.lastSkippedReason = '雷达未启用';
        saveState();
        sendJson(res, 200, { ok: true, radar: state.supplyRadar });
        return true;
      }
      if (!task) {
        state.supplyRadar.decision = 'skipped';
        state.supplyRadar.lastSkippedReason = '没有待执行采集任务';
        recordAutomationJob('HB11_Supply_Radar_Tick', 'needs_attention', { reason: state.supplyRadar.lastSkippedReason });
        saveState();
        sendJson(res, 200, { ok: true, radar: state.supplyRadar });
        return true;
      }
      task.status = 'processed';
      task.storedCount += 1;
      const profile = {
        id: `supply_radar_${Date.now()}`,
        name: `${task.city} ${task.categoryName} 公开线索`,
        contact: '+61400 000 000',
        city: task.city,
        serviceType: task.categoryName,
        serviceTypeCode: task.categoryName,
        languageLane: task.languageLane,
        serviceArea: task.city,
        intro: `由雷达任务「${task.searchQuery}」整理出的待核验供给资料。`,
        verificationStatus: 'pending_review',
        status: 'candidate',
        completenessScore: 58,
        sourceChannel: 'supply_radar',
        dataSource: TEST_SOURCE
      };
      state.supplyProfiles.unshift(profile);
      state.supplyRadar.decision = 'ran';
      state.supplyRadar.lastRunAt = now;
      state.supplyRadar.lastSkippedReason = '';
      recordAutomationJob('HB11_Supply_Radar_Tick', 'done', { taskId: task.id, createdSupplyProfileId: profile.id });
      saveState();
      sendJson(res, 200, { ok: true, radar: state.supplyRadar, task, profile });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/demands') {
      sendJson(res, 200, { demands: state.demandCards });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/website/content') {
      const page = url.searchParams.get('page') || 'official_home';
      sendJson(res, 200, state.siteContent[page] || { pageKey: page, status: 'draft', version: 0, content: {} });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/admin/website/content') {
      const body = await readJson(req);
      const pageKey = String(body.pageKey || 'official_home').replace(/[^a-zA-Z0-9_-]/g, '') || 'official_home';
      const current = state.siteContent[pageKey] || { pageKey, version: 0, content: {} };
      const item = {
        pageKey,
        status: body.publish ? 'published' : 'draft',
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
        content: { ...current.content, ...(body.content || {}) }
      };
      state.siteContent[pageKey] = item;
      recordAutomationJob(body.publish ? 'HB11_Admin_Website_Publish' : 'HB11_Admin_Website_Save_Draft', 'done', { pageKey, version: item.version });
      saveState();
      sendJson(res, 200, { ok: true, page: item });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/admin/city-content/review') {
      const body = await readJson(req);
      const item = state.cityContentQueue.find((entry) => entry.id === body.id);
      if (!item) {
        sendJson(res, 404, { ok: false, error: 'review_item_not_found' });
        return true;
      }
      item.status = body.status === 'rejected' ? 'rejected' : 'approved';
      recordAutomationJob('HB11_Admin_City_Content_Review', 'done', item);
      saveState();
      sendJson(res, 200, { ok: true, item });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/ai-prompts') {
      sendJson(res, 200, { prompts: state.adminPrompts });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/admin/ai-prompts') {
      const body = await readJson(req);
      const prompt = state.adminPrompts.find((item) => item.id === body.id);
      if (!prompt) {
        sendJson(res, 404, { ok: false, error: 'prompt_not_found' });
        return true;
      }
      prompt.body = String(body.body || prompt.body).trim();
      prompt.status = body.status || prompt.status;
      prompt.updatedAt = new Date().toISOString();
      recordAutomationJob('HB11_Admin_AI_Prompt_Update', 'done', { id: prompt.id, status: prompt.status });
      saveState();
      sendJson(res, 200, { ok: true, prompt });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/growth') {
      sendJson(res, 200, { userGrowth: state.growth, founderGrowth: state.founderGrowth });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/stats') {
      const overview = adminOverview();
      sendJson(res, 200, {
        ...overview.stats,
        testDynamics: overview.testCounts.dynamics,
        baselineDynamics: overview.baselineCounts.dynamics,
        testSupplyProfiles: overview.testCounts.supplyProfiles,
        baselineSupplyProfiles: overview.baselineCounts.supplyProfiles,
        testPointsDelta: overview.testCounts.pointsDelta
      });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/automation-jobs') {
      sendJson(res, 200, { jobs: state.automationJobs });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/n8n-workflows') {
      sendJson(res, 200, { workflows: state.n8nWorkflows });
      return true;
    }

    if (req.method === 'GET' && path === '/api/v1/admin/ops-inspection') {
      sendJson(res, 200, state.opsInspection || runAndStoreOpsInspection());
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/admin/ops-inspection/run') {
      const report = runAndStoreOpsInspection();
      saveState();
      sendJson(res, 200, report);
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/growth/events') {
      const body = await readJson(req);
      const eventKey = String(body.eventKey || `${body.eventType || 'event'}:${body.refType || 'manual'}:${body.refId || Date.now()}`).trim();
      const existing = state.growth.events.find((item) => item.eventKey === eventKey);
      if (existing) {
        sendJson(res, 200, { ok: true, duplicate: true, event: existing, growth: state.growth });
        return true;
      }
      const event = {
        id: `growth_${Date.now()}`,
        eventKey,
        eventType: String(body.eventType || 'manual_adjustment'),
        growthChannel: String(body.growthChannel || 'contribution'),
        pointsDelta: Number(body.pointsDelta || 0),
        basePoints: Number(body.basePoints || body.pointsDelta || 0),
        status: body.status || 'confirmed',
        ownerCode: String(body.ownerCode || 'HB110001'),
        relatedCode: String(body.relatedCode || ''),
        reason: String(body.reason || ''),
        refType: String(body.refType || ''),
        refId: String(body.refId || ''),
        createdAt: new Date().toISOString()
      };
      state.growth.events.unshift(event);
      if (event.status === 'confirmed') {
        state.growth.pointsBalance += event.pointsDelta;
      }
      saveState();
      sendJson(res, 201, { ok: true, event, growth: state.growth });
      return true;
    }

    const messageMatch = path.match(/^\/api\/v1\/messages\/([^/]+)$/);
    if (req.method === 'GET' && messageMatch) {
      sendJson(res, 200, { messages: state.messages[messageMatch[1]] || [] });
      return true;
    }

    if (req.method === 'POST' && messageMatch) {
      const body = await readJson(req);
      const friendId = messageMatch[1];
      const message = {
        id: `msg_${Date.now()}`,
        from: 'me',
        body: String(body.body || '').trim(),
        dataSource: body.dataSource || TEST_SOURCE
      };
      if (!message.body) {
        sendJson(res, 400, { ok: false, error: 'body_required' });
        return true;
      }
      state.messages[friendId] = state.messages[friendId] || [];
      state.messages[friendId].push(message);
      saveState();
      sendJson(res, 201, { ok: true, message });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/ai/compose-post') {
      const body = await readJson(req);
      const draft = String(body.draft || '').trim();
      sendJson(res, 200, {
        content: `${draft}\n\nAI 建议：适合标记为「咖啡」「Carlton」「新朋友」，发布后可推荐给附近有相同兴趣的人。`,
        tags: ['咖啡', 'Carlton', '新朋友']
      });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/ai/search-local') {
      const body = await readJson(req);
      sendJson(res, 200, {
        query: body.query || '',
        results: state.posts.filter((post) => post.content.includes(body.query || '') || post.city.includes(body.query || '')).slice(0, 5)
      });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/ai/recommend-cards') {
      const body = await readJson(req);
      const city = String(body.city || 'Melbourne');
      const cards = Object.values(state.profiles)
        .filter((profile) => profile.id !== 'me')
        .filter((profile) => profile.meta.includes(city) || profile.meta.includes('Melbourne'))
        .slice(0, 4);
      sendJson(res, 200, { city, cards });
      return true;
    }

    if (req.method === 'POST' && path === '/api/v1/ai/command') {
      const body = await readJson(req);
      sendJson(res, 200, resolveAiCommand(body.text));
      return true;
    }
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
    return true;
  }

  if (path.startsWith('/api/')) {
    sendJson(res, 404, { ok: false, error: 'api_not_found' });
    return true;
  }

  return false;
}

function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const target = resolve(join(root, clean === '/' ? '/app/' : clean));

  if (!target.startsWith(root)) {
    return null;
  }

  if (existsSync(target) && statSync(target).isDirectory()) {
    return join(target, 'index.html');
  }

  return target;
}

const server = createServer(async (req, res) => {
  if (await handleApi(req, res)) {
    return;
  }

  const file = resolvePath(req.url || '/');

  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'content-type': types[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Huaban V1.1 preview: http://${host}:${port}/app/`);
});
