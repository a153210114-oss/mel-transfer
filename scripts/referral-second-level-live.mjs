const baseUrl = process.env.HUABAN_BASE_URL || 'http://127.0.0.1:5177';

const chain = {
  city: 'Sydney',
  a: { code: 'HB_REF_A', name: 'Ava', role: '初始分享者' },
  b: { code: 'HB_REF_B', name: 'Ben', role: '一级被推荐人，随后成为分享者' },
  c: { code: 'HB_REF_C', name: 'Chen', role: '二级被推荐人' }
};

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

async function bind(inviter, referee, label) {
  return json('/api/v1/referrals/bind', {
    method: 'POST',
    body: JSON.stringify({
      inviterCode: inviter.code,
      refereeCode: referee.code,
      inviter,
      referee,
      source: 'second_level_referral_live_test',
      dataSource: 'referral_second_level_live',
      label
    })
  });
}

function pointOk(point, ownerCode, action, points, duplicate = false) {
  return Boolean(
    point &&
    point.ownerCode === ownerCode &&
    point.eventType === action &&
    Number(point.pointsDelta) === points &&
    Boolean(point.duplicate) === duplicate
  );
}

async function main() {
  await json('/api/v1/admin/test-data/reset', { method: 'POST' });

  const first = await bind(chain.a, chain.b, 'A 推荐 B');
  const second = await bind(chain.b, chain.c, 'B 推荐 C');
  const repeat = await bind(chain.b, chain.c, '重复 B 推荐 C');
  const growth = await json('/api/v1/me/growth');

  const checks = [
    {
      name: 'A 推荐 B 产生一级 +20',
      ok: pointOk(first.points?.direct, chain.a.code, 'direct_referral_verified', 20)
    },
    {
      name: 'A 推荐 B 不产生二级',
      ok: first.points?.second === null
    },
    {
      name: 'B 推荐 C 产生一级 +20 给 B',
      ok: pointOk(second.points?.direct, chain.b.code, 'direct_referral_verified', 20)
    },
    {
      name: 'B 推荐 C 找到 A 作为二级上级',
      ok: second.second_level_referrer_code === chain.a.code
    },
    {
      name: 'B 推荐 C 产生二级 +6 给 A',
      ok: pointOk(second.points?.second, chain.a.code, 'second_level_referral_verified', 6)
    },
    {
      name: '重复 B 推荐 C 不重复给 B 一级积分',
      ok: Boolean(repeat.points?.direct?.duplicate)
    },
    {
      name: '重复 B 推荐 C 不重复给 A 二级积分',
      ok: Boolean(repeat.points?.second?.duplicate)
    }
  ];

  const referralEvents = (growth.events || []).filter((item) => [
    'direct_referral_verified',
    'second_level_referral_verified'
  ].includes(item.eventType));

  const report = {
    ok: checks.every((item) => item.ok),
    baseUrl,
    scenario: 'A 推荐 B，B 推荐 C，验证二级推广积分',
    chain,
    checks,
    results: {
      first: {
        first_referrer_code: first.first_referrer_code,
        second_level_referrer_code: first.second_level_referrer_code,
        direct: first.points?.direct,
        second: first.points?.second
      },
      second: {
        first_referrer_code: second.first_referrer_code,
        second_level_referrer_code: second.second_level_referrer_code,
        direct: second.points?.direct,
        second: second.points?.second
      },
      repeat: {
        first_referrer_code: repeat.first_referrer_code,
        second_level_referrer_code: repeat.second_level_referrer_code,
        direct: repeat.points?.direct,
        second: repeat.points?.second
      }
    },
    ledger: {
      pointsBalance: growth.pointsBalance,
      referralEvents: referralEvents.map((item) => ({
        ownerCode: item.ownerCode,
        eventType: item.eventType,
        pointsDelta: item.pointsDelta,
        relatedCode: item.relatedCode,
        eventKey: item.eventKey,
        duplicate: Boolean(item.duplicate)
      }))
    }
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
