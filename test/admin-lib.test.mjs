// Unit tests for the admin panel's pure helpers (admin-app/src/lib).
// No network: the GitHub client gets a fake fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeContent } from '../admin-app/src/lib/json.ts';
import { buildPutBody, saveFile, loadFile, utf8ToBase64, base64ToUtf8, GitHubError } from '../admin-app/src/lib/github.ts';
import { parseAuthMessage, buildAuthUrl } from '../admin-app/src/lib/oauth.ts';

test('serializeContent: 2-space indent, trailing newline, key order preserved', () => {
  const data = { z: 1, a: { y: 'ñandú', b: [1, { k: 'v', c: 'x' }] }, m: 'línea' };
  const out = serializeContent(data);
  assert.equal(out, '{\n  "z": 1,\n  "a": {\n    "y": "ñandú",\n    "b": [\n      1,\n      {\n        "k": "v",\n        "c": "x"\n      }\n    ]\n  },\n  "m": "línea"\n}\n');
});

test('serializeContent round-trips the repo content files byte for byte', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['index.json', 'landing-page.json']) {
    const text = readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8');
    assert.equal(serializeContent(JSON.parse(text)), text, f);
  }
});

test('utf8ToBase64 / base64ToUtf8 handle accents, ñ and emoji', () => {
  const s = 'Diseño de páginas — ¿Qué tal? ✓';
  assert.equal(utf8ToBase64(s), Buffer.from(s, 'utf8').toString('base64'));
  assert.equal(base64ToUtf8(Buffer.from(s, 'utf8').toString('base64')), s);
  // GitHub returns base64 wrapped with newlines
  assert.equal(base64ToUtf8(Buffer.from(s, 'utf8').toString('base64').replace(/(.{8})/g, '$1\n')), s);
});

test('buildPutBody: message, base64 UTF-8 content, sha and branch main', () => {
  const body = buildPutBody({ path: 'content/index.json', text: '{\n  "t": "Niño"\n}\n', sha: 'abc123', branch: 'main' });
  assert.deepEqual(body, {
    message: 'content: update content/index.json',
    content: Buffer.from('{\n  "t": "Niño"\n}\n', 'utf8').toString('base64'),
    sha: 'abc123',
    branch: 'main'
  });
});

function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const r = responses.shift();
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  };
  return { fn, calls };
}

test('saveFile sends an authenticated PUT to the contents API and returns the new sha', async () => {
  const { fn, calls } = fakeFetch([{ body: { content: { sha: 'new-sha' } } }]);
  const sha = await saveFile({ token: 'tok', repo: 'o/r', branch: 'main', path: 'content/site.json', text: 'ñ\n', sha: 'old', fetch: fn });
  assert.equal(sha, 'new-sha');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/o/r/contents/content/site.json');
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(calls[0].init.body), buildPutBody({ path: 'content/site.json', text: 'ñ\n', sha: 'old', branch: 'main' }));
});

test('saveFile surfaces 409 (sha conflict) and 401 (expired token) as GitHubError with status', async () => {
  for (const status of [409, 401]) {
    const { fn } = fakeFetch([{ status, body: { message: 'x' } }]);
    await assert.rejects(
      saveFile({ token: 't', repo: 'o/r', branch: 'main', path: 'content/a.json', text: '{}\n', sha: 's', fetch: fn }),
      err => err instanceof GitHubError && err.status === status
    );
  }
});

test('loadFile reads ?ref=main and decodes content with its sha', async () => {
  const text = '{\n  "a": "más"\n}\n';
  const { fn, calls } = fakeFetch([{ body: { sha: 's1', content: Buffer.from(text).toString('base64'), encoding: 'base64' } }]);
  const file = await loadFile({ token: 't', repo: 'o/r', branch: 'main', path: 'content/a.json', fetch: fn });
  assert.equal(calls[0].url, 'https://api.github.com/repos/o/r/contents/content/a.json?ref=main');
  assert.deepEqual(file, { sha: 's1', text });
});

test('parseAuthMessage: handshake, success, error and foreign messages', () => {
  assert.deepEqual(parseAuthMessage('authorizing:github'), { type: 'authorizing' });
  assert.deepEqual(
    parseAuthMessage('authorization:github:success:' + JSON.stringify({ token: 'gho_1', provider: 'github' })),
    { type: 'success', token: 'gho_1' }
  );
  assert.deepEqual(
    parseAuthMessage('authorization:github:error:' + JSON.stringify({ message: 'Invalid OAuth state' })),
    { type: 'error', message: 'Invalid OAuth state' }
  );
  assert.equal(parseAuthMessage('authorization:github:success:{not json'), null);
  assert.equal(parseAuthMessage('authorization:github:success:' + JSON.stringify({ provider: 'github' })), null);
  assert.equal(parseAuthMessage({ token: 'x' }), null);
  assert.equal(parseAuthMessage('hello'), null);
});

test('buildAuthUrl points to the worker /auth with provider=github', () => {
  const url = new URL(buildAuthUrl('https://w.example.workers.dev/', 'landingconvierte.cl'));
  assert.equal(url.origin + url.pathname, 'https://w.example.workers.dev/auth');
  assert.equal(url.searchParams.get('provider'), 'github');
  assert.equal(url.searchParams.get('site_id'), 'landingconvierte.cl');
});

test('setIn / moveItem / removeItem keep key order and do not mutate', async () => {
  const { setIn, moveItem, removeItem } = await import('../admin-app/src/lib/edit.ts');
  const data = { meta: { title: 'a' }, hero: { title: 'x', lead: 'y' }, list: [{ k: 1 }, { k: 2 }, { k: 3 }] };
  const next = setIn(data, ['hero', 'title'], 'Nuevo título');
  assert.deepEqual(Object.keys(next), ['meta', 'hero', 'list']);
  assert.deepEqual(Object.keys(next.hero), ['title', 'lead']);
  assert.equal(next.hero.title, 'Nuevo título');
  assert.equal(data.hero.title, 'x');
  assert.equal(next.meta, data.meta, 'untouched branches are shared');
  assert.equal(setIn(data, ['list', 1, 'k'], 9).list[1].k, 9);
  assert.deepEqual(moveItem(data.list, 2, 0).map(i => i.k), [3, 1, 2]);
  assert.equal(moveItem(data.list, 0, -1), data.list);
  assert.deepEqual(removeItem(data.list, 1).map(i => i.k), [1, 3]);
  assert.equal(data.list.length, 3);
});

test('schema covers every key of the content files', async () => {
  const { PAGES } = await import('../admin-app/src/lib/schema.ts');
  const { readFileSync } = await import('node:fs');
  for (const page of PAGES) {
    const data = JSON.parse(readFileSync(new URL(`../${page.path}`, import.meta.url), 'utf8'));
    const covered = new Set(page.sections.flatMap(s => (s.key ? [s.key] : s.fields.map(f => f.name))));
    assert.deepEqual(Object.keys(data).filter(k => !covered.has(k)), [], `${page.path}: keys without editor`);
    for (const section of page.sections.filter(s => s.key)) {
      const keys = Object.keys(data[section.key]);
      const names = section.fields.map(f => f.name);
      assert.deepEqual(keys.filter(k => !names.includes(k)), [], `${page.path} → ${section.key}: fields without editor`);
    }
  }
});

test('validatePage rejects unsafe links before publishing and accepts safe ones', async () => {
  const { PAGES } = await import('../admin-app/src/lib/schema.ts');
  const { validatePage } = await import('../admin-app/src/lib/validate.ts');
  const { readFileSync } = await import('node:fs');
  const page = PAGES.find(p => p.path === 'content/index.json');
  const data = JSON.parse(readFileSync(new URL('../content/index.json', import.meta.url), 'utf8'));
  assert.deepEqual(validatePage(page, data), []);
  data.hero.ctaPrimaryHref = 'javascript:alert(1)';
  const problems = validatePage(page, data);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /enlace no permitido/);
});

test('session token lives in sessionStorage and a legacy localStorage token is wiped', async () => {
  const mk = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
  globalThis.localStorage = mk();
  globalThis.sessionStorage = mk();
  localStorage.setItem('landingconvierte-admin-token', 'old');
  const { readToken, writeToken } = await import('../admin-app/src/lib/session.ts');
  assert.equal(readToken(), null);
  assert.equal(localStorage.getItem('landingconvierte-admin-token'), null);
  writeToken('tok');
  assert.equal(sessionStorage.getItem('landingconvierte-admin-token'), 'tok');
  assert.equal(localStorage.getItem('landingconvierte-admin-token'), null);
  assert.equal(readToken(), 'tok');
  writeToken(null);
  assert.equal(readToken(), null);
  delete globalThis.localStorage; delete globalThis.sessionStorage;
});
