// Where content is read from and committed to: GitHub in production,
// the dev server's local-content middleware with `npm run dev:admin`.
import { loadFile, saveFile } from './github.ts';

export interface StoredFile { text: string; sha: string }

export interface Backend {
  kind: 'github' | 'local';
  load(path: string): Promise<StoredFile>;
  save(path: string, text: string, sha: string): Promise<string>;
}

export const REPO = 'danytrox/landingconvierte';
export const BRANCH = 'main';

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
  }
}

export function githubBackend(token: string): Backend {
  return {
    kind: 'github',
    load: path => loadFile({ token, repo: REPO, branch: BRANCH, path }),
    save: (path, text, sha) => saveFile({ token, repo: REPO, branch: BRANCH, path, text, sha })
  };
}

export function localBackend(): Backend {
  const url = (path: string) => `${import.meta.env.BASE_URL}__local/content?path=${encodeURIComponent(path)}`;
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(url(path), init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new BackendError(res.status, data.message || `Error ${res.status}`);
    return data;
  };
  return {
    kind: 'local',
    load: path => call(path),
    save: async (path, text, sha) => (await call(path, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sha })
    })).sha
  };
}
