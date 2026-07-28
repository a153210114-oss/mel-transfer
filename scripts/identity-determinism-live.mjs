const baseUrl = process.env.HUABAN_BASE_URL || 'http://127.0.0.1:5177';

const user = {
  code: 'HB_ID_A',
  oldPhone: '+61400111000',
  newPhone: '+61400111999'
};

const friend = {
  code: 'HB_ID_B',
  phone: '+61400112000'
};

function qrPayload({ code, refCode }) {
  return `huaban://card?code=${encodeURIComponent(code)}&ref=${encodeURIComponent(refCode)}&source=qr`;
}

function shareUrl({ code, refCode }) {
  return `https://www.huabanapp.com/app/?code=${encodeURIComponent(code)}&ref=${encodeURIComponent(refCode)}&source=share&channel=link`;
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

async function syncPhone(payload) {
  return json('/api/v1/identity/phone-sync', {
    method: 'POST',
    body: JSON.stringify({ dataSource: 'identity_determinism_live', ...payload })
  });
}

async function resolveIdentity(payload) {
  return json('/api/v1/identity/resolve', {
    method: 'POST',
    body: JSON.stringify({ dataSource: 'identity_determinism_live', ...payload })
  });
}

async function bind(inviterCode, refereeCode, source) {
  return json('/api/v1/referrals/bind', {
    method: 'POST',
    body: JSON.stringify({
      inviterCode,
      refereeCode,
      source,
      dataSource: 'identity_determinism_live'
    })
  });
}

async function main() {
  await json('/api/v1/admin/test-data/reset', { method: 'POST' });

  const firstPhone = await syncPhone({
    phone: user.oldPhone,
    requestedFriendCode: user.code
  });
  const changedPhone = await syncPhone({
    previousPhone: user.oldPhone,
    phone: user.newPhone,
    requestedFriendCode: user.code
  });
  const conflictingPhone = await syncPhone({
    phone: user.newPhone,
    requestedFriendCode: 'HB_ID_FAKE'
  });
  const friendPhone = await syncPhone({
    phone: friend.phone,
    requestedFriendCode: friend.code
  });

  const qr = await resolveIdentity({
    qrPayload: qrPayload({ code: friend.code, refCode: user.code }),
    source: 'qr_scan'
  });
  const link = await resolveIdentity({
    shareUrl: shareUrl({ code: friend.code, refCode: user.code }),
    source: 'share_link'
  });

  const qrReferral = await bind(qr.refCode, qr.code, 'qr_scan');
  const linkReferral = await bind(link.refCode, link.code, 'share_link');
  const audit = await json('/api/v1/admin/identity-audit');

  const checks = [
    {
      name: '首次手机号绑定生成确定身份码',
      ok: firstPhone.friendCode === user.code && firstPhone.phone === user.oldPhone
    },
    {
      name: '更换手机号后身份码不变',
      ok: changedPhone.friendCode === user.code && changedPhone.phone === user.newPhone && changedPhone.replaced?.status === 'phone_replaced'
    },
    {
      name: '同一新手机号再次请求假身份码时仍返回原身份码',
      ok: conflictingPhone.friendCode === user.code && conflictingPhone.requestedFriendCode === 'HB_ID_FAKE'
    },
    {
      name: '被扫用户身份码可独立绑定',
      ok: friendPhone.friendCode === friend.code
    },
    {
      name: '二维码解析的用户码和推荐码正确',
      ok: qr.code === friend.code && qr.refCode === user.code && qr.source === 'qr_scan'
    },
    {
      name: '分享链接解析与二维码一致',
      ok: link.code === qr.code && link.refCode === qr.refCode
    },
    {
      name: '二维码推荐绑定产生一级关系',
      ok: qrReferral.first_referrer_code === user.code && qrReferral.event?.inviterCode === user.code && qrReferral.event?.refereeCode === friend.code
    },
    {
      name: '分享链接重复绑定不改首位推荐关系',
      ok: linkReferral.first_referrer_code === user.code && linkReferral.credit_locked === false && Boolean(linkReferral.points?.direct?.duplicate)
    },
    {
      name: '身份审计无重复 active 手机号或重复身份链接',
      ok: audit.ok && audit.summary?.duplicatePhones?.length === 0 && audit.summary?.duplicateCodePhones?.length === 0
    }
  ];

  const report = {
    ok: checks.every((item) => item.ok),
    baseUrl,
    scenario: '用户身份唯一性和确定性：换手机号、二维码扫描、分享链接一致性',
    checks,
    results: {
      phoneChange: {
        old: firstPhone,
        changed: changedPhone,
        conflicting: conflictingPhone
      },
      scanAndShare: {
        qr,
        link,
        consistent: qr.code === link.code && qr.refCode === link.refCode
      },
      referrals: {
        qr: {
          first_referrer_code: qrReferral.first_referrer_code,
          credit_locked: qrReferral.credit_locked,
          event: qrReferral.event,
          direct: qrReferral.points?.direct
        },
        link: {
          first_referrer_code: linkReferral.first_referrer_code,
          credit_locked: linkReferral.credit_locked,
          event: linkReferral.event,
          direct: linkReferral.points?.direct
        }
      },
      audit: audit.summary
    }
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
