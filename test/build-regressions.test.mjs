// Regresiones de build.mjs: cada prueba construye contra una copia temporal del contenido.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'build.mjs');
const tmpDirs = [];
after(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

// Copia content/ a un directorio temporal, aplica `mutate` y ejecuta el build.
function build({ mutate = () => {}, env = {} } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'build-regressions-'));
  tmpDirs.push(tmp);
  const contentDir = join(tmp, 'content');
  const outDir = join(tmp, 'dist');
  cpSync(join(ROOT, 'content'), contentDir, { recursive: true });
  const files = {};
  for (const name of ['site', 'index', 'landing-page']) {
    files[name] = JSON.parse(readFileSync(join(contentDir, `${name}.json`), 'utf8'));
  }
  mutate(files);
  for (const [name, data] of Object.entries(files)) {
    writeFileSync(join(contentDir, `${name}.json`), JSON.stringify(data, null, 2));
  }
  const baseEnv = { ...process.env };
  delete baseEnv.CMS_AUTH_BASE_URL;
  const res = spawnSync(process.execPath, [BUILD], {
    env: { ...baseEnv, CONTENT_DIR: contentDir, OUT_DIR: outDir, ...env },
    encoding: 'utf8'
  });
  const page = p => readFileSync(join(outDir, p), 'utf8');
  return { ...res, outDir, page };
}

const ctaHref = html => html.match(/<a class="btn btn-signal" href="([^"]*)">/)[1];
const footerLegal = html => html.match(/<p class="footer-legal">(.*)<\/p>/)[1];

test('navCtaHref: rutas pasan intactas y anclas se resuelven por página', () => {
  const route = build({ mutate: f => { f.site.navCtaHref = '/landing-page'; } });
  assert.equal(route.status, 0, route.stderr);
  assert.equal(ctaHref(route.page('index.html')), '/landing-page');
  assert.equal(ctaHref(route.page('landing-page.html')), '/landing-page');

  const anchor = build({ mutate: f => { f.site.navCtaHref = '#formulario'; } });
  assert.equal(anchor.status, 0, anchor.stderr);
  assert.equal(ctaHref(anchor.page('index.html')), '#formulario');
  assert.equal(ctaHref(anchor.page('landing-page.html')), '/#formulario');
});

test('demo.examples vacío: sale con código 1 y mensaje claro, sin stack', () => {
  const res = build({ mutate: f => { f.index.demo.examples = []; } });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Error de contenido: content\/index\.json → demo\.examples debe tener al menos un ejemplo/);
  assert.doesNotMatch(res.stderr, /TypeError|\n\s+at /);
});

test('site.footer.legal llega al pie de ambas páginas', () => {
  const res = build({ mutate: f => { f.site.footer.legal = '© {year} Texto legal de prueba.'; } });
  assert.equal(res.status, 0, res.stderr);
  const expected = `© ${new Date().getFullYear()} Texto legal de prueba.`;
  assert.equal(footerLegal(res.page('index.html')), expected);
  assert.equal(footerLegal(res.page('landing-page.html')), expected);
});

test('site.footer.legal: {link} se reemplaza por el enlace de legalLink; sin {link} no hay enlace', () => {
  const res = build({ mutate: f => {
    f.site.footer.legal = '© {year} Marca. {link}.';
    f.site.footer.legalLink = { text: 'Inicio <ok>', href: '/' };
  } });
  assert.equal(res.status, 0, res.stderr);
  const expected = `© ${new Date().getFullYear()} Marca. <a href="/">Inicio &lt;ok&gt;</a>.`;
  assert.equal(footerLegal(res.page('index.html')), expected);
  assert.equal(footerLegal(res.page('landing-page.html')), expected);

  const plain = build({ mutate: f => { f.site.footer.legal = 'Sin enlace.'; } });
  assert.equal(plain.status, 0, plain.stderr);
  assert.equal(footerLegal(plain.page('landing-page.html')), 'Sin enlace.');
});

test('CMS_AUTH_BASE_URL: se inyecta en dist/admin/config.yml, avisa si falta y rechaza no-https', () => {
  const url = 'https://x.example.workers.dev';
  const set = build({ env: { CMS_AUTH_BASE_URL: url } });
  assert.equal(set.status, 0, set.stderr);
  const config = set.page('admin/config.yml');
  assert.match(config, /^\s*base_url: https:\/\/x\.example\.workers\.dev$/m);
  assert.doesNotMatch(config, /REPLACE_WITH_ACCOUNT/);
  assert.match(readFileSync(join(ROOT, 'admin/config.yml'), 'utf8'), /REPLACE_WITH_ACCOUNT/);

  const unset = build();
  assert.equal(unset.status, 0, unset.stderr);
  assert.match(unset.stdout + unset.stderr, /Aviso: .*CMS_AUTH_BASE_URL/);

  const bad = build({ env: { CMS_AUTH_BASE_URL: 'http://x.example.workers.dev' } });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /CMS_AUTH_BASE_URL/);
});
