#!/usr/bin/env node
// Genera dist/ a partir de content/*.json + archivos estáticos.
// Uso: node build.mjs
// Variables opcionales: CONTENT_DIR (por defecto content/), OUT_DIR (por defecto dist/),
// CMS_AUTH_BASE_URL (URL https del Worker de login del CMS, se escribe en dist/admin/config.yml).
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENT = process.env.CONTENT_DIR ? resolve(process.env.CONTENT_DIR) : join(ROOT, 'content');
const DIST = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : join(ROOT, 'dist');

const read = p => JSON.parse(readFileSync(join(CONTENT, p), 'utf8'));
const site = read('site.json');
const idx = read('index.json');
const lp = read('landing-page.json');

// ---------- Validación de contenido ----------
// Revisa lo que el build usa sin condiciones; si falta algo, sale con un mensaje claro
// en vez de un TypeError a mitad de la generación.

const contentErrors = [];
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const requireField = (obj, file, path, kind) => {
  const value = getPath(obj, path);
  const where = `content/${file} → ${path}`;
  if (kind === 'object' && (value === null || typeof value !== 'object' || Array.isArray(value))) {
    contentErrors.push(`${where} es obligatorio`);
  } else if (kind === 'string' && typeof value !== 'string') {
    contentErrors.push(`${where} debe ser un texto`);
  } else if (kind === 'list' && !Array.isArray(value)) {
    contentErrors.push(`${where} debe ser una lista`);
  }
};
const requireAll = (obj, file, kind, paths) => paths.forEach(p => requireField(obj, file, p, kind));

requireAll(site, 'site.json', 'object', ['footer']);
requireAll(site, 'site.json', 'string', ['navCtaHref', 'footer.legal']);
requireAll(site, 'site.json', 'list', ['nav', 'footer.links']);

requireAll(idx, 'index.json', 'object', [
  'meta', 'hero', 'demo', 'services', 'compare', 'process', 'faq', 'contact', 'contact.labels', 'schema'
]);
requireAll(idx, 'index.json', 'list', [
  'demo.examples', 'demo.legend', 'services.items', 'services.included', 'compare.columns',
  'process.steps', 'faq.items', 'contact.bullets', 'contact.serviceOptions'
]);
if (Array.isArray(idx.demo?.examples)) {
  if (idx.demo.examples.length === 0) {
    contentErrors.push('content/index.json → demo.examples debe tener al menos un ejemplo');
  } else {
    requireField(idx, 'index.json', 'demo.examples.0.trust', 'list');
  }
}

requireAll(lp, 'landing-page.json', 'object', [
  'meta', 'hero', 'focus', 'content', 'compare', 'process', 'faq', 'ctaBand', 'schema'
]);
requireAll(lp, 'landing-page.json', 'list', [
  'focus.items', 'content.columns', 'compare.columns', 'process.steps', 'faq.items'
]);

if (contentErrors.length) {
  for (const e of contentErrors) console.error(`Error de contenido: ${e}`);
  process.exit(1);
}

// ---------- URL del login del CMS ----------

const CMS_AUTH_PLACEHOLDER = 'REPLACE_WITH_ACCOUNT';
const cmsAuthBaseUrl = process.env.CMS_AUTH_BASE_URL?.trim();
if (cmsAuthBaseUrl) {
  let valid = false;
  try { valid = new URL(cmsAuthBaseUrl).protocol === 'https:'; } catch { valid = false; }
  if (!valid) {
    console.error(`Error de configuración: CMS_AUTH_BASE_URL debe ser una URL https:// (recibido: ${cmsAuthBaseUrl})`);
    process.exit(1);
  }
}

const esc = s => String(s)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const escJson = obj => JSON.stringify(obj, null, 2)
  .replaceAll('<', '\\u003c'); // evita cerrar el <script> prematuramente

const year = new Date().getFullYear();

// ---------- Partes compartidas ----------

const head = (meta, extraLd) => `<!doctype html>
<html lang="es-CL">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="${esc(site.themeColor)}">
  <link rel="canonical" href="${esc(meta.canonical)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="preload" href="/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script>document.documentElement.className = 'js';</script>
  <meta property="og:type" content="website">
  <meta property="og:locale" content="es_CL">
  <meta property="og:site_name" content="${esc(site.brand)}">
  <meta property="og:title" content="${esc(meta.ogTitle)}">
  <meta property="og:description" content="${esc(meta.ogDescription)}">
  <meta property="og:url" content="${esc(meta.canonical)}">
  <meta property="og:image" content="${esc(site.domain)}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(meta.ogImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.ogTitle)}">
  <meta name="twitter:description" content="${esc(meta.ogDescription)}">
  <meta name="twitter:image" content="${esc(site.domain)}/og-image.png">
  <script type="application/ld+json">
${extraLd}
  </script>
</head>
<body>
  <a class="skip-link" href="#contenido">${esc(site.skipLink)}</a>
`;

const brandSvg = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2.5" y="2.5" width="27" height="27" rx="5" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M8.5 10.5h15M8.5 15.5h9" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><rect x="8.5" y="20" width="11" height="5" rx="1.5" fill="#3ce8ff"/></svg>`;

const toggleSvg = `<svg class="icon-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <svg class="icon-close" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// Resuelve un href según la página: en index los anclas quedan locales (''),
// en landing-page se vuelven absolutos hacia index ('/').
const resolveHref = (href, prefix) => (href.startsWith('#') ? prefix + href : href);

// prefix: '' en index (anclas locales), '/' en landing-page (enlaces a index)
const header = (nav, prefix, currentPath) => `  <header class="site-header">
    <div class="wrap nav">
      <a class="brand" href="/" aria-label="${esc(site.brand)}, inicio">
        ${brandSvg}
        ${esc(site.brand)}
      </a>
      <nav id="menu-panel" class="menu-panel" aria-label="Navegación principal">
        <ul class="menu">
${nav.map(item => {
  const href = resolveHref(item.href, prefix);
  const current = href === currentPath ? ' aria-current="page"' : '';
  return `          <li><a href="${esc(href)}"${current}>${esc(item.label)}</a></li>`;
}).join('\n')}
        </ul>
      </nav>
      <a class="btn btn-signal" href="${esc(resolveHref(site.navCtaHref, prefix))}">${esc(site.navCta)}</a>
      <button class="nav-toggle" type="button" aria-controls="menu-panel" aria-expanded="false" aria-label="Abrir menú">
        ${toggleSvg}
      </button>
    </div>
  </header>
`;

// Texto legal del pie, igual en todas las páginas ({year} = año actual)
const footerLegal = () => `<p class="footer-legal">${esc(site.footer.legal.replace('{year}', String(year)))}</p>`;

const footerLinks = (links, prefix) => links.map(l => {
  const href = resolveHref(l.href, prefix);
  return `          <li><a href="${esc(href)}">${esc(l.label)}</a></li>`;
}).join('\n');

const faqLd = (items, id) => ({
  '@type': 'FAQPage',
  '@id': id,
  mainEntity: items.map(f => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer }
  }))
});

// ---------- index ----------

const indexLd = escJson({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${site.domain}/#organization`,
      name: site.brand,
      url: `${site.domain}/`,
      logo: { '@type': 'ImageObject', url: `${site.domain}/logo.png`, width: 512, height: 512 },
      description: site.organizationDescription,
      areaServed: { '@type': 'Country', name: site.areaServed }
    },
    {
      '@type': 'WebSite',
      '@id': `${site.domain}/#website`,
      url: `${site.domain}/`,
      name: site.brand,
      alternateName: site.alternateName,
      publisher: { '@id': `${site.domain}/#organization` },
      inLanguage: 'es-CL'
    },
    {
      '@type': 'WebPage',
      '@id': `${site.domain}/#webpage`,
      url: `${site.domain}/`,
      name: idx.meta.title,
      description: idx.schema.pageDescription,
      isPartOf: { '@id': `${site.domain}/#website` },
      about: { '@id': `${site.domain}/#organization` },
      primaryImageOfPage: `${site.domain}/og-image.png`,
      inLanguage: 'es-CL'
    },
    {
      '@type': 'Service',
      '@id': `${site.domain}/#diseno-web`,
      name: idx.schema.serviceName,
      serviceType: idx.schema.serviceType,
      description: idx.schema.serviceDescription,
      provider: { '@id': `${site.domain}/#organization` },
      areaServed: { '@type': 'Country', name: site.areaServed }
    },
    faqLd(idx.faq.items, `${site.domain}/#preguntas`)
  ]
});

const demoExamples = idx.demo.examples;
const first = demoExamples[0];

const indexHtml = `${head(idx.meta, indexLd)}
${header(site.nav, '', null)}
  <main id="contenido">
    <section class="hero on-blue" id="inicio">
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <h1>${esc(idx.hero.title)}</h1>
          <p class="lead">${esc(idx.hero.lead)}</p>
          <div class="actions">
            <a class="btn btn-signal" href="${esc(idx.hero.ctaPrimaryHref)}">${esc(idx.hero.ctaPrimary)}</a>
            <a class="btn btn-outline" href="${esc(idx.hero.ctaSecondaryHref)}">${esc(idx.hero.ctaSecondary)}</a>
          </div>
          <p class="hero-note"><span class="pulse" aria-hidden="true"></span>${esc(idx.hero.note)}</p>
        </div>

        <div class="demo">
          <p class="demo-prompt" id="demo-prompt">${esc(idx.demo.prompt)}</p>
          <div class="demo-tabs" role="group" aria-labelledby="demo-prompt">
${demoExamples.map((ex, i) => `            <button class="demo-tab" type="button" data-example="${esc(ex.key)}" aria-pressed="${i === 0 ? 'true' : 'false'}">${esc(ex.label)}</button>`).join('\n')}
          </div>
          <div class="demo-stage">
          <figure class="demo-frame is-plano">
            <div class="demo-window">
              <div class="demo-bar" aria-hidden="true"><i></i><i></i><i></i><span class="demo-url" data-demo="url">${esc(first.url)}</span></div>
              <div class="demo-page" aria-live="polite">
                <div class="demo-nav">
                  <span class="demo-brand" data-demo="brand">${esc(first.brand)}</span>
                  <span class="demo-navlinks" aria-hidden="true"><i></i><i></i><i></i></span>
                </div>
                <div class="demo-body">
                  <p class="demo-title"><span data-demo="title">${esc(first.title)}</span><span class="demo-mark" aria-hidden="true">1</span></p>
                  <p class="demo-sub" data-demo="sub">${esc(first.sub)}</p>
                  <div class="demo-action"><span class="demo-btn" data-demo="cta">${esc(first.cta)}</span><span class="demo-mark" aria-hidden="true">2</span></div>
                  <div class="demo-trust" data-demo="trust">
                    <ul>
                      <li><span>${esc(first.trust[0] || '')}</span></li>
                      <li><span>${esc(first.trust[1] || '')}</span></li>
                    </ul>
                    <span class="demo-mark" aria-hidden="true">3</span>
                  </div>
                </div>
              </div>
            </div>
            <figcaption class="demo-caption">${esc(idx.demo.caption)}</figcaption>
          </figure>
          </div>
          <ol class="demo-legend">
${idx.demo.legend.map(l => `            <li>${esc(l)}</li>`).join('\n')}
          </ol>
        </div>
      </div>
    </section>

    <section class="section on-paper" id="servicios">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(idx.services.heading)}</h2>
          <p>${esc(idx.services.intro)}</p>
        </div>
        <ul class="service-list">
${idx.services.items.map(s => `          <li class="service">
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.description)}</p>
            <a class="text-link" href="${esc(s.linkHref)}">${esc(s.linkText)}</a>
          </li>`).join('\n')}
        </ul>
        <div class="included">
          <h3>${esc(idx.services.includedTitle)}</h3>
          <ul class="check-list">
${idx.services.included.map(i => `            <li>${esc(i)}</li>`).join('\n')}
          </ul>
        </div>
      </div>
    </section>

    <section class="section on-paper" id="elige-pagina">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(idx.compare.heading)}</h2>
          <p>${esc(idx.compare.intro)}</p>
        </div>
        <div class="compare">
${idx.compare.columns.map(col => `          <article class="compare-col">
            <h3>${esc(col.title)}</h3>
            <dl>
${col.rows.map(r => `              <dt>${esc(r.term)}</dt>
              <dd>${esc(r.description)}</dd>`).join('\n')}
            </dl>
            <a class="text-link" href="${esc(col.linkHref)}">${esc(col.linkText)}</a>
          </article>`).join('\n')}
        </div>
        <p class="compare-note">${esc(idx.compare.noteBefore)} <a class="text-link" href="${esc(idx.compare.noteLinkHref)}">${esc(idx.compare.noteLinkText)}</a> ${esc(idx.compare.noteAfter)}</p>
      </div>
    </section>

    <section class="section on-paper" id="proceso">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(idx.process.heading)}</h2>
        </div>
        <ol class="steps">
${idx.process.steps.map(s => `          <li>
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.description)}</p>
          </li>`).join('\n')}
        </ol>
      </div>
    </section>

    <section class="section on-paper" id="preguntas-frecuentes">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(idx.faq.heading)}</h2>
        </div>
        <div class="faq">
${idx.faq.items.map(f => `          <details>
            <summary>${esc(f.question)}</summary>
            <p>${esc(f.answer)}</p>
          </details>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section on-blue" id="formulario">
      <div class="wrap contact-grid">
        <div class="contact-copy">
          <h2>${esc(idx.contact.heading)}</h2>
          <p>${esc(idx.contact.intro)}</p>
          <ul class="check-list">
${idx.contact.bullets.map(b => `            <li>${esc(b)}</li>`).join('\n')}
          </ul>
        </div>
        <form class="form on-paper" action="https://api.web3forms.com/submit" method="POST" data-async>
          <input type="hidden" name="access_key" value="${esc(idx.contact.web3formsAccessKey)}">
          <input type="hidden" name="subject" value="${esc(idx.contact.subject)}">
          <input type="hidden" name="from_name" value="${esc(idx.contact.fromName)}">
          <input class="hp" type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="field">
            <label for="name">${esc(idx.contact.labels.name)}</label>
            <input id="name" name="name" type="text" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="email">${esc(idx.contact.labels.email)}</label>
            <input id="email" name="email" type="email" autocomplete="email" inputmode="email" required>
          </div>
          <div class="field">
            <label for="company">${esc(idx.contact.labels.company)} <span>${esc(idx.contact.labels.companyOptional)}</span></label>
            <input id="company" name="company" type="text" autocomplete="organization">
          </div>
          <div class="field">
            <label for="phone">${esc(idx.contact.labels.phone)} <span>${esc(idx.contact.labels.phoneOptional)}</span></label>
            <input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel">
          </div>
          <div class="field field-full">
            <label for="service">${esc(idx.contact.labels.service)}</label>
            <select id="service" name="service">
${idx.contact.serviceOptions.map(o => `              <option>${esc(o)}</option>`).join('\n')}
            </select>
          </div>
          <div class="field field-full">
            <label for="message">${esc(idx.contact.labels.message)}</label>
            <textarea id="message" name="message" required placeholder="${esc(idx.contact.labels.messagePlaceholder)}"></textarea>
          </div>
          <p class="form-status" role="status" tabindex="-1"></p>
          <button class="btn btn-signal" type="submit">${esc(idx.contact.labels.submit)}</button>
        </form>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-row">
        <span class="footer-brand">${esc(site.footer.brand)}</span>
        <ul class="footer-links">
${footerLinks(site.footer.links, '')}
        </ul>
      </div>
      ${footerLegal()}
    </div>
  </footer>

  <div class="action-bar"><a class="btn btn-signal" href="#formulario">${esc(idx.actionBar)}</a></div>
  <script id="demo-data" type="application/json">${JSON.stringify(
    Object.fromEntries(demoExamples.map(v => [v.key, {
      accent: v.accent, url: v.url, brand: v.brand, title: v.title, sub: v.sub, cta: v.cta, trust: v.trust
    }])),
    null, 0
  ).replaceAll('<', '\\u003c')}</script>
  <script src="/main.js" defer></script>
</body>
</html>
`;

// ---------- landing-page ----------

const lpLd = escJson({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${site.domain}/landing-page#webpage`,
      url: `${site.domain}/landing-page`,
      name: lp.meta.title,
      description: lp.schema.pageDescription,
      isPartOf: { '@id': `${site.domain}/#website` },
      about: { '@id': `${site.domain}/#organization` },
      mainEntity: { '@id': `${site.domain}/landing-page#service` },
      breadcrumb: { '@id': `${site.domain}/landing-page#breadcrumb` },
      inLanguage: 'es-CL'
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${site.domain}/landing-page#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${site.domain}/` },
        { '@type': 'ListItem', position: 2, name: lp.schema.breadcrumbName, item: `${site.domain}/landing-page` }
      ]
    },
    {
      '@type': 'Service',
      '@id': `${site.domain}/landing-page#service`,
      name: lp.schema.serviceName,
      serviceType: lp.schema.serviceType,
      description: lp.schema.serviceDescription,
      provider: { '@type': 'Organization', '@id': `${site.domain}/#organization`, name: site.brand, url: `${site.domain}/` },
      areaServed: { '@type': 'Country', name: site.areaServed }
    },
    faqLd(lp.faq.items, `${site.domain}/landing-page#preguntas`)
  ]
});

const landingHtml = `${head(lp.meta, lpLd)}
${header(site.nav, '/', '/landing-page')}
  <main id="contenido">
    <section class="hero hero-plain on-blue">
      <div class="wrap">
        <h1>${esc(lp.hero.title)}</h1>
        <p class="lead">${esc(lp.hero.lead)}</p>
        <div class="actions">
          <a class="btn btn-signal" href="${esc(lp.hero.ctaPrimaryHref)}">${esc(lp.hero.ctaPrimary)}</a>
          <a class="btn btn-outline" href="${esc(lp.hero.ctaSecondaryHref)}">${esc(lp.hero.ctaSecondary)}</a>
        </div>
      </div>
    </section>
    <section class="section on-paper">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(lp.focus.heading)}</h2>
          <p>${esc(lp.focus.intro)}</p>
        </div>
        <ul class="service-list">
${lp.focus.items.map(s => `          <li class="service">
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.description)}</p>
          </li>`).join('\n')}
        </ul>
      </div>
    </section>
    <section class="section on-paper">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(lp.content.heading)}</h2>
          <p>${esc(lp.content.intro)}</p>
        </div>
        <div class="pair">
${lp.content.columns.map(col => `          <div>
            <h3>${esc(col.title)}</h3>
            <ul class="plain-list">
${col.items.map(i => `              <li>${esc(i)}</li>`).join('\n')}
            </ul>
          </div>`).join('\n')}
        </div>
      </div>
    </section>
    <section class="section on-paper">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(lp.compare.heading)}</h2>
        </div>
        <div class="compare">
${lp.compare.columns.map(col => `          <article class="compare-col">
            <h3>${esc(col.title)}</h3>
            <p>${esc(col.description)}</p>
          </article>`).join('\n')}
        </div>
        <p class="compare-note">${esc(lp.compare.noteBefore)} <a class="text-link" href="${esc(lp.compare.noteLinkHref)}">${esc(lp.compare.noteLinkText)}</a> ${esc(lp.compare.noteAfter)}</p>
      </div>
    </section>
    <section class="section on-paper">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(lp.process.heading)}</h2>
        </div>
        <ol class="steps">
${lp.process.steps.map(s => `          <li>
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.description)}</p>
          </li>`).join('\n')}
        </ol>
      </div>
    </section>
    <section class="section on-paper">
      <div class="wrap">
        <div class="section-head">
          <h2>${esc(lp.faq.heading)}</h2>
        </div>
        <div class="faq">
${lp.faq.items.map(f => `          <details>
            <summary>${esc(f.question)}</summary>
            <p>${esc(f.answer)}</p>
          </details>`).join('\n')}
        </div>
      </div>
    </section>
    <section class="section on-blue">
      <div class="wrap band">
        <div>
          <h2>${esc(lp.ctaBand.heading)}</h2>
          <p>${esc(lp.ctaBand.textBefore)} <a class="text-link" href="${esc(lp.ctaBand.linkHref)}">${esc(lp.ctaBand.linkText)}</a>.</p>
        </div>
        <a class="btn btn-signal" href="${esc(lp.ctaBand.ctaHref)}">${esc(lp.ctaBand.cta)}</a>
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-row">
        <span class="footer-brand">${esc(site.footer.brand)}</span>
        <ul class="footer-links">
          <li><a href="/">Inicio</a></li>
${footerLinks(site.footer.links.filter(l => l.href !== '/' && l.href !== '/landing-page'), '/')}
        </ul>
      </div>
      ${footerLegal()}
    </div>
  </footer>

  <script src="/main.js" defer></script>
</body>
</html>
`;

// ---------- Emitir dist/ ----------

if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

writeFileSync(join(DIST, 'index.html'), indexHtml);
writeFileSync(join(DIST, 'landing-page.html'), landingHtml);

const statics = [
  '404.html', '_headers', 'favicon.svg', 'apple-touch-icon.png', 'logo.png', 'og-image.png',
  'robots.txt', 'sitemap.xml', 'site.webmanifest', 'styles.css', 'main.js', 'fonts', 'admin'
];
const optional = new Set(['uploads']);
statics.push(...optional);
for (const item of statics) {
  const src = join(ROOT, item);
  if (!existsSync(src)) {
    if (!optional.has(item)) throw new Error(`Falta el archivo estático: ${item}`);
    continue;
  }
  cpSync(src, join(DIST, item), { recursive: true });
}

// La URL del Worker se inyecta solo en dist/; admin/config.yml conserva el marcador.
const distCmsConfig = join(DIST, 'admin', 'config.yml');
if (cmsAuthBaseUrl) {
  const config = readFileSync(distCmsConfig, 'utf8');
  writeFileSync(distCmsConfig, config.replace(/^(\s*base_url:\s*).*$/m, `$1${cmsAuthBaseUrl}`));
} else if (readFileSync(distCmsConfig, 'utf8').includes(CMS_AUTH_PLACEHOLDER)) {
  console.warn('Aviso: CMS_AUTH_BASE_URL no está definida; el login del CMS (/admin) no funcionará hasta configurarla en Cloudflare Pages.');
}

console.log(`OK: dist/ generado (index.html ${indexHtml.length} bytes, landing-page.html ${landingHtml.length} bytes)`);
