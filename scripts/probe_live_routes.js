const BASE_URL = process.env.HUABAN_PROBE_BASE_URL || 'https://www.huabanapp.com';

const ROUTES = [
  { name: '首页', path: '/', expect: [200] },
  { name: '官网页', path: '/official', expect: [200] },
  { name: '后台页', path: '/admin', expect: [200] },
  { name: '官网发布内容接口', path: '/api/site-content', query: { page: 'official_home' }, expect: [200, 404, 503] },
  { name: '后台官网管理接口', path: '/api/site-content', query: { page: 'official_home', admin: '1' }, expect: [401, 503] }
];

function buildUrl(route) {
  const url = new URL(route.path, BASE_URL);
  Object.entries(route.query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function probe(route) {
  const url = buildUrl(route);
  const started = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store' });
    const ms = Date.now() - started;
    const ok = route.expect.includes(res.status);
    return {
      name: route.name,
      url: url.toString(),
      status: res.status,
      ok,
      ms,
      cache: res.headers.get('cache-control') || '',
      vercel: res.headers.get('x-vercel-id') || ''
    };
  } catch (error) {
    return { name: route.name, url: url.toString(), status: 'ERR', ok: false, error: error.message };
  }
}

async function main() {
  const results = [];
  for (const route of ROUTES) {
    results.push(await probe(route));
  }
  const lines = results.map(item => {
    const mark = item.ok ? 'OK ' : 'FAIL';
    const extra = item.error ? ` ${item.error}` : ` ${item.ms}ms`;
    return `${mark} ${String(item.status).padEnd(4)} ${item.name} ${item.url}${extra}`;
  });
  console.log(lines.join('\n'));
  if (results.some(item => !item.ok)) process.exitCode = 1;
}

main();
