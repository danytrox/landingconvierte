// Admin panel build: `vite build --config admin-app/vite.config.ts` → admin-app/dist,
// which build.mjs copies to dist/admin. `npm run dev:admin` serves it with the
// local content backend (dev only, never part of the build output).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { localContent } from './dev/local-content.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '..');

export default defineConfig({
  root: here,
  base: '/admin/',
  publicDir: false,
  plugins: [
    react(),
    tailwindcss(),
    localContent({ contentDir: process.env.CONTENT_DIR ? resolve(process.env.CONTENT_DIR) : resolve(repo, 'content') })
  ],
  resolve: { alias: { '@': resolve(here, 'src') } },
  build: { outDir: resolve(here, 'dist'), emptyOutDir: true },
  server: { fs: { allow: [repo] } }
});
