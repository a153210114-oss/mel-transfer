const baseUrl = process.env.HUABAN_BASE_URL || 'http://127.0.0.1:5177';
const stamp = Date.now();

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  const body = await response.text();
  let data = {};
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    data = { body };
  }
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${body}`);
  }
  return data;
}

async function ok(name, fn) {
  const result = await fn();
  return { name, ok: true, result };
}

const chain = [];

chain.push(await ok('01_用户端打开', async () => {
  const response = await fetch(`${baseUrl}/app/`);
  return { status: response.status, ok: response.ok };
}));

chain.push(await ok('02_后台打开', async () => {
  const response = await fetch(`${baseUrl}/admin/`);
  return { status: response.status, ok: response.ok };
}));

chain.push(await ok('03_真测模式确认', async () => {
  const status = await json('/api/v1/admin/test-status');
  if (status.mode !== 'local_persistent_test' || !status.writable) throw new Error('not writable test mode');
  return { mode: status.mode, persisted: status.persisted };
}));

chain.push(await ok('04_AI搜索附近服务', async () => {
  const response = await json('/api/v1/ai/command', {
    method: 'POST',
    body: JSON.stringify({ text: '搜索附近接送机和咖啡活动', city: 'Melbourne' })
  });
  if (!response.action) throw new Error('missing ai action');
  return { action: response.action, message: response.message };
}));

chain.push(await ok('05_AI匹配名片', async () => {
  const response = await json('/api/v1/ai/command', {
    method: 'POST',
    body: JSON.stringify({ text: '帮我匹配当地朋友', city: 'Melbourne' })
  });
  if (response.action !== 'match_cards') throw new Error(`unexpected action ${response.action}`);
  return { cards: response.cards.length };
}));

chain.push(await ok('06_用户发布动态', async () => {
  const response = await json('/api/v1/dynamics', {
    method: 'POST',
    body: JSON.stringify({
      city: 'Melbourne',
      dynamicType: 'note',
      mediaType: 'text',
      content: `全场景流程链：今天测试华伴用户端发布动态 ${stamp}`,
      tags: ['全场景', '真测'],
      dataSource: 'test_local'
    })
  });
  if (!response.post?.id) throw new Error('post missing');
  return { postId: response.post.id };
}));

const postId = chain.at(-1).result.postId;

chain.push(await ok('07_动态互动点赞收藏关注', async () => {
  await json(`/api/v1/dynamics/${postId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ actionType: 'like' })
  });
  await json(`/api/v1/dynamics/${postId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ actionType: 'save' })
  });
  await json(`/api/v1/dynamics/${postId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ actionType: 'follow_author' })
  });
  const feed = await json('/api/v1/dynamics');
  const post = feed.dynamics.find((item) => item.id === postId);
  if (!post?.actions?.liked || !post?.actions?.saved || !post?.actions?.followed) {
    throw new Error('actions not persisted');
  }
  return post.actions;
}));

chain.push(await ok('08_查看名片并加好友', async () => {
  const card = await json('/api/v1/cards/lin');
  const friendship = await json('/api/v1/friendships', {
    method: 'POST',
    body: JSON.stringify({ addresseeId: card.profile.id, source: 'scenario_chain', dataSource: 'test_local' })
  });
  return { profile: card.profile.name, friendshipId: friendship.friendship.id };
}));

chain.push(await ok('09_聊天消息写入', async () => {
  const message = await json('/api/v1/messages/mia', {
    method: 'POST',
    body: JSON.stringify({ messageType: 'text', body: `全场景流程链消息 ${stamp}`, dataSource: 'test_local' })
  });
  const messages = await json('/api/v1/messages/mia');
  if (!messages.messages.some((item) => item.id === message.message.id)) throw new Error('message not persisted');
  return { messageId: message.message.id, total: messages.messages.length };
}));

chain.push(await ok('10_积分解释和积分事件', async () => {
  const ai = await json('/api/v1/ai/command', {
    method: 'POST',
    body: JSON.stringify({ text: '积分释放和等级升级关系清楚吗' })
  });
  const before = await json('/api/v1/me/growth');
  const eventKey = `hb_v1_1:scenario:${Date.now()}:feedback`;
  await json('/api/v1/growth/events', {
    method: 'POST',
    body: JSON.stringify({ eventKey, eventType: 'scenario_feedback', growthChannel: 'feedback', pointsDelta: 2, ownerCode: 'HB110001', reason: '全场景流程链反馈' })
  });
  await json('/api/v1/growth/events', {
    method: 'POST',
    body: JSON.stringify({ eventKey, eventType: 'scenario_feedback', growthChannel: 'feedback', pointsDelta: 2, ownerCode: 'HB110001', reason: '全场景流程链反馈重复提交' })
  });
  const after = await json('/api/v1/me/growth');
  if (ai.action !== 'open_growth' || after.pointsBalance !== before.pointsBalance + 2) {
    throw new Error('growth chain failed');
  }
  return { action: ai.action, before: before.pointsBalance, after: after.pointsBalance };
}));

chain.push(await ok('11_后台概览同步', async () => {
  const overview = await json('/api/v1/admin/overview');
  const required = ['supply', 'radar', 'demand', 'website', 'growth', 'automation'];
  if (!required.every((id) => overview.modules.some((item) => item.id === id))) throw new Error('admin modules missing');
  return overview.stats;
}));

chain.push(await ok('12_城市内容审核', async () => {
  const queue = await json('/api/v1/admin/city-content');
  const target = queue.queue.find((item) => item.status === 'pending') || queue.queue[0];
  if (!target) return { skipped: true };
  const response = await json('/api/v1/admin/city-content/review', {
    method: 'POST',
    body: JSON.stringify({ id: target.id, status: 'approved' })
  });
  return { id: response.item.id, status: response.item.status };
}));

chain.push(await ok('13_供给侧新增资料', async () => {
  const response = await json('/api/v1/admin/supply/profiles', {
    method: 'POST',
    body: JSON.stringify({
      name: `全场景供给 ${stamp}`,
      contact: '+61433 222 111',
      serviceType: '接送机',
      city: 'Melbourne',
      intro: '全场景流程链录入',
      dataSource: 'test_local'
    })
  });
  return { id: response.profile.id, status: response.profile.status };
}));

chain.push(await ok('14_雷达试扫', async () => {
  const response = await json('/api/v1/admin/supply/radar/tick', {
    method: 'POST',
    body: JSON.stringify({ force: true })
  });
  return { decision: response.radar.decision, task: response.task?.id || null, profile: response.profile?.id || null };
}));

chain.push(await ok('15_需求匹配读取', async () => {
  const response = await json('/api/v1/admin/demands');
  if (!response.demands.length) throw new Error('no demand cards');
  return { count: response.demands.length, first: response.demands[0].serviceType };
}));

chain.push(await ok('16_官网草稿保存并发布', async () => {
  const draft = await json('/api/v1/admin/website/content', {
    method: 'POST',
    body: JSON.stringify({
      pageKey: 'official_home',
      publish: false,
      content: { scenarioDraftAt: new Date().toISOString() }
    })
  });
  const published = await json('/api/v1/admin/website/content', {
    method: 'POST',
    body: JSON.stringify({
      pageKey: 'official_home',
      publish: true,
      content: { scenarioPublishedAt: new Date().toISOString() }
    })
  });
  return { draftVersion: draft.page.version, publishedVersion: published.page.version, status: published.page.status };
}));

chain.push(await ok('17_自动化任务记录', async () => {
  const jobs = await json('/api/v1/admin/automation-jobs');
  if (!jobs.jobs.length) throw new Error('no automation jobs');
  return { count: jobs.jobs.length, latest: jobs.jobs[0].jobName };
}));

chain.push(await ok('18_运营巡检', async () => {
  const inspection = await json('/api/v1/admin/ops-inspection/run', { method: 'POST' });
  if (inspection.status !== 'ok') throw new Error(`inspection ${inspection.status}`);
  return inspection.summary;
}));

chain.push(await ok('19_最终数据汇总', async () => {
  const overview = await json('/api/v1/admin/overview');
  return overview.stats;
}));

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  scenario: 'full_user_admin_growth_supply_radar_demand_website_ops_chain',
  passed: chain.length,
  chain
}, null, 2));
