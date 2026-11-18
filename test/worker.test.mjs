// OAuth worker: configuration and failure paths must end in a clear response.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';

const ENV = {
  ALLOWED_ORIGIN: 'https://landingconvierte.cl',
  GITHUB_CLIENT_ID: 'id',
  GITHUB_CLIENT_SECRET: 'secret'
};
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const callback = (cookieState = 's1', queryState = 's1') => new Request(
  `https://w.example/callback?code=c&state=${queryState}`,
  { headers: { Cookie: `decap_oauth_state=${cookieState}` } }
);

test('auth pide solo public_repo y read:user', async () => {
  const res = await worker.fetch(new Request('https://w.example/auth?provider=github'), ENV);
  assert.equal(res.status, 302);
  const scope = new URL(res.headers.get('Location')).searchParams.get('scope');
  assert.equal(scope, 'public_repo,read:user');
});

test('falta configuración: responde 500 con mensaje claro en auth y callback', async () => {
  for (const missing of ['ALLOWED_ORIGIN', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']) {
    const env = { ...ENV, [missing]: undefined };
    for (const req of [new Request('https://w.example/auth?provider=github'), callback()]) {
      const res = await worker.fetch(req, env);
      assert.equal(res.status, 500, `${missing} ${req.url}`);
      assert.match(await res.text(), new RegExp(missing));
    }
  }
});

test('state distinto: página de error, sin llamar a GitHub', async () => {
  globalThis.fetch = () => { throw new Error('no debería llamarse'); };
  const res = await worker.fetch(callback('s1', 's2'), ENV);
  assert.match(await res.text(), /authorization:github:error:.*Invalid OAuth state/);
});

test('fallo de red al canjear el código: página de error, no excepción', async () => {
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  const res = await worker.fetch(callback(), ENV);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /authorization:github:error:.*GitHub/);
});

test('canje exitoso: entrega el token solo al origen permitido', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
  const html = await (await worker.fetch(callback(), ENV)).text();
  assert.match(html, /authorization:github:success:.*tok/);
  assert.match(html, /const origin = "https:\/\/landingconvierte\.cl"/);
});

test('callback page: strict CSP with a per-response nonce, no framing, no referrer', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
  const res = await worker.fetch(callback(), ENV);
  const csp = res.headers.get('Content-Security-Policy') || '';
  const nonce = csp.match(/script-src 'nonce-([A-Za-z0-9+/=_-]+)'/)?.[1];
  assert.ok(nonce, `CSP sin nonce: ${csp}`);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  const html = await res.text();
  assert.match(html, new RegExp(`<script nonce="${nonce.replace(/[+/=]/g, '\\$&')}">`));
  assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');

  const again = await worker.fetch(callback(), ENV);
  assert.notEqual(again.headers.get('Content-Security-Policy'), csp, 'el nonce debe cambiar en cada respuesta');
});

test('auth redirect does not leak the referrer', async () => {
  const res = await worker.fetch(new Request('https://w.example/auth?provider=github'), ENV);
  assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer');
});
