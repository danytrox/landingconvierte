// Security headers in _headers must match what the generated pages actually need.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Parses the Cloudflare _headers format into { path: [lines] }.
const parseHeaders = text => {
  const rules = {};
  let current = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { current = raw.trim(); rules[current] = []; } else rules[current].push(raw.trim());
  }
  return rules;
};
const header = (lines, name) => lines.find(l => l.toLowerCase().startsWith(`${name.toLowerCase()}:`))?.split(/:\s*/).slice(1).join(':');

const out = mkdtempSync(join(tmpdir(), 'security-headers-'));
const res = spawnSync(process.execPath, [join(ROOT, 'build.mjs')], { env: { ...process.env, OUT_DIR: out }, encoding: 'utf8' });
const rules = parseHeaders(readFileSync(join(out, '_headers'), 'utf8'));
const page = p => readFileSync(join(out, p), 'utf8');
process.on('exit', () => rmSync(out, { recursive: true, force: true }));

test('build ok', () => assert.equal(res.status, 0, res.stderr));

test('site CSP allows exactly the inline scripts the pages run, and nothing inline otherwise', () => {
  const csp = header(rules['/*'], 'Content-Security-Policy');
  assert.ok(csp, 'falta Content-Security-Policy en /*');
  for (const p of ['index.html', 'landing-page.html', '404.html']) {
    for (const [, body] of page(p).matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      const hash = createHash('sha256').update(body).digest('base64');
      assert.ok(csp.includes(`'sha256-${hash}'`), `${p}: el script inline no está permitido por la CSP`);
    }
    assert.doesNotMatch(page(p), /\sstyle="|<style[\s>]|\son[a-z]+="/i, `${p}: estilos o handlers inline romperían la CSP`);
  }
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /form-action[^;]*https:\/\/api\.web3forms\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/api\.web3forms\.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
});

test('HSTS on every response', () => {
  assert.match(header(rules['/*'], 'Strict-Transport-Security') || '', /max-age=31536000/);
});

test('admin replaces the site CSP with its own: GitHub API only, no inline scripts', () => {
  const admin = rules['/admin/*'];
  assert.ok(admin, 'falta la regla /admin/*');
  assert.ok(admin.includes('! Content-Security-Policy'), 'la CSP del sitio debe quitarse en /admin/*');
  const csp = header(admin, 'Content-Security-Policy');
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.github\.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(header(admin, 'Cache-Control') || '', /no-store/);
  assert.doesNotMatch(page('admin/index.html'), /<script>(?!<\/script>)/, 'el panel no debe tener scripts inline');
});

test('the build marker file is not published', () => {
  assert.match(page('.assetsignore'), /^\.landingconvierte-build$/m);
});
