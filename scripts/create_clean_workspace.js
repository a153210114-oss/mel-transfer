const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, '华伴1.1-clean-workspace');

const FILES = [
  'index.html',
  'official.html',
  'ai.html',
  'profile.html',
  'admin.html',
  'privacy.html',
  'terms.html',
  'support.html',
  'app-download.html',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'sw.js',
  'vercel.json',
  'package.json',
  'package-lock.json',
  'README.md',
  'HUABAN_11_FUNCTIONAL_ARCHITECTURE.md',
  'HUABAN_11_MIGRATION_GATE.md',
  'HUABAN_11_CLEAN_GATE_REPORT.json',
  'api/admin-auth.js',
  'api/auth-phone-sync.js',
  'api/chat.js',
  'api/profile-summary.js',
  'api/referral-bind.js',
  'api/send-code.js',
  'api/site-content.js',
  'api/tts.js',
  'api/verify-code.js',
  'api/video-image.js',
  'lib/model-router.js',
  'assets/site-page-runtime.js',
  'assets/brand/apple-touch-icon.png',
  'assets/brand/huaban-logo-v1.png',
  'assets/brand/icon-192.png',
  'assets/brand/icon-512.png',
  'scripts/audit_clean_gate.js',
  'workflows/account_phone_verification_schema.sql',
  'workflows/contribution_halving_policy_schema.sql',
  'workflows/friend_referral_schema.sql',
  'workflows/growth_finance_schema.sql',
  'workflows/identity_phone_link_schema.sql',
  'workflows/private_tables_rls_lockdown.sql',
  'workflows/referral_points_test_cleanup.sql',
  'workflows/smart_contract_closure_schema.sql',
  'workflows/supply_profiles_schema.sql',
  'workflows/transaction_contract_proof_schema.sql'
];

const CLEAN_ENTRY_FILES = [
  'official.html',
  'index.html',
  'ai.html',
  'profile.html',
  'admin.html',
  'privacy.html',
  'terms.html',
  'support.html',
  'api/chat.js',
  'api/profile-summary.js',
  'api/referral-bind.js',
  'api/send-code.js',
  'api/verify-code.js',
  'api/auth-phone-sync.js',
  'api/site-content.js',
  'lib/model-router.js',
  'sw.js',
  'vercel.json',
  'README.md'
];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyFile(rel) {
  const src = path.join(ROOT, rel);
  const dest = path.join(DEST, rel);
  if (!fs.existsSync(src)) return null;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return {
    path: rel,
    bytes: fs.statSync(dest).size,
    sha256: sha256(dest)
  };
}

function writeText(rel, text) {
  const dest = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text);
}

function main() {
  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });

  const copied = FILES.map(copyFile).filter(Boolean);
  const missing = FILES.filter(rel => !fs.existsSync(path.join(ROOT, rel)));
  const now = new Date().toISOString();

  writeText('CLEAN_WORKSPACE_MANIFEST.md', `# 华伴 1.1 干净工作区

生成时间：${now}

## 使用规则

1. 这个目录是华伴 1.1 的唯一施工区。
2. 每次修改先在这里改，跑清洁门禁和脚本检查。
3. 验证通过后，再用这里的文件替换根目录同名文件。
4. 旧业务、旧页面、legacy、备份、node_modules、历史测试文件不得进入这个目录。
5. 每个文件只保留最新版本；历史版本留在 git 或根目录 legacy，不在干净工作区堆副本。

## 当前收录文件

${copied.map(item => `- \`${item.path}\` (${item.bytes} bytes, ${item.sha256.slice(0, 12)})`).join('\n')}

## 未找到文件

${missing.length ? missing.map(item => `- \`${item}\``).join('\n') : '无'}

## 清洁门禁范围

${CLEAN_ENTRY_FILES.map(item => `- \`${item}\``).join('\n')}
`);

  writeText('CLEAN_WORKSPACE_MANIFEST.json', JSON.stringify({
    generated_at: now,
    source_root: ROOT,
    workspace: DEST,
    files: copied,
    missing,
    clean_entry_files: CLEAN_ENTRY_FILES
  }, null, 2));

  writeText('README_CLEAN_WORKSPACE.md', `# 华伴 1.1 Clean Workspace

这里不是旧项目备份，而是最新 1.1 骨架和功能层的干净施工区。

推荐流程：

1. 修改本目录文件。
2. 运行：\`node scripts/audit_clean_gate.js\`
3. 运行对应语法检查。
4. 通过后替换根目录同名文件。
5. 再部署。
`);

  console.log(`clean workspace created: ${DEST}`);
  console.log(`files copied: ${copied.length}`);
  if (missing.length) console.log(`missing: ${missing.join(', ')}`);
}

main();
