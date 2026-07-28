import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');
const outputDir = join(root, 'tmp');
const reportPath = join(outputDir, 'ops-inspection-report.json');

const requiredFiles = [
  'app/index.html',
  'admin/index.html',
  'admin/ops-center.html',
  'api/contract.md',
  'db/schema.sql',
  'docs/GROWTH_FLYWHEEL.md',
  'docs/IDENTITY_REFERRAL_POINTS_RULES.md',
  'docs/AI_ASSISTANT_DUTIES.md',
  'docs/OPS_INSPECTION.md',
  'n8n/README.md',
  'scripts/dev-server.mjs'
];

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function check(name, ok, detail, severity = 'medium') {
  return { name, ok, detail, severity };
}

export function runOpsInspection() {
  const appHtml = existsSync(join(root, 'app/index.html')) ? read('app/index.html') : '';
  const apiContract = existsSync(join(root, 'api/contract.md')) ? read('api/contract.md') : '';
  const schema = existsSync(join(root, 'db/schema.sql')) ? read('db/schema.sql') : '';
  const devServer = existsSync(join(root, 'scripts/dev-server.mjs')) ? read('scripts/dev-server.mjs') : '';
  const aiDuties = existsSync(join(root, 'docs/AI_ASSISTANT_DUTIES.md')) ? read('docs/AI_ASSISTANT_DUTIES.md') : '';
  const flywheel = existsSync(join(root, 'docs/GROWTH_FLYWHEEL.md')) ? read('docs/GROWTH_FLYWHEEL.md') : '';
  const certaintyRules = existsSync(join(root, 'docs/IDENTITY_REFERRAL_POINTS_RULES.md')) ? read('docs/IDENTITY_REFERRAL_POINTS_RULES.md') : '';

  const checks = [
    ...requiredFiles.map((file) => check(`文件存在：${file}`, existsSync(join(root, file)), file, 'high')),
    check('用户端有积分权益入口', appHtml.includes('积分权益') && appHtml.includes('参与越早，积分权重越高') && appHtml.includes('固定收益承诺'), '我页需展示合规积分入口', 'high'),
    check('后台管理中心存在', existsSync(join(root, 'admin/index.html')) && read('admin/index.html').includes('用户管理') && read('admin/index.html').includes('AI Prompt'), '后台需覆盖核心管理模块', 'high'),
    check('旧供给与雷达已迁回', read('admin/index.html').includes('供给侧') && read('admin/index.html').includes('雷达') && schema.includes('hb_supply_profiles') && schema.includes('hb_supply_radar_state'), '供给侧、雷达和对应数据表不能遗漏', 'high'),
    check('官网管理已迁回', read('admin/index.html').includes('官网管理') && schema.includes('hb_site_content') && schema.includes('hb_site_events'), '后台需能管理官网内容和官网事件', 'high'),
    check('需求匹配基础已迁回', read('admin/index.html').includes('需求匹配') && schema.includes('hb_demand_cards'), '需求卡基础数据需要保留用于 AI 整理和匹配', 'high'),
    check('本地真测持久化存在', devServer.includes('dev-state.json') && devServer.includes('saveState()') && devServer.includes('/api/v1/admin/test-status'), '测试环境必须写入本地数据，不能只停留在内存 mock', 'high'),
    check('AI 职责覆盖积分解释', aiDuties.includes('积分权益解释') && aiDuties.includes('不用投资'), 'AI 必须能解释积分机制和合规边界', 'high'),
    check('推广飞轮规则完整', flywheel.includes('42,000,000') && flywheel.includes('1/128') && flywheel.includes('净利润的 80%'), '总池、释放、分配池规则必须存在', 'high'),
    check('动态接口统一', apiContract.includes('GET `/dynamics') && apiContract.includes('POST `/dynamics`'), '朋友圈/视频号统一为动态接口', 'medium'),
    check('AI 指令接口存在', apiContract.includes('POST `/ai/command`'), '语音和文字总控入口', 'medium'),
    check('自动化任务表存在', schema.includes('hb_automation_jobs'), '后台与 n8n 任务记录表', 'high'),
    check('AI 日志表存在', schema.includes('hb_ai_logs'), 'AI 调用记录表', 'medium'),
    check('积分流水表存在', schema.includes('hb_points_events'), '积分触发与账本基础', 'high'),
    check('身份码唯一约束存在', schema.includes('code text not null unique') && schema.includes('idx_hb_identity_codes_active_user_kind'), '身份码必须全局唯一，用户个人身份码也要唯一', 'high'),
    check('推荐关系唯一约束存在', schema.includes('hb_referral_events') && schema.includes('unique (referee_code)') && schema.includes('unique (idempotency_key)'), '推荐关系必须一次绑定、幂等提交', 'high'),
    check('积分事件幂等约束存在', schema.includes('event_key text not null') && schema.includes('unique (event_key)') && schema.includes('pending_review') && schema.includes('reversed'), '积分入账必须按 event_key 幂等，支持审核和冲正', 'high'),
    check('确定性规则文档存在', certaintyRules.includes('身份码全局唯一') && certaintyRules.includes('referee_code') && certaintyRules.includes('event_key'), '身份、推荐、积分确定性规则必须可查', 'high'),
    check('避免固定收益承诺', appHtml.includes('固定收益承诺') && aiDuties.includes('不得承诺固定兑换比例'), '用户端和 AI 需保留风险边界', 'high')
  ];

  const failed = checks.filter((item) => !item.ok);
  const warnings = failed.filter((item) => item.severity !== 'high').length;
  const critical = failed.filter((item) => item.severity === 'high').length;
  const status = critical > 0 ? 'blocked' : warnings > 0 ? 'warning' : 'ok';

  const report = {
    generatedAt: new Date().toISOString(),
    status,
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      critical,
      warnings
    },
    checks,
    nextActions: failed.map((item) => item.detail)
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runOpsInspection();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.summary.critical > 0 ? 1 : 0);
}
