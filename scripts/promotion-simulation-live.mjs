const baseUrl = process.env.HUABAN_BASE_URL || 'http://127.0.0.1:5177';
const stamp = Date.now();

const invite = {
  city: 'Sydney',
  inviter: {
    id: 'agent_sydney_inviter',
    ownerCode: 'HB_AGENT_SYDNEY',
    name: '周宁',
    role: '已经在华伴内测的悉尼用户'
  },
  recipient: {
    name: 'Owen',
    phone: '+61400111222',
    email: 'owen.sydney@example.test',
    isHuabanUser: false
  },
  campaign: 'sydney_external_phone_invite_v1',
  refCode: 'HB_AGENT_SYDNEY'
};

function landingUrl(channel) {
  const params = new URLSearchParams({
    ref: invite.refCode,
    campaign: invite.campaign,
    channel,
    city: invite.city,
    invite: 'phone_contact'
  });
  return `https://www.huabanapp.com/official/?${params.toString()}`;
}

function makeCopy() {
  const smsLink = landingUrl('sms');
  const emailLink = landingUrl('email');
  const smsText = `${invite.recipient.name}，我在华伴给你留了一个悉尼本地生活入口。中文用户用起来更顺，能找当地人、当地服务和AI帮忙整理信息：${smsLink}`;
  const emailSubject = `我在华伴给你留了一个 ${invite.city} 本地生活入口`;
  const emailBody = [
    `${invite.recipient.name}，`,
    '',
    `我正在测试华伴，一个贴合中文用户习惯的本地生活和通讯应用。它不是把你丢进十亿用户的信息海洋，而是先帮你看见 ${invite.city} 附近的人、服务和动态。`,
    '',
    `你可以从这个链接进入：${emailLink}`,
    '',
    '如果你还不是华伴用户，打开后会先看到招募和下载入口。中国区暂不开放。'
  ].join('\n');
  return { smsLink, emailLink, smsText, emailSubject, emailBody };
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
      city: invite.city,
      inputMode: 'voice',
      context
    })
  });
}

async function pendingPoint(eventType, reason, refId) {
  const result = await json('/api/v1/growth/events', {
    method: 'POST',
    body: JSON.stringify({
      eventKey: `hb_v1_1:promotion:${eventType}:${invite.refCode}:${stamp}`,
      eventType,
      growthChannel: 'external_invite_promotion',
      pointsDelta: 0,
      basePoints: 2,
      ownerCode: invite.inviter.ownerCode,
      relatedCode: '',
      reason,
      refType: 'external_invite',
      refId,
      status: 'pending_review'
    })
  });
  return {
    ok: result.ok,
    duplicate: result.duplicate || false,
    event: result.event,
    growth: {
      pointsBalance: result.growth?.pointsBalance,
      releaseLevel: result.growth?.releaseLevel,
      releaseRatio: result.growth?.releaseRatio
    }
  };
}

async function step(report, actor, name, fn) {
  try {
    const result = await fn();
    report.steps.push({ actor, name, ok: true, result });
    return result;
  } catch (error) {
    report.failures.push({ actor, name, error: error.message });
    report.steps.push({ actor, name, ok: false, error: error.message });
    return null;
  }
}

function assertAction(result, expected, label) {
  if (result?.action !== expected) {
    throw new Error(`${label} expected ${expected}, got ${result?.action || 'empty'}`);
  }
  return result;
}

function simulateChannel(channel, copy) {
  const isSms = channel === 'sms';
  return {
    channel,
    to: isSms ? invite.recipient.phone : invite.recipient.email,
    hook: isSms ? copy.smsText.split('：')[0] : copy.emailSubject,
    link: isSms ? copy.smsLink : copy.emailLink,
    status: isSms ? 'simulated_sent' : 'simulated_opened_and_clicked',
    deliveryMode: 'simulation_only_no_real_send',
    recipientIsHuabanUser: invite.recipient.isHuabanUser,
    nextRequiredAction: 'recipient_registers_or_claims_invite_before_points_confirmed'
  };
}

async function main() {
  const report = {
    ok: false,
    city: invite.city,
    scenario: '第二组：异城手机号外部邀请，短信和邮件推广模拟',
    actors: [
      { id: 'agent_sydney_inviter', role: '分享者', persona: '悉尼内测用户，想把 Owen 拉进华伴。' },
      { id: 'agent_phone_nonuser', role: '手机号好友', persona: '对方还不是华伴用户，只能进入邀请链路。' },
      { id: 'agent_sms_channel', role: '短信渠道', persona: '短钩子、短链接、可追踪点击。' },
      { id: 'agent_email_channel', role: '邮件渠道', persona: '较完整解释价值和下载入口。' },
      { id: 'agent_conversion_ops', role: '运营观察', persona: '确认没有未完成动作就发积分。' }
    ],
    steps: [],
    failures: [],
    checks: []
  };

  const copy = makeCopy();

  const addFriend = await step(report, 'agent_sydney_inviter', 'AI 打开添加好友', async () => assertAction(
    await ai('打开添加好友', { currentPage: 'homePage', city: invite.city }),
    'open_add_friend',
    '打开添加好友'
  ));

  const friendship = await step(report, 'agent_phone_nonuser', '手机号添加外部好友并生成邀请记录', () => json('/api/v1/friendships', {
    method: 'POST',
    body: JSON.stringify({
      ownerCode: invite.inviter.ownerCode,
      addresseeId: 'external_phone_owen_sydney',
      friendName: invite.recipient.name,
      friendPhone: invite.recipient.phone,
      friendEmail: invite.recipient.email,
      recipientIsHuabanUser: false,
      inviteStatus: 'external_invite_created',
      inviteChannels: ['sms', 'email'],
      inviteLinks: { sms: copy.smsLink, email: copy.emailLink },
      city: invite.city,
      campaign: invite.campaign,
      refCode: invite.refCode,
      source: 'phone_contact_external_invite',
      dataSource: 'promotion_simulation'
    })
  }));

  const sms = await step(report, 'agent_sms_channel', '生成并模拟短信邀请', async () => simulateChannel('sms', copy));
  const email = await step(report, 'agent_email_channel', '生成并模拟邮件邀请', async () => simulateChannel('email', copy));

  const pending = await step(report, 'agent_conversion_ops', '写入待确认积分事件', () => pendingPoint(
    'external_invite_generated',
    '外部手机号好友邀请已生成，等待对方注册或认领后确认积分。',
    friendship?.friendship?.id || 'external_phone_owen_sydney'
  ));

  const ops = await step(report, 'agent_conversion_ops', '运行运营巡检', () => json('/api/v1/admin/ops-inspection/run', {
    method: 'POST',
    body: JSON.stringify({})
  }));

  report.checks.push(
    { name: '添加好友 AI 动作', ok: addFriend?.action === 'open_add_friend' },
    { name: '外部好友未注册状态', ok: friendship?.friendship?.recipientIsHuabanUser === false && friendship.friendship.status === 'invited' },
    { name: '短信带钩子和链接', ok: Boolean(sms?.hook && sms?.link?.includes('channel=sms')) },
    { name: '邮件带主题和链接', ok: Boolean(email?.hook && email?.link?.includes('channel=email')) },
    { name: '未完成注册不发确认积分', ok: pending?.event?.status === 'pending_review' && pending.event.pointsDelta === 0 },
    { name: '运营巡检可用', ok: ops?.status === 'ok' || Boolean(ops?.ok) }
  );

  report.ok = report.failures.length === 0 && report.checks.every((item) => item.ok);
  report.summary = {
    inviter: invite.inviter.ownerCode,
    recipient: invite.recipient.name,
    recipientIsHuabanUser: invite.recipient.isHuabanUser,
    sms: { to: sms?.to, link: sms?.link, status: sms?.status },
    email: { to: email?.to, link: email?.link, status: email?.status },
    pointsPolicy: '只生成邀请不入账；对方注册或认领完成后再确认积分。',
    friendshipStatus: friendship?.friendship?.status || '',
    inviteStatus: friendship?.friendship?.inviteStatus || ''
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
