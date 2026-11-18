// Regresiones de build.mjs: cada prueba construye contra una copia temporal del contenido.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

test('site.footer.legal con {link} sin legalLink: sale con código 1 y mensaje claro', () => {
  const res = build({ mutate: f => { f.site.footer.legal = '© {year} {link}.'; delete f.site.footer.legalLink; } });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /site\.json → footer\.legalLink\.text debe ser un texto/);
});

test('legalLink y CMS_AUTH_BASE_URL con secuencias $ se escriben literalmente', () => {
  const res = build({
    mutate: f => { f.site.footer.legal = 'A {link} B'; f.site.footer.legalLink = { text: "x$'y$&z", href: '/' }; },
    env: { CMS_AUTH_BASE_URL: 'https://a.example.workers.dev/$&' }
  });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(footerLegal(res.page('index.html')), "A <a href=\"/\">x$'y$&amp;z</a> B");
  assert.equal(JSON.parse(res.page('admin/config.json')).authBaseUrl, 'https://a.example.workers.dev/$&');
});

test('OUT_DIR que apunta al proyecto o a su contenido se rechaza sin borrar nada', () => {
  // Corre sobre una copia desechable: con el bug presente, el build borraría OUT_DIR.
  const parent = mkdtempSync(join(tmpdir(), 'build-regressions-'));
  tmpDirs.push(parent);
  const sandbox = join(parent, 'project');
  cpSync(BUILD, join(sandbox, 'build.mjs'));
  cpSync(join(ROOT, 'content'), join(sandbox, 'content'), { recursive: true });
  const sandboxBuild = join(sandbox, 'build.mjs');
  for (const out of [sandbox, join(sandbox, 'content'), parent]) {
    const res = spawnSync(process.execPath, [sandboxBuild], { env: { ...process.env, OUT_DIR: out }, encoding: 'utf8' });
    assert.equal(res.status, 1, `OUT_DIR=${out} debió rechazarse`);
    assert.match(res.stderr, /Error de configuración: OUT_DIR/);
    assert.ok(existsSync(sandboxBuild) && existsSync(join(sandbox, 'content', 'site.json')), 'no debe borrar archivos');
  }
});

test('CMS_AUTH_BASE_URL: se escribe en dist/admin/config.json, avisa si falta y rechaza no-https', () => {
  const url = 'https://x.example.workers.dev';
  const set = build({ env: { CMS_AUTH_BASE_URL: url } });
  assert.equal(set.status, 0, set.stderr);
  assert.deepEqual(JSON.parse(set.page('admin/config.json')), { authBaseUrl: url });
  assert.ok(set.page('admin/index.html').length > 0, 'falta el panel compilado en dist/admin');

  const unset = build();
  assert.equal(unset.status, 0, unset.stderr);
  assert.match(unset.stdout + unset.stderr, /Aviso: .*CMS_AUTH_BASE_URL/);
  assert.deepEqual(JSON.parse(unset.page('admin/config.json')), { authBaseUrl: null });

  const bad = build({ env: { CMS_AUTH_BASE_URL: 'http://x.example.workers.dev' } });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /CMS_AUTH_BASE_URL/);
});

test('CMS_AUTH_BASE_URL falta en el build de producción de Cloudflare (main): sale con código 1', () => {
  const prod = build({ env: { CF_PAGES: '1', CF_PAGES_BRANCH: 'main' } });
  assert.equal(prod.status, 1);
  assert.match(prod.stderr, /Error de configuración: CMS_AUTH_BASE_URL es obligatoria/);

  const preview = build({ env: { CF_PAGES: '1', CF_PAGES_BRANCH: 'feat/x' } });
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout + preview.stderr, /Aviso: .*CMS_AUTH_BASE_URL/);

  const workers = build({ env: { WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' } });
  assert.equal(workers.status, 1);
  assert.match(workers.stderr, /Error de configuración: CMS_AUTH_BASE_URL es obligatoria/);

  const workersPreview = build({ env: { WORKERS_CI: '1', WORKERS_CI_BRANCH: 'feat/x' } });
  assert.equal(workersPreview.status, 0, workersPreview.stderr);
});

test('texto obligatorio faltante dentro de una lista: sale con código 1 y nombra el campo', () => {
  const res = build({ mutate: f => {
    delete f.site.nav[1].href;
    delete f.index.contact.web3formsAccessKey;
    delete f.index.compare.columns[0].rows[0].term;
  } });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Error de contenido: content\/site\.json → nav\.1\.href debe ser un texto/);
  assert.match(res.stderr, /content\/index\.json → contact\.web3formsAccessKey debe ser un texto/);
  assert.match(res.stderr, /content\/index\.json → compare\.columns\.0\.rows\.0\.term debe ser un texto/);
  assert.doesNotMatch(res.stderr, /TypeError|\n\s+at /);
});

test('OUT_DIR ajeno no vacío se rechaza sin borrar; vacío o generado por el build se reemplaza', () => {
  // Todo ocurre dentro de un sandbox temporal: nunca contra el repo ni un directorio real.
  const parent = mkdtempSync(join(tmpdir(), 'build-regressions-'));
  tmpDirs.push(parent);
  const sandbox = join(parent, 'project');
  for (const entry of readdirSync(ROOT)) {
    if (['.git', 'dist', 'node_modules', 'test', '.playwright-mcp', '.atl'].includes(entry)) continue;
    cpSync(join(ROOT, entry), join(sandbox, entry), { recursive: true });
  }
  const run = out => spawnSync(process.execPath, [join(sandbox, 'build.mjs')], {
    env: { ...process.env, CMS_AUTH_BASE_URL: '', OUT_DIR: out }, encoding: 'utf8'
  });

  const foreign = join(parent, 'foreign');
  mkdirSync(foreign);
  writeFileSync(join(foreign, 'keep.txt'), 'importante');
  const rejected = run(foreign);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Error de configuración: OUT_DIR/);
  assert.equal(readFileSync(join(foreign, 'keep.txt'), 'utf8'), 'importante');

  const empty = join(parent, 'empty');
  mkdirSync(empty);
  assert.equal(run(empty).status, 0);
  writeFileSync(join(empty, 'stale.txt'), 'viejo');
  const again = run(empty);
  assert.equal(again.status, 0, again.stderr);
  assert.ok(existsSync(join(empty, 'index.html')));
  assert.ok(!existsSync(join(empty, 'stale.txt')), 'una salida previa del build se reemplaza completa');
});

test('enlaces editables: solo #, /ruta, https:, mailto: y tel:; javascript: y similares se rechazan', () => {
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'http://x.cl', '//evil.example', 'vbscript:x']) {
    const res = build({ mutate: f => { f.index.hero.ctaPrimaryHref = bad; } });
    assert.equal(res.status, 1, `debió rechazar ${bad}`);
    assert.match(res.stderr, /Error de contenido: content\/index\.json → hero\.ctaPrimaryHref no es un enlace permitido/);
  }
  const nested = build({ mutate: f => { f.site.footer.links[0].href = 'javascript:alert(1)'; } });
  assert.equal(nested.status, 1);
  assert.match(nested.stderr, /content\/site\.json → footer\.links\.0\.href no es un enlace permitido/);

  const ok = build({ mutate: f => {
    f.index.hero.ctaPrimaryHref = 'https://wa.me/56900000000';
    f.index.hero.ctaSecondaryHref = 'mailto:hola@landingconvierte.cl';
    f.site.footer.links[0].href = 'tel:+56900000000';
  } });
  assert.equal(ok.status, 0, ok.stderr);
});
