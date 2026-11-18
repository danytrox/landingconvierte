// Safety net for the content-driven build: `node build.mjs` must produce pages
// equivalent to the hand-written originals (test/fixtures/original-*.html) and a
// dist/ that only holds files meant to be published.
// The fixtures are the original hand-written pages plus one intentional change:
// the footer legal text links to the home page on both pages (original-index.html
// line ~390), requested after the CMS migration.
// Runs the build in a temporary copy of the repo, never in the repo's own dist/.
// Needs the compiled admin panel (admin-app/dist): run `npm run build` first.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(REPO, 'test', 'fixtures');

// Repo entries that are tooling or source, never part of the build input copy.
const SKIP_COPY = new Set(['.git', 'dist', 'node_modules', '.playwright-mcp', '.atl', 'test']);

// What dist/ may contain at its top level: the generated pages plus build.mjs's statics.
const PUBLISHED = new Set([
  'index.html', 'landing-page.html',
  '404.html', '_headers', 'favicon.svg', 'apple-touch-icon.png', 'logo.png', 'og-image.png',
  'robots.txt', 'sitemap.xml', 'site.webmanifest', 'styles.css', 'main.js', 'fonts', 'admin', 'uploads',
  // marker that lets build.mjs recognize (and safely replace) its own output
  '.landingconvierte-build', '.assetsignore'
]);

// Root-only files that must never be published.
const NEVER_PUBLISHED = [
  'build.mjs', 'content', 'worker', 'test', 'package.json', 'README_DEPLOY.md',
  'TODO_FORM_SPAM.md', '.github', '.gitignore', '.git', 'admin-app', 'package-lock.json', 'node_modules'
];

let work;
let result;

before(() => {
  work = mkdtempSync(join(tmpdir(), 'landingconvierte-build-'));
  for (const entry of readdirSync(REPO)) {
    if (SKIP_COPY.has(entry)) continue;
    cpSync(join(REPO, entry), join(work, entry), { recursive: true });
  }
  result = spawnSync(process.execPath, ['build.mjs'], { cwd: work, encoding: 'utf8' });
});

after(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

const dist = (...p) => join(work, 'dist', ...p);

// Equivalence normalization: trim each line, drop blank lines, and compare every
// JSON-LD block as parsed JSON so formatting does not matter.
// The hero demo data moved from a literal in the original main.js into a generated
// `demo-data` block; it is pulled out and compared, parsed, with
// fixtures/original-demo-data.json (extracted from the original main.js).
const LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const DEMO_RE = /<script id="demo-data" type="application\/json">([\s\S]*?)<\/script>/g;

function normalize(html) {
  const ld = [];
  const demo = [];
  const body = html
    .replace(LD_RE, (_, json) => {
      ld.push(JSON.parse(json));
      return `<script type="application/ld+json">__LD_${ld.length - 1}__</script>`;
    })
    .replace(DEMO_RE, (_, json) => {
      demo.push(JSON.parse(json));
      return '';
    });
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  return { lines, ld, demo };
}

function firstDiff(expected, actual, context = 3) {
  const max = Math.max(expected.length, actual.length);
  for (let i = 0; i < max; i++) {
    if (expected[i] === actual[i]) continue;
    const from = Math.max(0, i - context);
    const out = [`first difference at normalized line ${i + 1}:`];
    for (let j = from; j < i; j++) out.push(`  ${expected[j]}`);
    for (let j = i; j < Math.min(max, i + context); j++) {
      if (expected[j] === actual[j]) { out.push(`  ${expected[j]}`); continue; }
      if (expected[j] !== undefined) out.push(`- ${expected[j]}`);
      if (actual[j] !== undefined) out.push(`+ ${actual[j]}`);
    }
    return out.join('\n');
  }
  return null;
}

// The originals hard-code the copyright year; the build prints the current year.
const loadFixture = name => readFileSync(join(FIXTURES, name), 'utf8')
  .replace(/© \d{4} /g, `© ${new Date().getFullYear()} `);

function assertEquivalent(fixtureName, generatedPath) {
  const expected = normalize(loadFixture(fixtureName));
  const actual = normalize(readFileSync(generatedPath, 'utf8'));
  const diff = firstDiff(expected.lines, actual.lines);
  assert.equal(diff, null, `${basename(generatedPath)} differs from ${fixtureName}\n${diff}`);
  assert.deepEqual(actual.ld, expected.ld, `${basename(generatedPath)}: JSON-LD differs from ${fixtureName}`);
}

test('node build.mjs exits with code 0', () => {
  assert.equal(result.status, 0, `build failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});

test('generates dist/index.html and dist/landing-page.html', () => {
  assert.ok(existsSync(dist('index.html')), 'dist/index.html missing');
  assert.ok(existsSync(dist('landing-page.html')), 'dist/landing-page.html missing');
});

test('dist/index.html is equivalent to the original index.html', () => {
  assertEquivalent('original-index.html', dist('index.html'));
});

test('dist/index.html carries the original hero demo data', () => {
  const { demo } = normalize(readFileSync(dist('index.html'), 'utf8'));
  const expected = JSON.parse(readFileSync(join(FIXTURES, 'original-demo-data.json'), 'utf8'));
  assert.equal(demo.length, 1, 'expected exactly one demo-data block in dist/index.html');
  assert.deepEqual(demo[0], expected);
});

test('dist/landing-page.html is equivalent to the original landing-page.html', () => {
  assertEquivalent('original-landing-page.html', dist('landing-page.html'));
});

test('publishes the admin panel with its login config and no third-party scripts', () => {
  assert.ok(existsSync(dist('admin', 'index.html')), 'dist/admin/index.html missing');
  assert.ok(existsSync(dist('admin', 'config.json')), 'dist/admin/config.json missing');
  const html = readFileSync(dist('admin', 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
  assert.ok(srcs.length > 0, 'admin index.html loads no script');
  for (const src of srcs) assert.match(src, /^\/admin\//, `admin loads a non-local script: ${src}`);
});

test('dist/ holds only publishable files', () => {
  const entries = readdirSync(dist());
  const unexpected = entries.filter(e => !PUBLISHED.has(e));
  assert.deepEqual(unexpected, [], `unexpected entries in dist/: ${unexpected.join(', ')}`);
  for (const name of NEVER_PUBLISHED) {
    assert.ok(!existsSync(dist(name)), `dist/${name} must not be published`);
  }
});
