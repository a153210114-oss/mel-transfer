import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const required = [
  'README.md',
  'app/index.html',
  'api/contract.md',
  'db/schema.sql',
  'docs/V1.1_SCOPE.md',
  'docs/SYSTEM_RESET_PLAN.md',
  'docs/DATA_DICTIONARY.md',
  'docs/GROWTH_FLYWHEEL.md',
  'docs/AI_ASSISTANT_DUTIES.md',
  'docs/OPS_INSPECTION.md',
  'n8n/README.md',
  'admin/index.html',
  'admin/ops-center.html',
  'scripts/ops-inspection.mjs',
  'scripts/e2e-live.mjs',
  'scripts/scenario-live.mjs',
];

const missing = required.filter((file) => !existsSync(resolve(file)));

if (missing.length > 0) {
  console.error(`Missing required files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  process.exit(1);
}

console.log('Huaban V1.1 skeleton probe passed.');
