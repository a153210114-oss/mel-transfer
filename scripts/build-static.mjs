import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const dir of ['app', 'admin', 'official', 'assets']) {
  const source = join(root, dir);
  if (existsSync(source)) {
    cpSync(source, join(dist, dir), { recursive: true });
  }
}

cpSync(join(root, 'app', 'index.html'), join(dist, 'index.html'));

console.log('Huaban V1.1 static build ready in dist/.');
