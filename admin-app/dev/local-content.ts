// Dev-only backend: lets `npm run dev:admin` read and write content/*.json on disk
// instead of GitHub. `apply: 'serve'` keeps it out of `vite build` entirely.
import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILES = new Set(['content/site.json', 'content/index.json', 'content/landing-page.json']);
const hash = (text: string) => createHash('sha1').update(text).digest('hex');

export function localContent({ contentDir }: { contentDir: string }): Plugin {
  return {
    name: 'landingconvierte-local-content',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/admin/config.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ authBaseUrl: null, local: true }));
      });
      server.middlewares.use('/admin/__local/content', (req, res) => {
        const url = new URL(req.url ?? '', 'http://local');
        const path = url.searchParams.get('path') ?? '';
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (!FILES.has(path)) return send(404, { message: 'Archivo no permitido' });
        const file = join(contentDir, path.slice('content/'.length));
        const current = readFileSync(file, 'utf8');
        if (req.method === 'GET') return send(200, { text: current, sha: hash(current) });
        if (req.method !== 'PUT') return send(405, { message: 'Método no permitido' });
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
          try {
            const { text, sha } = JSON.parse(raw) as { text: string; sha: string };
            if (sha !== hash(current)) return send(409, { message: 'El archivo cambió en disco' });
            JSON.parse(text);
            writeFileSync(file, text);
            send(200, { sha: hash(text) });
          } catch {
            send(400, { message: 'Contenido inválido' });
          }
        });
      });
    }
  };
}
