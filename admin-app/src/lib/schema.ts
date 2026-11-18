// Editor schema: fields, labels and hints for every content file.
// Ported from the former Decap CMS admin/config.yml, grouped into sections for the sidebar.
export type Widget = 'string' | 'text' | 'color' | 'object' | 'list';

export interface Field {
  name: string;
  label: string;
  widget: Widget;
  hint?: string;
  /** Technical field: only shown with "Opciones avanzadas" on. */
  advanced?: boolean;
  /** object: start closed */
  collapsed?: boolean;
  /** object / list of objects */
  fields?: Field[];
  /** list of plain texts: label of each item */
  itemLabel?: string;
  /** list: minimum number of items */
  min?: number;
  /** list of objects: field used as each item's title */
  summary?: string;
  pattern?: [string, string];
}

export interface Section {
  id: string;
  label: string;
  description?: string;
  /** Top-level key the section edits; undefined = fields live at the file root. */
  key?: string;
  fields: Field[];
  advanced?: boolean;
  /** Anchor on the live page, for "Ver en la página". */
  anchor?: string;
}

export interface Page {
  id: string;
  label: string;
  path: string;
  /** Live URL path of the page this file renders ('' = all pages). */
  livePath: string;
  sections: Section[];
}

const s = (name: string, label: string, extra: Partial<Field> = {}): Field => ({ name, label, widget: 'string', ...extra });
const t = (name: string, label: string, extra: Partial<Field> = {}): Field => ({ name, label, widget: 'text', ...extra });
const texts = (name: string, label: string, itemLabel: string, extra: Partial<Field> = {}): Field =>
  ({ name, label, widget: 'list', itemLabel, ...extra });
const list = (name: string, label: string, fields: Field[], extra: Partial<Field> = {}): Field =>
  ({ name, label, widget: 'list', fields, ...extra });
const obj = (name: string, label: string, fields: Field[], extra: Partial<Field> = {}): Field =>
  ({ name, label, widget: 'object', fields, ...extra });

const HREF_HINT = 'Ancla de esta página (#seccion) o ruta (/landing-page)';
const link = (label = 'Texto', hrefLabel = 'Enlace') => [s('label', label), s('href', hrefLabel, { hint: HREF_HINT })];

const metaFields: Field[] = [
  s('title', 'Título de la pestaña', { hint: 'Lo que aparece en Google y en la pestaña del navegador.' }),
  t('description', 'Meta descripción', { hint: 'El texto bajo el título en Google. Idealmente menos de 160 caracteres.' }),
  s('ogTitle', 'Título al compartir', { hint: 'Al compartir el enlace por WhatsApp, LinkedIn, etc.' }),
  t('ogDescription', 'Descripción al compartir'),
  s('ogImageAlt', 'Texto alternativo de la imagen al compartir'),
  s('canonical', 'URL canónica', { advanced: true })
];
const meta: Section = {
  id: 'meta', key: 'meta', label: 'SEO (Google y redes)',
  description: 'Cómo se ve la página en Google y al compartirla.', fields: metaFields
};

const processSection = (anchor?: string): Section => ({
  id: 'process', key: 'process', label: 'Proceso', anchor,
  fields: [s('heading', 'Título'), list('steps', 'Pasos', [s('title', 'Paso'), t('description', 'Descripción')], { summary: 'title' })]
});
const faqSection = (anchor?: string): Section => ({
  id: 'faq', key: 'faq', label: 'Preguntas frecuentes', anchor,
  fields: [s('heading', 'Título'), list('items', 'Preguntas', [s('question', 'Pregunta'), t('answer', 'Respuesta')], { summary: 'question' })]
});

const schemaFields = [
  t('pageDescription', 'Descripción de la página'),
  s('serviceName', 'Nombre del servicio'),
  s('serviceType', 'Tipo de servicio'),
  t('serviceDescription', 'Descripción del servicio')
];

const notes = [
  s('noteBefore', 'Nota (antes del enlace)'),
  s('noteLinkText', 'Nota (texto del enlace)'),
  s('noteLinkHref', 'Nota (enlace)', { hint: HREF_HINT }),
  s('noteAfter', 'Nota (después del enlace)')
];

export const PAGES: Page[] = [
  {
    id: 'site', label: 'General (menú y pie)', path: 'content/site.json', livePath: '/',
    sections: [
      {
        id: 'brand', label: 'Marca y empresa', description: 'Datos que se usan en todas las páginas.',
        fields: [
          s('brand', 'Marca'),
          s('alternateName', 'Nombre alternativo', { advanced: true }),
          s('domain', 'Dominio (con https)', { advanced: true, hint: 'Ej.: https://landingconvierte.cl, sin / al final.' }),
          t('organizationDescription', 'Descripción de la empresa (SEO)'),
          s('areaServed', 'País donde atiende'),
          { name: 'themeColor', label: 'Color del tema (navegador móvil)', widget: 'color', advanced: true },
          s('skipLink', 'Texto "saltar al contenido"', { advanced: true, hint: 'Lo leen los lectores de pantalla.' })
        ]
      },
      {
        id: 'nav', label: 'Menú principal', description: 'El menú de arriba, igual en todas las páginas.',
        fields: [
          list('nav', 'Enlaces del menú', link(), { summary: 'label' }),
          s('navCta', 'Botón del menú'),
          s('navCtaHref', 'Enlace del botón del menú', { hint: HREF_HINT })
        ]
      },
      {
        id: 'footer', key: 'footer', label: 'Pie de página',
        fields: [
          s('brand', 'Marca'),
          list('links', 'Enlaces', link(), {
            summary: 'label',
            hint: 'En la página "Diseño de landing pages" el pie muestra siempre "Inicio" primero y omite los enlaces a / y a /landing-page.'
          }),
          s('legal', 'Texto legal', { hint: '{year} se reemplaza por el año actual; {link} por el enlace de abajo.' }),
          obj('legalLink', 'Enlace del texto legal', [s('text', 'Texto'), s('href', 'Enlace', { hint: HREF_HINT })])
        ]
      }
    ]
  },
  {
    id: 'index', label: 'Página de inicio', path: 'content/index.json', livePath: '/',
    sections: [
      {
        id: 'hero', key: 'hero', label: 'Portada', anchor: 'inicio',
        description: 'Lo primero que ve quien entra a tu página.',
        fields: [
          t('title', 'Título'),
          t('lead', 'Bajada'),
          s('ctaPrimary', 'Botón principal'),
          s('ctaPrimaryHref', 'Enlace botón principal', { hint: HREF_HINT }),
          s('ctaSecondary', 'Botón secundario'),
          s('ctaSecondaryHref', 'Enlace botón secundario', { hint: HREF_HINT }),
          s('note', 'Nota bajo los botones')
        ]
      },
      {
        id: 'demo', key: 'demo', label: 'Demo de rubros', anchor: 'inicio',
        description: 'La maqueta interactiva junto a la portada.',
        fields: [
          s('prompt', 'Texto sobre las pestañas'),
          s('caption', 'Leyenda bajo la demo'),
          texts('legend', 'Explicación numerada', 'Punto'),
          list('examples', 'Rubros', [
            s('key', 'Identificador (sin espacios)', { advanced: true, pattern: ['^[a-z0-9-]+$', 'Solo minúsculas, números y guiones'] }),
            s('label', 'Nombre de la pestaña'),
            { name: 'accent', label: 'Color', widget: 'color' },
            s('url', 'Dominio de ejemplo'),
            s('brand', 'Marca de ejemplo'),
            s('title', 'Titular'),
            s('sub', 'Bajada'),
            s('cta', 'Botón'),
            texts('trust', 'Señales de confianza', 'Señal')
          ], { min: 1, summary: 'label' })
        ]
      },
      {
        id: 'services', key: 'services', label: 'Servicios', anchor: 'servicios',
        fields: [
          s('heading', 'Título'),
          t('intro', 'Introducción'),
          list('items', 'Servicios', [
            s('title', 'Nombre'), t('description', 'Descripción'),
            s('linkText', 'Texto del enlace'), s('linkHref', 'Enlace', { hint: HREF_HINT })
          ], { summary: 'title' }),
          s('includedTitle', 'Título de "incluye"'),
          texts('included', 'Lo que incluye', 'Ítem')
        ]
      },
      {
        id: 'compare', key: 'compare', label: 'Landing vs sitio web', anchor: 'elige-pagina',
        fields: [
          s('heading', 'Título'),
          t('intro', 'Introducción'),
          list('columns', 'Columnas', [
            s('title', 'Título'),
            list('rows', 'Filas', [s('term', 'Concepto'), s('description', 'Detalle')], { summary: 'term' }),
            s('linkText', 'Texto del enlace'),
            s('linkHref', 'Enlace', { hint: HREF_HINT })
          ], { summary: 'title' }),
          ...notes
        ]
      },
      processSection('proceso'),
      faqSection('preguntas-frecuentes'),
      {
        id: 'contact', key: 'contact', label: 'Formulario de contacto', anchor: 'formulario',
        fields: [
          s('heading', 'Título'),
          t('intro', 'Introducción'),
          texts('bullets', 'Puntos', 'Punto'),
          s('subject', 'Asunto del correo recibido', { hint: 'El asunto del correo que te llega con cada consulta.' }),
          s('fromName', 'Remitente del correo recibido'),
          obj('labels', 'Etiquetas de los campos', [
            s('name', 'Nombre'), s('email', 'Correo'), s('company', 'Negocio'),
            s('companyOptional', 'Negocio (opcional)'), s('phone', 'Teléfono'), s('phoneOptional', 'Teléfono (opcional)'),
            s('service', 'Servicio'), s('message', 'Mensaje'), s('messagePlaceholder', 'Ejemplo en el mensaje'),
            s('submit', 'Botón enviar')
          ], { collapsed: true }),
          texts('serviceOptions', 'Opciones de servicio', 'Opción'),
          s('web3formsAccessKey', 'Clave Web3Forms', { advanced: true, hint: 'Conecta el formulario con tu correo. No la cambies salvo que sepas lo que haces.' })
        ]
      },
      {
        id: 'actionBar', label: 'Botón fijo en móvil',
        description: 'El botón que queda pegado abajo de la pantalla en celulares.',
        fields: [s('actionBar', 'Texto del botón')]
      },
      meta,
      {
        id: 'schema', key: 'schema', label: 'Datos estructurados', advanced: true,
        description: 'SEO avanzado: datos que leen los buscadores, no se ven en la página.',
        fields: schemaFields
      }
    ]
  },
  {
    id: 'landing-page', label: 'Página Diseño de landing pages', path: 'content/landing-page.json', livePath: '/landing-page',
    sections: [
      {
        id: 'hero', key: 'hero', label: 'Portada',
        fields: [
          t('title', 'Título'),
          t('lead', 'Bajada'),
          s('ctaPrimary', 'Botón principal'),
          s('ctaPrimaryHref', 'Enlace botón principal', { hint: HREF_HINT }),
          s('ctaSecondary', 'Botón secundario'),
          s('ctaSecondaryHref', 'Enlace botón secundario', { hint: HREF_HINT })
        ]
      },
      {
        id: 'focus', key: 'focus', label: 'Para qué sirve',
        fields: [
          s('heading', 'Título'),
          t('intro', 'Introducción'),
          list('items', 'Ítems', [s('title', 'Título'), t('description', 'Descripción')], { summary: 'title' })
        ]
      },
      {
        id: 'content', key: 'content', label: 'Contenido',
        fields: [
          s('heading', 'Título'),
          t('intro', 'Introducción'),
          list('columns', 'Columnas', [s('title', 'Título'), texts('items', 'Ítems', 'Ítem')], { summary: 'title' })
        ]
      },
      {
        id: 'compare', key: 'compare', label: 'Landing vs sitio completo',
        fields: [
          s('heading', 'Título'),
          list('columns', 'Columnas', [s('title', 'Título'), t('description', 'Descripción')], { summary: 'title' }),
          ...notes
        ]
      },
      processSection(),
      faqSection(),
      {
        id: 'ctaBand', key: 'ctaBand', label: 'Llamado final',
        fields: [
          s('heading', 'Título'),
          s('textBefore', 'Texto (antes del enlace)'),
          s('linkText', 'Texto del enlace'),
          s('linkHref', 'Enlace', { hint: HREF_HINT }),
          s('cta', 'Botón'),
          s('ctaHref', 'Enlace del botón', { hint: HREF_HINT })
        ]
      },
      meta,
      {
        id: 'schema', key: 'schema', label: 'Datos estructurados', advanced: true,
        description: 'SEO avanzado: datos que leen los buscadores, no se ven en la página.',
        fields: [...schemaFields, s('breadcrumbName', 'Nombre en la ruta de navegación')]
      }
    ]
  }
];

/** Empty value for a new list item, shaped by its schema. */
export function emptyValue(field: Field): unknown {
  if (field.widget === 'object') return Object.fromEntries((field.fields ?? []).map(f => [f.name, emptyValue(f)]));
  if (field.widget === 'list') return [];
  if (field.widget === 'color') return '#3ce8ff';
  return '';
}

/** New list item: an object built from `fields`, or '' for a list of texts. */
export function emptyItem(field: Field): unknown {
  return field.fields ? emptyValue({ name: '', label: '', widget: 'object', fields: field.fields }) : '';
}

/** Title of a list item: its summary field, else its first non-empty text. */
export function itemTitle(field: Field, item: unknown, index: number): string {
  if (item && typeof item === 'object') {
    const rec = item as Record<string, unknown>;
    const preferred = field.summary ? rec[field.summary] : undefined;
    if (typeof preferred === 'string' && preferred.trim()) return preferred;
    for (const f of field.fields ?? []) {
      const v = rec[f.name];
      if ((f.widget === 'string' || f.widget === 'text') && typeof v === 'string' && v.trim()) return v;
    }
  }
  if (typeof item === 'string' && item.trim()) return item;
  return `${field.itemLabel ?? 'Elemento'} ${index + 1}`;
}
