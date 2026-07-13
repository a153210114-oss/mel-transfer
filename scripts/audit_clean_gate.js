const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const files = [
  'official.html',
  'index.html',
  'ai.html',
  'profile.html',
  'admin.html',
  'privacy.html',
  'terms.html',
  'support.html',
  'api/chat.js',
  'api/site-content.js',
  'api/profile-summary.js',
  'api/referral-bind.js',
  'api/send-code.js',
  'api/verify-code.js',
  'api/auth-phone-sync.js',
  'sw.js',
  'vercel.json',
  'README.md'
];

const rules = [
  {
    id: 'old-positioning',
    level: 'blocker',
    pattern: /司机端|乘客端|机场接送|接送机|接机|送机|旅行伙伴|从旅行开始|墨尔本机场|司机管理|乘客管理/g
  },
  {
    id: 'legacy-local-identity',
    level: 'blocker',
    pattern: /au_passenger|au_driver|au_role|driver_app|passenger_recruit/g
  },
  {
    id: 'legacy-core-tables',
    level: 'blocker',
    pattern: /\bdrivers\b|\btrips\b|\bpublic_trips\b|\bvehicles\b|\btour_plaza\b/g
  },
  {
    id: 'front-end-supabase-privacy-read',
    level: 'review',
    appliesTo: 'frontend',
    pattern: /contacts\?|huaban_point_events\?|huaban_referral_events\?|huaban_identity_links\?|huaban_friendships\?|huaban_orders\?/g
  },
  {
    id: 'local-points-or-rights',
    level: 'blocker',
    pattern: /huaban_referral_points_cache|huaban_contribution_release_coefficient|localStorage\.getItem\([^)]*points|localStorage\.setItem\([^)]*points/g
  }
];

function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const report = [];

for (const file of files) {
  const text = read(file);
  if (text === null) {
    report.push({ file, status: 'missing', findings: [] });
    continue;
  }
  const findings = [];
  for (const rule of rules) {
    if (rule.appliesTo === 'frontend' && !/\.(html|js)$/.test(file)) continue;
    if (rule.appliesTo === 'frontend' && file.startsWith('api/')) continue;
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text))) {
      findings.push({
        rule: rule.id,
        level: rule.level,
        line: lineOf(text, match.index),
        text: match[0]
      });
    }
  }
  const blockers = findings.filter(item => item.level === 'blocker').length;
  report.push({
    file,
    status: blockers ? 'blocked' : findings.length ? 'review' : 'clean',
    findings
  });
}

const out = path.join(root, 'HUABAN_11_CLEAN_GATE_REPORT.json');
fs.writeFileSync(out, JSON.stringify({
  generated_at: new Date().toISOString(),
  rule: 'Only clean files may enter HuaBan 1.1 formal system.',
  report
}, null, 2));

const summary = report.map(item => {
  const blockers = item.findings.filter(f => f.level === 'blocker').length;
  const reviews = item.findings.filter(f => f.level === 'review').length;
  return `${item.status.toUpperCase().padEnd(8)} ${item.file}  blockers=${blockers} review=${reviews}`;
});

console.log(summary.join('\n'));
console.log(`\nReport: ${path.relative(root, out)}`);
