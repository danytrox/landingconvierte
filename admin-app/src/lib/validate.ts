// Checks the draft against schema rules (patterns, minimum items) before publishing.
import type { Field, Page } from './schema.ts';

export interface Problem { section: string; message: string }

function walk(fields: Field[], value: unknown, where: string, out: string[]) {
  const rec = (value ?? {}) as Record<string, unknown>;
  for (const f of fields) {
    const v = rec[f.name];
    const label = `${where}${f.label}`;
    if (f.pattern && typeof v === 'string' && !new RegExp(f.pattern[0]).test(v)) out.push(`${label}: ${f.pattern[1]}`);
    if (f.widget === 'object' && f.fields) walk(f.fields, v, `${label} › `, out);
    if (f.widget === 'list' && Array.isArray(v)) {
      if (f.min && v.length < f.min) out.push(`${label}: debe tener al menos ${f.min}`);
      if (f.fields) v.forEach((item, i) => walk(f.fields!, item, `${label} ${i + 1} › `, out));
    }
  }
}

export function validatePage(page: Page, data: unknown): Problem[] {
  const problems: Problem[] = [];
  for (const section of page.sections) {
    const out: string[] = [];
    const value = section.key ? (data as Record<string, unknown>)?.[section.key] : data;
    walk(section.fields, value, '', out);
    problems.push(...out.map(message => ({ section: section.label, message })));
  }
  return problems;
}
