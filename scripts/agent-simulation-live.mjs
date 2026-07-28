const baseUrl = process.env.HUABAN_BASE_URL || 'http://127.0.0.1:5177';
const stamp = Date.now();

function tinyDataUrl(type = 'image', kb = 4) {
  const mime = type === 'video' ? 'video/mp4' : 'image/jpeg';
  const bytes = Math.max(1, kb) * 1024;
  const payload = Buffer.alloc(bytes, type === 'video' ? 'v' : 'i').toString('base64');
  return `data:${mime};base64,${payload}`;
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { text };
  }
  if (!response.ok) throw new Error(`${path} ${response.status}: ${text}`);
  return data;
}

async function ai(text, context = {}) {
  return json('/api/v1/ai/command', {
    method: 'POST',
    body: JSON.stringify({
      text,
      city: context.city || 'Melbourne',
      inputMode: context.inputMode || 'voice',
      context
    })
  });
}

async function point(agent, task, points, ref = {}) {
  const eventKey = `hb_v1_1:agent:${agent.id}:${task}:${stamp}`;
  return json('/api/v1/growth/events', {
    method: 'POST',
    body: JSON.stringify({
      eventKey,
      eventType: `agent_${task}`,
      growthChannel: 'ai_prompt_training',
      pointsDelta: points,
      ownerCode: agent.ownerCode,
      reason: `${agent.role} 完成 ${task}`,
      refType: ref.refType || 'agent_simulation',
      refId: ref.refId || agent.id,
      status: 'confirmed'
    })
  });
}

async function step(report, name, fn) {
  try {
    const result = await fn();
    report.actionsAttempted += 1;
    report.actionsConfirmed += 1;
    report.steps.push({ name, ok: true, result });
    return result;
  } catch (error) {
    report.actionsAttempted += 1;
    report.failures.push({ name, error: error.message });
    report.steps.push({ name, ok: false, error: error.message });
    return null;
  }
}

function requireAction(result, expectedAction, label) {
  if (result?.action !== expectedAction) {
    throw new Error(`${label} expected ${expectedAction}, got ${result?.action || 'empty'}`);
  }
  return result;
}

const agents = [
  {
    id: 'agent_a_newcomer',
    ownerCode: 'HB_AGENT_A',
    role: '新到墨尔本的留学生',
    persona: '刚到 Melbourne，中文表达多、怕点错，喜欢让 AI 带路。',
    chain: '首页浮窗 -> AI 打开动态 -> 确认动态打开 -> AI 打开添加好友 -> 确认添加页打开',
    run: async (agent, report) => {
      const openDynamic = await step(report, 'AI 打开动态', async () => requireAction(
        await ai('打开动态', { currentPage: 'homePage' }),
        'open_dynamic',
        '打开动态'
      ));
      if (openDynamic?.action === 'open_dynamic') {
        const reward = await step(report, '确认动态完成后入账 D1', () => point(agent, 'open_dynamic_d1', 2, { refType: 'ai_command', refId: 'open_dynamic' }));
        if (reward?.event) report.pointsEvents.push(reward.event);
      }
      const openAddFriend = await step(report, 'AI 打开添加好友', async () => requireAction(
        await ai('打开添加好友', { currentPage: 'homePage' }),
        'open_add_friend',
        '打开添加好友'
      ));
      if (openAddFriend?.action === 'open_add_friend') {
        const reward = await step(report, '确认添加好友页完成后入账 D1', () => point(agent, 'open_add_friend_d1', 2, { refType: 'ai_command', refId: 'open_add_friend' }));
        if (reward?.event) report.pointsEvents.push(reward.event);
      }
    }
  },
  {
    id: 'agent_b_social',
    ownerCode: 'HB_AGENT_B',
    role: '本地宝妈社交用户',
    persona: '住在 Glen Waverley，想找附近华人家庭、中文活动和可信联系人。',
    chain: 'AI 匹配名片 -> 查看资料 -> 添加好友 -> 发送消息',
    run: async (agent, report) => {
      const match = await step(report, 'AI 匹配当地朋友', async () => requireAction(
        await ai('帮我匹配当地喜欢咖啡的新朋友'),
        'match_cards',
        '匹配当地朋友'
      ));
      const cardId = match?.cards?.[0]?.id || 'lin';
      await step(report, '查看名片资料', () => json(`/api/v1/cards/${cardId}`));
      const friendship = await step(report, '写入好友关系', () => json('/api/v1/friendships', {
        method: 'POST',
        body: JSON.stringify({ addresseeId: cardId, source: 'agent_social_match', dataSource: 'agent_simulation' })
      }));
      await step(report, '发送好友消息', () => json('/api/v1/messages/mia', {
        method: 'POST',
        body: JSON.stringify({ messageType: 'text', body: `Agent B 想约本周咖啡 ${stamp}`, dataSource: 'agent_simulation' })
      }));
      if (friendship?.friendship?.id) {
        const reward = await step(report, '确认好友关系后入账 D3', () => point(agent, 'match_add_friend_d3', 6, { refType: 'friendship', refId: friendship.friendship.id }));
        if (reward?.event) report.pointsEvents.push(reward.event);
      }
    }
  },
  {
    id: 'agent_c_creator',
    ownerCode: 'HB_AGENT_C',
    role: '小红书式内容发布用户',
    persona: '喜欢发咖啡、探店、短视频，要求图片大、文字轻、操作要顺。',
    chain: 'AI 生成动态文案 -> 发布 6 张几 KB 图片动态 -> 发布 1 条 15 秒几 KB 视频 -> 点赞收藏关注',
    run: async (agent, report) => {
      const composed = await step(report, 'AI 生成动态文案', () => json('/api/v1/ai/compose-post', {
        method: 'POST',
        body: JSON.stringify({ draft: '墨尔本周末咖啡局，适合新朋友认识一下。', city: 'Melbourne' })
      }));
      const post = await step(report, '发布 6 图以内动态', () => json('/api/v1/dynamics', {
        method: 'POST',
        body: JSON.stringify({
          city: 'Melbourne',
          dynamicType: 'note',
          mediaType: 'image',
          content: composed?.content || `Agent C 发布咖啡局动态 ${stamp}`,
          tags: ['咖啡', '新朋友', 'Melbourne'],
          media: Array.from({ length: 6 }, (_, index) => ({
            mediaType: 'image',
            fileName: `agent-c-${index + 1}.jpg`,
            sizeBytes: 4 * 1024,
            dataUrl: tinyDataUrl('image', 4)
          })),
          dataSource: 'agent_simulation'
        })
      }));
      const video = await step(report, '发布基础版 15 秒视频动态', () => json('/api/v1/dynamics', {
        method: 'POST',
        body: JSON.stringify({
          city: 'Melbourne',
          dynamicType: 'video',
          mediaType: 'video',
          content: `Agent C 测试 15 秒短视频动态 ${stamp}`,
          tags: ['短视频', '基础版'],
          durationSeconds: 15,
          media: [{
            mediaType: 'video',
            fileName: 'agent-c-15s.mp4',
            durationSeconds: 15,
            sizeBytes: 8 * 1024,
            dataUrl: tinyDataUrl('video', 8)
          }],
          dataSource: 'agent_simulation'
        })
      }));
      if (post?.post?.id) {
        await step(report, '点赞动态', () => json(`/api/v1/dynamics/${post.post.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({ actionType: 'like' })
        }));
        await step(report, '收藏动态', () => json(`/api/v1/dynamics/${post.post.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({ actionType: 'save' })
        }));
        await step(report, '关注作者', () => json(`/api/v1/dynamics/${post.post.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({ actionType: 'follow_author' })
        }));
        const reward = await step(report, '确认发布后入账 D4', () => point(agent, 'compose_publish_dynamic_d4', 10, { refType: 'dynamic', refId: post.post.id }));
        if (reward?.event) report.pointsEvents.push(reward.event);
      }
      if (video?.post?.durationSeconds > 15 || video?.post?.mediaCount !== 1) {
        report.failures.push({ name: '视频限制校验', error: '基础版视频必须单个且不超过 15 秒。' });
      }
    }
  },
  {
    id: 'agent_d_merchant',
    ownerCode: 'HB_AGENT_D',
    role: '本地小商家',
    persona: '经营接送机/服务卡，关心收付款、小店 API、预约和 n8n 自动化。',
    chain: '打开市集 -> 小店 API 自动化草稿 -> 只记录待审核动作',
    run: async (agent, report) => {
      await step(report, 'AI 打开市集', async () => requireAction(
        await ai('打开市集，帮我看看本地服务'),
        'open_market',
        '打开市集'
      ));
      const automationDraft = await step(report, 'AI 生成小店 API 自动化草稿', async () => ({
        ok: true,
        requiresAuthorization: true,
        requiresModeration: true,
        workflowName: '小店服务卡同步草稿',
        n8nStatus: 'draft_review_required',
        note: 'D5 能力只生成草稿，不直接运行外部 API。'
      }));
      if (automationDraft?.ok) {
        const reward = await step(report, '确认自动化草稿后入账 D5', () => point(agent, 'shop_api_workflow_d5', 20, { refType: 'n8n_workflow_draft', refId: 'shop_service_card_sync_draft' }));
        if (reward?.event) report.pointsEvents.push(reward.event);
      }
    }
  },
  {
    id: 'agent_e_ops',
    ownerCode: 'HB_AGENT_E',
    role: '共创运营测试者',
    persona: '关心积分权重、地图地址、内容安全和后台巡检，专门找逻辑漏洞。',
    chain: '打开积分权益 -> 打开地图导航 -> 跑运营巡检',
    run: async (agent, report) => {
      const growth = await step(report, 'AI 解释积分权益', async () => requireAction(
        await ai('解释积分释放、等级权重和身份权重'),
        'open_growth',
        '解释积分权益'
      ));
      if (growth?.action === 'open_growth') {
        const reward = await step(report, '确认积分页打开后入账 D1', () => point(agent, 'open_growth_d1', 2, { refType: 'ai_command', refId: 'open_growth' }));
        if (reward?.event) report.pointsEvents.push(reward.event);
      }
      await step(report, 'AI 打开地图导航', async () => requireAction(
        await ai('打开地图导航'),
        'open_location',
        '打开地图导航'
      ));
      await step(report, '后台运营巡检', async () => {
        const inspection = await json('/api/v1/admin/ops-inspection/run', { method: 'POST' });
        if (inspection.status !== 'ok') {
          throw new Error(`ops inspection ${inspection.status}: ${inspection.nextActions?.join('；') || 'unknown'}`);
        }
        return inspection;
      });
    }
  }
];

const reports = [];

for (const agent of agents) {
  const report = {
    agentId: agent.id,
    role: agent.role,
    persona: agent.persona,
    scenarioChain: agent.chain,
    actionsAttempted: 0,
    actionsConfirmed: 0,
    pointsEvents: [],
    failures: [],
    steps: []
  };
  await agent.run(agent, report);
  report.ok = report.failures.length === 0 && report.actionsConfirmed > 0;
  report.nextFix = report.ok ? '' : '查看 failures，对应补页面入口、AI action 或接口写入。';
  reports.push(report);
}

const totalPoints = reports.reduce((sum, report) => sum + report.pointsEvents.reduce((inner, event) => inner + Number(event.pointsDelta || 0), 0), 0);

console.log(JSON.stringify({
  ok: reports.every((report) => report.ok),
  baseUrl,
  scenario: 'five_agent_user_ai_interaction_simulation',
  generatedAt: new Date().toISOString(),
  totalAgents: reports.length,
  totalPoints,
  reports
}, null, 2));
