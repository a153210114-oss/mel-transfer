const baseUrl = process.env.HUABAN_BASE_URL || 'http://127.0.0.1:5177';

async function request(path, options = {}) {
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
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${text}`);
  }
  return data;
}

function assert(name, condition, detail = '') {
  if (!condition) {
    throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
  }
  return { name, ok: true, detail };
}

const checks = [];

checks.push(assert('app html', (await fetch(`${baseUrl}/app/`)).ok));
checks.push(assert('admin html', (await fetch(`${baseUrl}/admin/`)).ok));
checks.push(assert('ops html', (await fetch(`${baseUrl}/admin/ops-center.html`)).ok));

const testStatus = await request('/api/v1/admin/test-status');
checks.push(assert('local persistent test mode', testStatus.mode === 'local_persistent_test' && testStatus.writable, testStatus.mode));

const beforeDynamics = await request('/api/v1/dynamics');
const createdPost = await request('/api/v1/dynamics', {
  method: 'POST',
  body: JSON.stringify({
    city: 'Melbourne',
    dynamicType: 'note',
    mediaType: 'text',
    content: `端到端真测动态 ${Date.now()}`,
    tags: ['真测']
  })
});
checks.push(assert('user publish dynamic', Boolean(createdPost.post?.id), createdPost.post?.id));

await request(`/api/v1/dynamics/${createdPost.post.id}/actions`, {
  method: 'POST',
  body: JSON.stringify({ actionType: 'like' })
});
const afterDynamics = await request('/api/v1/dynamics');
checks.push(assert('dynamic persisted in api', afterDynamics.dynamics.length === beforeDynamics.dynamics.length + 1));

const friendship = await request('/api/v1/friendships', {
  method: 'POST',
  body: JSON.stringify({ addresseeId: 'lin', source: 'e2e_test' })
});
checks.push(assert('friendship create', Boolean(friendship.friendship?.id)));

const message = await request('/api/v1/messages/mia', {
  method: 'POST',
  body: JSON.stringify({ messageType: 'text', body: `端到端消息 ${Date.now()}` })
});
checks.push(assert('message send', Boolean(message.message?.id)));

const aiCommand = await request('/api/v1/ai/command', {
  method: 'POST',
  body: JSON.stringify({ text: '解释积分释放和等级权重' })
});
checks.push(assert('ai growth command', aiCommand.action === 'open_growth'));

const supplyProfile = await request('/api/v1/admin/supply/profiles', {
  method: 'POST',
  body: JSON.stringify({
    name: `真测供给 ${Date.now()}`,
    contact: '+61422 000 111',
    serviceType: '真测服务',
    city: 'Melbourne',
    intro: '端到端测试写入'
  })
});
checks.push(assert('supply create', Boolean(supplyProfile.profile?.id)));

const radar = await request('/api/v1/admin/supply/radar/tick', {
  method: 'POST',
  body: JSON.stringify({ force: true })
});
checks.push(assert('radar tick', Boolean(radar.radar?.decision)));

const demands = await request('/api/v1/admin/demands');
checks.push(assert('demand cards readable', Array.isArray(demands.demands) && demands.demands.length > 0));

const website = await request('/api/v1/admin/website/content', {
  method: 'POST',
  body: JSON.stringify({
    pageKey: 'official_home',
    publish: false,
    content: { e2eLastSavedAt: new Date().toISOString() }
  })
});
checks.push(assert('website save draft', Boolean(website.page?.version)));

const growthBefore = await request('/api/v1/me/growth');
const e2eEventKey = `hb_v1_1:e2e:${Date.now()}:feedback`;
await request('/api/v1/growth/events', {
  method: 'POST',
  body: JSON.stringify({ eventKey: e2eEventKey, eventType: 'e2e_test', growthChannel: 'feedback', pointsDelta: 1, ownerCode: 'HB110001', reason: '端到端测试' })
});
await request('/api/v1/growth/events', {
  method: 'POST',
  body: JSON.stringify({ eventKey: e2eEventKey, eventType: 'e2e_test', growthChannel: 'feedback', pointsDelta: 1, ownerCode: 'HB110001', reason: '端到端测试重复提交' })
});
const growthAfter = await request('/api/v1/me/growth');
checks.push(assert('growth event write', growthAfter.pointsBalance === growthBefore.pointsBalance + 1));

const inspection = await request('/api/v1/admin/ops-inspection/run', { method: 'POST' });
checks.push(assert('ops inspection ok', inspection.status === 'ok', inspection.status));

const overview = await request('/api/v1/admin/overview');
checks.push(assert('admin modules complete', ['supply', 'radar', 'demand', 'website'].every((id) => overview.modules.some((item) => item.id === id))));

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  passed: checks.length,
  checks
}, null, 2));
